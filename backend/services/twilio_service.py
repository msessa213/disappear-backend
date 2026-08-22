import os
import logging
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from pydantic_settings import BaseSettings
from typing import Optional

# Use the existing logger from the main application
logger = logging.getLogger("disappear")

class TwilioSettings(BaseSettings):
    """
    Manages Twilio configuration using environment variables.
    pydantic-settings will automatically read from .env files or the environment.
    """
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_API_KEY_SID: Optional[str] = None
    TWILIO_API_KEY_SECRET: Optional[str] = None
    TWILIO_PHONE_NUMBER: Optional[str] = None
    TWILIO_MESSAGING_SERVICE_SID: Optional[str] = None

    class Config:
        env_file = ".env"
        extra = "ignore"

try:
    settings = TwilioSettings()
    account_sid = (settings.TWILIO_ACCOUNT_SID or os.getenv("TWILIO_ACCOUNT_SID") or "").strip()
    auth_token = (settings.TWILIO_AUTH_TOKEN or os.getenv("TWILIO_AUTH_TOKEN") or "").strip()
    key_sid = (settings.TWILIO_API_KEY_SID or os.getenv("TWILIO_API_KEY_SID") or "").strip()
    key_secret = (settings.TWILIO_API_KEY_SECRET or os.getenv("TWILIO_API_KEY_SECRET") or "").strip()

    if account_sid.startswith("SK"):
        account_sid = ""

    twilio_client = None

    # Method 1: Try API Key & Secret
    if key_sid and key_secret:
        try:
            client1 = Client(key_sid, key_secret, account_sid) if (account_sid and account_sid.startswith("AC")) else Client(key_sid, key_secret)
            client1.incoming_phone_numbers.list(limit=1)
            twilio_client = client1
            logger.info("Twilio client initialized using API Key & Secret.")
        except Exception as e1:
            logger.warning(f"Twilio API Key auth attempt failed: {e1}")

    # Method 2: Fallback to Account SID + Auth Token
    if not twilio_client and account_sid and auth_token:
        try:
            client2 = Client(account_sid, auth_token)
            client2.incoming_phone_numbers.list(limit=1)
            twilio_client = client2
            logger.info("Twilio client initialized using Account SID & Auth Token.")
        except Exception as e2:
            logger.warning(f"Twilio Auth Token auth attempt failed: {e2}")

    if not twilio_client:
        logger.warning("TWILIO_WARNING: Unable to authenticate Twilio client with provided credentials.")
except Exception as e:
    logger.error(f"CRITICAL_TWILIO_ERROR: Failed to initialize Twilio client: {e}")
    twilio_client = None

def send_sms(to_phone_number: str, message_body: str, from_phone_number: Optional[str] = None) -> bool:
    """
    Sends an SMS message using the configured Twilio client.

    Args:
        to_phone_number: The recipient's phone number in E.164 format (e.g., +15551234567).
        message_body: The content of the message to send.
        from_phone_number: Optional custom sender phone number (e.g. virtual alias number).

    Returns:
        True if the message was sent successfully, False otherwise.
    """
    if not twilio_client:
        logger.error("TWILIO_SEND_SMS_FAILURE: Twilio client is not available. Cannot send message.")
        return False

    msg_service_sid = settings.TWILIO_MESSAGING_SERVICE_SID or os.getenv("TWILIO_MESSAGING_SERVICE_SID")
    
    # If a messaging service SID is configured and no explicit sender was passed, prefer messaging_service_sid
    if msg_service_sid and not from_phone_number:
        try:
            message = twilio_client.messages.create(
                body=message_body,
                messaging_service_sid=msg_service_sid,
                to=to_phone_number
            )
            logger.info(f"Twilio SMS sent via Messaging Service {msg_service_sid} to {to_phone_number}. SID: {message.sid}")
            return True
        except Exception as ex:
            logger.warning(f"Messaging Service send failed: {ex}")

    from_num = from_phone_number or settings.TWILIO_PHONE_NUMBER or os.getenv("TWILIO_PHONE_NUMBER")
    
    # Fallback to account's first available phone number if from_num is missing
    if not from_num:
        try:
            numbers = twilio_client.incoming_phone_numbers.list(limit=1)
            if numbers:
                from_num = numbers[0].phone_number
        except Exception:
            pass

    if from_num:
        try:
            message = twilio_client.messages.create(body=message_body, from_=from_num, to=to_phone_number)
            logger.info(f"Twilio SMS sent successfully from {from_num} to {to_phone_number}. SID: {message.sid}")
            return True
        except Exception as ex_from:
            logger.warning(f"Twilio SMS send from {from_num} failed: {ex_from}.")

    # Ultimate fallback to Messaging Service if specific sender failed
    if msg_service_sid:
        try:
            message = twilio_client.messages.create(
                body=message_body,
                messaging_service_sid=msg_service_sid,
                to=to_phone_number
            )
            logger.info(f"Twilio SMS sent via fallback Messaging Service {msg_service_sid} to {to_phone_number}. SID: {message.sid}")
            return True
        except Exception as ex_fallback:
            logger.error(f"TWILIO_SEND_SMS_FAILURE: Messaging Service fallback failed: {ex_fallback}")

    logger.error(f"TWILIO_SEND_SMS_FAILURE: Failed to send SMS to {to_phone_number}.")
    return False

