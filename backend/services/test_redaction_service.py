import os
import sys

# Add backend directory to sys.path so we can import services
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.redaction_service import RedactionService

def test_redaction_service():
    print("Initializing RedactionService tests...")
    
    # 1. Test SSN redaction
    text_with_ssn = "My employee ID is 9982, and my Social Security Number is 000-12-3456."
    scrubbed_ssn = RedactionService.scrub_text(text_with_ssn)
    print(f"Original: {text_with_ssn}")
    print(f"Scrubbed: {scrubbed_ssn}")
    assert "[SSN_REDACTED]" in scrubbed_ssn
    assert "000-12-3456" not in scrubbed_ssn
    print("SSN redaction check passed.")
    
    # 2. Test Email redaction
    text_with_email = "Please send the file to test.user_123+check@my-domain.co.uk by tonight."
    scrubbed_email = RedactionService.scrub_text(text_with_email)
    print(f"Original: {text_with_email}")
    print(f"Scrubbed: {scrubbed_email}")
    assert "[EMAIL_REDACTED]" in scrubbed_email
    assert "test.user_123+check@my-domain.co.uk" not in scrubbed_email
    print("Email redaction check passed.")

    # 3. Test Phone redaction
    text_with_phone = "You can reach customer service at +1-800-555-0199 or (202) 555-0143."
    scrubbed_phone = RedactionService.scrub_text(text_with_phone)
    print(f"Original: {text_with_phone}")
    print(f"Scrubbed: {scrubbed_phone}")
    assert "[PHONE_REDACTED]" in scrubbed_phone
    assert "800-555-0199" not in scrubbed_phone
    assert "202) 555-0143" not in scrubbed_phone
    print("Phone number redaction check passed.")

    # 4. Verify log entries were created
    log_dir = "logs"
    if not os.path.exists(log_dir) and os.path.exists("backend/logs"):
        log_dir = "backend/logs"
    log_file = os.path.join(log_dir, "compliance_audits.log")
    
    print(f"Checking log file at: {log_file}")
    assert os.path.exists(log_file), "Log file compliance_audits.log does not exist"
    
    with open(log_file, "r") as f:
        log_content = f.read()
        
    print("Compliance log tail:")
    for line in log_content.splitlines()[-5:]:
        print(line)
        
    assert "AUDIT_MASK: Redacted SSN match" in log_content
    assert "AUDIT_MASK: Redacted Email match" in log_content
    assert "AUDIT_MASK: Redacted Phone match" in log_content
    print("Log verification check passed.")
    print("ALL REDACTION SERVICE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_redaction_service()
