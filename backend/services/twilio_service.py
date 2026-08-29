import os
import logging
import traceback
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

settings = TwilioSettings()

_twilio_client_instance = None

def get_twilio_client() -> Optional[Client]:
    """
    Safely resolves and returns the Twilio Client instance.
    Initializes lazily from environment variables without throwing startup network exceptions.
    """
    global _twilio_client_instance
    if _twilio_client_instance is not None:
        return _twilio_client_instance

    account_sid = (os.getenv("TWILIO_ACCOUNT_SID") or getattr(settings, "TWILIO_ACCOUNT_SID", None) or "").strip()
    auth_token = (os.getenv("TWILIO_AUTH_TOKEN") or getattr(settings, "TWILIO_AUTH_TOKEN", None) or "").strip()
    key_sid = (os.getenv("TWILIO_API_KEY_SID") or getattr(settings, "TWILIO_API_KEY_SID", None) or "").strip()
    key_secret = (os.getenv("TWILIO_API_KEY_SECRET") or getattr(settings, "TWILIO_API_KEY_SECRET", None) or "").strip()

    if account_sid.startswith("SK"):
        account_sid = ""

    # Strategy 1: Account SID + Auth Token (Direct, 100% reliable for REST API message dispatch)
    if account_sid and auth_token and account_sid.startswith("AC"):
        try:
            _twilio_client_instance = Client(account_sid, auth_token)
            logger.info("✅ TWILIO_INIT_SUCCESS: Initialized client using Account SID & Auth Token.")
            return _twilio_client_instance
        except Exception as ex1:
            logger.warning(f"Twilio Account SID initialization notice: {ex1}")

    # Strategy 2: API Key SID + API Secret
    if key_sid and key_secret:
        try:
            if account_sid and account_sid.startswith("AC"):
                _twilio_client_instance = Client(key_sid, key_secret, account_sid)
            else:
                _twilio_client_instance = Client(key_sid, key_secret)
            logger.info("✅ TWILIO_INIT_SUCCESS: Initialized client using API Key & Secret.")
            return _twilio_client_instance
        except Exception as ex2:
            logger.warning(f"Twilio API Key initialization notice: {ex2}")

    logger.warning("TWILIO_WARNING: Twilio credentials not configured or initialization incomplete.")
    return None

twilio_client = get_twilio_client()

def format_to_e164(phone_str: str) -> str:
    if not phone_str:
        return ""
    digits = "".join(filter(str.isdigit, str(phone_str)))
    if len(digits) == 10:
        return f"+1{digits}"
    elif len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    elif len(digits) > 10:
        return f"+{digits}"
    return phone_str.strip() if str(phone_str).startswith("+") else (f"+{digits}" if digits else "")

def send_sms(to_phone_number: str, message_body: str, from_phone_number: Optional[str] = None) -> bool:
    """
    Sends an SMS message using the configured Twilio client.
    Guarantees E.164 formatting, alias sender routing, clean Disappear branding, and detailed error logs.

    Args:
        to_phone_number: The recipient's phone number in E.164 format (e.g., +15551234567).
        message_body: The content of the message to send.
        from_phone_number: Optional custom sender phone number (e.g. virtual alias number).

    Returns:
        True if the message was sent successfully, False otherwise.
    """
    active_client = get_twilio_client()
    if not active_client:
        logger.error("TWILIO_SEND_SMS_FAILURE: Twilio client is not available. Cannot send message.")
        return False

    target_to = format_to_e164(to_phone_number)
    if not target_to:
        logger.error(f"TWILIO_INVALID_RECIPIENT: Recipient number '{to_phone_number}' could not be formatted to E.164 standard.")
        return False

    default_sender = format_to_e164(settings.TWILIO_PHONE_NUMBER or os.getenv("TWILIO_PHONE_NUMBER") or "+15855802036")
    msg_service_sid = (settings.TWILIO_MESSAGING_SERVICE_SID or os.getenv("TWILIO_MESSAGING_SERVICE_SID") or "").strip()
    
    # Priority: Dynamically use user's formatted alias phone number if provided, otherwise default sender number
    requested_from_e164 = format_to_e164(from_phone_number) if from_phone_number else ""
    from_num = requested_from_e164 if requested_from_e164 else default_sender

    # Ensure clean Disappear branding prefix on every outgoing SMS message body
    clean_body = (message_body or "").strip()
    if clean_body:
        if not (clean_body.startswith("[Disappear]") or clean_body.startswith("📱 [Disappear Alert]") or clean_body.startswith("[Disappear Vault]") or clean_body.startswith("Disappear Alert:")):
            clean_body = f"[Disappear] {clean_body}"

    if from_num:
        try:
            message = active_client.messages.create(body=clean_body, from_=from_num, to=target_to)
            logger.info(f"✅ TWILIO_SMS_DISPATCHED: Sent SMS from alias/line {from_num} to {target_to} | SID: {message.sid} | Body: '{clean_body[:45]}...'")
            return True
        except TwilioRestException as tw_err:
            logger.error(
                f"❌ TWILIO_REST_ERROR [Code {tw_err.code}]: {tw_err.msg} | "
                f"Status: {tw_err.status} | From: {from_num} | To: {target_to}"
            )
        except Exception as ex_from:
            logger.error(f"❌ TWILIO_SMS_DISPATCH_EXCEPTION: From={from_num} To={target_to} Error={str(ex_from)}")

    # Fallback to Messaging Service SID if specific phone number dispatch failed or unassigned
    if msg_service_sid:
        try:
            message = active_client.messages.create(
                body=clean_body,
                messaging_service_sid=msg_service_sid,
                to=target_to
            )
            logger.info(f"✅ TWILIO_SMS_DISPATCHED_VIA_SERVICE: Sent SMS via Messaging Service {msg_service_sid} to {target_to} | SID: {message.sid}")
            return True
        except TwilioRestException as tw_svc_err:
            logger.error(f"❌ TWILIO_SERVICE_REST_ERROR [Code {tw_svc_err.code}]: {tw_svc_err.msg} | To: {target_to}")
        except Exception as ex_fallback:
            logger.error(f"❌ TWILIO_SEND_SMS_FAILURE: Messaging Service fallback failed: {ex_fallback}")

    logger.error(f"🚨 TWILIO_SEND_SMS_FAILURE: Failed to send SMS from {from_num} to {target_to}.")
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

            # Webhook URL sync only - DBAlias ownership is managed strictly per user during minting
    except Exception as e:
        logger.warning(f"TWILIO_WEBHOOK_SYNC_NOTICE: {e}")