def make_voice_call(to_phone_number: str, twiml_url: str) -> bool:
    """
    Initiates a voice call using the configured Twilio client.

    Args:
        to_phone_number: The recipient's phone number in E.164 format.
        twiml_url: The URL that returns TwiML instructions for the call (e.g., to read a message or play audio).

    Returns:
        True if the call was initiated successfully, False otherwise.
    """
    if not twilio_client:
        logger.error("TWILIO_CALL_FAILURE: Twilio client is not available. Cannot make call.")
        return False

    try:
        call = twilio_client.calls.create(
            url=twiml_url,
            to=to_phone_number,
            from_=settings.TWILIO_PHONE_NUMBER
        )
        logger.info(f"Twilio Voice call initiated successfully to {to_phone_number}. SID: {call.sid}")
        return True
    except TwilioRestException as e:
        logger.error(f"TWILIO_CALL_FAILURE: Failed to make call to {to_phone_number}. Error: {e}")
        return False

def provision_phone_number(area_code: str = "800", country_code: str = "US") -> str | None:
    """
    Searches for and purchases a new Twilio phone number.
    Supports local area codes and toll-free codes (800, 888, 877, etc.).
    """
    if not twilio_client:
        logger.error("TWILIO_PROVISION_FAILURE: Twilio client is not available.")
        import random
        mock_number = f"+1 (555) {random.randint(100, 999)}-{random.randint(1000, 9999)}"
        logger.warning(f"TWILIO_MOCK_FALLBACK: Generated mock number {mock_number}")
        return mock_number
        
    try:
        available_numbers = []
        is_toll_free = (area_code or "").strip() in ["800", "888", "877", "866", "855", "844", "833"]

        if is_toll_free:
            try:
                available_numbers = twilio_client.available_phone_numbers(country_code).toll_free.list(limit=1)
            except Exception as e:
                logger.warning(f"Toll-free search failed: {e}")

        if not available_numbers and area_code:
            try:
                available_numbers = twilio_client.available_phone_numbers(country_code).local.list(
                    area_code=area_code,
                    limit=1
                )
            except Exception as e:
                logger.warning(f"Area code search for {area_code} failed: {e}")

        if not available_numbers:
            logger.warning(f"No numbers found for area code {area_code}. Trying generic local search...")
            available_numbers = twilio_client.available_phone_numbers(country_code).local.list(limit=1)
            
        if not available_numbers:
            logger.error("TWILIO_PROVISION_FAILURE: No numbers found in country pool.")
            return None
            
        base_url = "https://disappear-backend-production.up.railway.app"
        voice_url = f"{base_url}/twilio/voice"
        sms_url = f"{base_url}/twilio/sms"
        
        purchased_number = twilio_client.incoming_phone_numbers.create(
            phone_number=available_numbers[0].phone_number,
            voice_url=voice_url,
            sms_url=sms_url,
            voice_method="POST",
            sms_method="POST"
        )
        logger.info(f"Twilio phone number {purchased_number.phone_number} provisioned successfully with webhooks: voice={voice_url}, sms={sms_url}.")
        return purchased_number.phone_number
    except TwilioRestException as e:
        logger.error(f"TWILIO_PROVISION_FAILURE: Error provisioning number: {e}")
        return None

def release_phone_number(phone_number: str) -> bool:
    """
    Releases a previously purchased Twilio phone number.
    Useful for when a user terminates a phone alias.
    """
    if not twilio_client:
        logger.warning(f"TWILIO_RELEASE_MOCK: Twilio client not available. Bypassing release for number {phone_number}")
        return True
        
    try:
        incoming_phone_numbers = twilio_client.incoming_phone_numbers.list(
            phone_number=phone_number,
            limit=1
        )
        if incoming_phone_numbers:
            twilio_client.incoming_phone_numbers(incoming_phone_numbers[0].sid).delete()
            logger.info(f"Twilio phone number {phone_number} released successfully.")
            return True
        else:
            logger.warning(f"TWILIO_RELEASE_FAILURE: Phone number {phone_number} not found in Twilio account.")
            return False
    except TwilioRestException as e:
        logger.error(f"TWILIO_RELEASE_FAILURE: Error releasing number {phone_number}: {e}")
        return False


def sync_all_twilio_webhooks(db=None):
    """Ensures all active Twilio phone numbers are configured with production SMS and Voice Webhooks and registered as DBAlias records."""
    if not twilio_client:
        return
    sms_url = "https://disappear-backend-production.up.railway.app/twilio/sms"
    voice_url = "https://disappear-backend-production.up.railway.app/twilio/voice"

    try:
        numbers = twilio_client.incoming_phone_numbers.list(limit=50)
        for n in numbers:
            if n.sms_url != sms_url or n.voice_url != voice_url:
                try:
                    twilio_client.incoming_phone_numbers(n.sid).update(
                        sms_url=sms_url,
                        sms_method="POST",
                        voice_url=voice_url,
                        voice_method="POST"
                    )
                    logger.info(f"TWILIO_WEBHOOK_SYNC: Configured {n.phone_number} -> {sms_url}")
                except Exception as ex:
                    logger.warning(f"Failed to update webhook for {n.phone_number}: {ex}")

            if db:
                from models import DBAlias, DBProfile
                import uuid
                active_prof = db.query(DBProfile).order_by(DBProfile.created_at.desc()).first()
                target_uid = active_prof.id if active_prof else "user_customer_test_99"

                existing = db.query(DBAlias).filter(DBAlias.content == n.phone_number).first()
                if not existing:
                    db.add(DBAlias(
                        id=f"als_{uuid.uuid4().hex[:12]}",
                        user_id=target_uid,
                        type="phone",
                        content=n.phone_number,
                        label=f"Virtual Line {n.phone_number[-4:]}"
                    ))
                else:
                    # Keep existing user_id link intact! Never overwrite existing user_id
                    pass
        if db:
            db.commit()
    except Exception as e:
        logger.warning(f"TWILIO_WEBHOOK_SYNC_NOTICE: {e}")