import os
import json
import logging
from datetime import datetime

# Make sure logs directory exists
os.makedirs("logs", exist_ok=True)

# Set up audit logger
audit_logger = logging.getLogger("marqeta_audit")
audit_logger.setLevel(logging.INFO)

# Avoid adding multiple handlers if the module is imported multiple times
if not audit_logger.handlers:
    audit_handler = logging.FileHandler("logs/marqeta_compliance_audit.log")
    audit_formatter = logging.Formatter('%(message)s')  # We write JSON directly, so no prefix is needed
    audit_handler.setFormatter(audit_formatter)
    audit_logger.addHandler(audit_handler)

def log_audit_event(event_type: str, user_token: str, transaction_token: str = None, card_token: str = None, amount: float = 0.0, status: str = "SUCCESS", details: str = ""):
    """
    Logs an audit event in structured JSON format suitable for monthly Marqeta submissions.
    """
    log_entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "event_type": event_type,
        "user_token": user_token,
        "transaction_token": transaction_token,
        "card_token": card_token,
        "amount": amount,
        "status": status,
        "details": details
    }
    # Log to file
    audit_logger.info(json.dumps(log_entry))
    
    # Also log to main disappear logger in a safe manner without PII
    from logging import getLogger
    getLogger("disappear").info(f"MARQETA_AUDIT_LOG: type={event_type} user_token={user_token[:8]}... status={status}")

def log_dispute(user_token: str, transaction_token: str, amount: float, reason: str, status: str = "OPENED"):
    """
    Logs a transaction dispute.
    """
    log_audit_event(
        event_type="DISPUTE",
        user_token=user_token,
        transaction_token=transaction_token,
        amount=amount,
        status=status,
        details=reason
    )

def log_chargeback(user_token: str, transaction_token: str, amount: float, reason: str, status: str = "INITIATED"):
    """
    Logs a chargeback event.
    """
    log_audit_event(
        event_type="CHARGEBACK",
        user_token=user_token,
        transaction_token=transaction_token,
        amount=amount,
        status=status,
        details=reason
    )

def log_compliance_block(user_token: str, check_type: str, reason: str, card_token: str = None, amount: float = 0.0):
    """
    Logs a compliance-related rejection or event (e.g. KYC, AML, Velocity limit).
    """
    log_audit_event(
        event_type=f"COMPLIANCE_BLOCK_{check_type.upper()}",
        user_token=user_token,
        card_token=card_token,
        amount=amount,
        status="DECLINED",
        details=reason
    )
