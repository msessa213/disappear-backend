import logging
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from pydantic_settings import BaseSettings

# Use the existing logger from the main application
logger = logging.getLogger("disappear")

class TwilioSettings(BaseSettings):
    """
    Manages Twilio configuration using environment variables.
    pydantic-settings will automatically read from .env files or the environment.
    """
    TWILIO_ACCOUNT_SID: str
    TWILIO_API_KEY_SID: str
    TWILIO_API_KEY_SECRET: str
    TWILIO_PHONE_NUMBER: str # The Twilio phone number to send messages from

    class Config:
        # If you use a .env file, pydantic-settings will load it.
        env_file = ".env"
        extra = "ignore"

try:
    settings = TwilioSettings()
    # Initialize client using API Key and Secret for better security
    twilio_client = Client(settings.TWILIO_API_KEY_SID, settings.TWILIO_API_KEY_SECRET, settings.TWILIO_ACCOUNT_SID)
    logger.info("Twilio client initialized successfully.")
except Exception as e:
    logger.error(f"CRITICAL_TWILIO_ERROR: Failed to initialize Twilio client. Check environment variables (TWILIO_*). Error: {e}")
    twilio_client = None

def send_sms(to_phone_number: str, message_body: str) -> bool:
    """
    Sends an SMS message using the configured Twilio client.

    Args:
        to_phone_number: The recipient's phone number in E.164 format (e.g., +15551234567).
        message_body: The content of the message to send.

    Returns:
        True if the message was sent successfully, False otherwise.
    """
    if not twilio_client:
        logger.error("TWILIO_SEND_SMS_FAILURE: Twilio client is not available. Cannot send message.")
        return False

    try:
        message = twilio_client.messages.create(body=message_body, from_=settings.TWILIO_PHONE_NUMBER, to=to_phone_number)
        logger.info(f"Twilio SMS sent successfully to {to_phone_number}. SID: {message.sid}")
        return True
    except TwilioRestException as e:
        logger.error(f"TWILIO_SEND_SMS_FAILURE: Failed to send SMS to {to_phone_number}. Error: {e}")
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
    Useful for generating new phone aliases for users.
    """
    if not twilio_client:
        logger.error("TWILIO_PROVISION_FAILURE: Twilio client is not available.")
        return None
        
    try:
        local_numbers = twilio_client.available_phone_numbers(country_code).local.list(
            area_code=area_code,
            limit=1
        )
        if not local_numbers:
            logger.error(f"TWILIO_PROVISION_FAILURE: No numbers found for area code {area_code}.")
            return None
            
        purchased_number = twilio_client.incoming_phone_numbers.create(
            phone_number=local_numbers[0].phone_number
        )
        logger.info(f"Twilio phone number {purchased_number.phone_number} provisioned successfully.")
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
        logger.error("TWILIO_RELEASE_FAILURE: Twilio client is not available.")
        return False
        
    try:
        incoming_phone_numbers = twilio_client.incoming_phone_numbers.list(
            phone_number=phone_number,
            limit=1
        )
        if not incoming_phone_numbers:
            logger.error(f"TWILIO_RELEASE_FAILURE: Phone number {phone_number} not found in account.")
            return False
            
        twilio_client.incoming_phone_numbers(incoming_phone_numbers[0].sid).delete()
        logger.info(f"Twilio phone number {phone_number} released successfully.")
        return True
    except TwilioRestException as e:
        logger.error(f"TWILIO_RELEASE_FAILURE: Error releasing number {phone_number}: {e}")
        return False