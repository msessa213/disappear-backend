import re
import logging
import os

compliance_logger = logging.getLogger("compliance_audits")

# Bootstrap compliance handler if running standalone (e.g., in unit tests)
if not compliance_logger.handlers:
    compliance_logger.setLevel(logging.INFO)
    
    # Robustly determine log path depending on current working directory
    log_dir = "logs"
    if not os.path.exists(log_dir) and os.path.exists("backend"):
        log_dir = os.path.join("backend", "logs")
    os.makedirs(log_dir, exist_ok=True)
    
    log_path = os.path.join(log_dir, "compliance_audits.log")
    handler = logging.FileHandler(log_path)
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    compliance_logger.addHandler(handler)

class RedactionService:
    """
    Service to identify and redact Personally Identifiable Information (PII)
    such as Social Security Numbers, Email Addresses, and Phone Numbers.
    """
    
    # Regex patterns for matching SSN, Email, and Phone
    SSN_PATTERN = re.compile(r'\b\d{3}-\d{2}-\d{4}\b')
    
    EMAIL_PATTERN = re.compile(
        r'\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b'
    )
    
    # Phone number pattern matches US phone numbers in standard formats:
    # 123-456-7890, (123) 456-7890, +1 123 456 7890, 123.456.7890, etc.
    # Group 1 captures the area code.
    PHONE_PATTERN = re.compile(
        r'(?:\+?1[-. ]*)?\(?([0-9]{3})\)?[-. ]*[0-9]{3}[-. ]*[0-9]{4}'
    )

    @classmethod
    def scrub_text(cls, text: str) -> str:
        """
        Scrubs SSNs, Emails, and Phone Numbers from the input text.
        Logs redaction events to the compliance_audits log.
        """
        if not text:
            return ""

        scrubbed = text

        # Match and redact SSNs
        ssn_matches = cls.SSN_PATTERN.findall(scrubbed)
        if ssn_matches:
            scrubbed = cls.SSN_PATTERN.sub("[SSN_REDACTED]", scrubbed)
            for m in ssn_matches:
                compliance_logger.info(f"AUDIT_MASK: Redacted SSN match: {m[:3]}-XX-XXXX")

        # Match and redact Emails
        email_matches = cls.EMAIL_PATTERN.findall(scrubbed)
        if email_matches:
            scrubbed = cls.EMAIL_PATTERN.sub("[EMAIL_REDACTED]", scrubbed)
            for m in email_matches:
                parts = m.split("@")
                masked_email = f"{parts[0][0]}***@{parts[1]}" if parts[0] else m
                compliance_logger.info(f"AUDIT_MASK: Redacted Email match: {masked_email}")

        # Match and redact Phone Numbers
        phone_matches = cls.PHONE_PATTERN.findall(scrubbed)
        if phone_matches:
            scrubbed = cls.PHONE_PATTERN.sub("[PHONE_REDACTED]", scrubbed)
            for m in phone_matches:
                # Since PHONE_PATTERN has exactly one capture group,
                # findall returns a list of captured strings directly.
                area_code = m
                compliance_logger.info(f"AUDIT_MASK: Redacted Phone match: ({area_code})-XXX-XXXX")

        return scrubbed
