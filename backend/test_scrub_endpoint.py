import os
import sys

# Add backend directory to sys.path so we can import models and main
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

# Set environment variables before imports
os.environ["DATABASE_URL"] = "sqlite:///D:/Users/micha/data-freedom-solutions/disappear.db"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_mock"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_mock"
os.environ["MARQETA_BASE_URL"] = "https://sandbox-api.marqeta.com/v3"
os.environ["MARQETA_USERNAME"] = "mock_user"
os.environ["MARQETA_PASSWORD"] = "mock_pass"
os.environ["MARQETA_CARD_PRODUCT_TOKEN"] = "mock_product"

from main import app
from models import SessionLocal, DBProfile
from fastapi.testclient import TestClient

# Create the test client
client = TestClient(app)

def run_endpoint_test():
    db = SessionLocal()
    
    # 1. Clean up any existing test data to start fresh
    db.query(DBProfile).filter(DBProfile.id.in_(["user_scrub_approved", "user_scrub_pending"])).delete()
    db.commit()
    
    print("Seeding test user profiles...")
    # 2. Seed an approved user
    approved_user = DBProfile(
        id="user_scrub_approved",
        first_name="Approved",
        last_name="Scrub User",
        email="approved@test.com",
        kyc_status="APPROVED",
        aml_flagged=False
    )
    # 3. Seed a pending user
    pending_user = DBProfile(
        id="user_scrub_pending",
        first_name="Pending",
        last_name="Scrub User",
        email="pending@test.com",
        kyc_status="PENDING",
        aml_flagged=False
    )
    db.add(approved_user)
    db.add(pending_user)
    db.commit()
    
    # 4. Test success case (Approved User)
    print("Testing /scrub with an approved KYC profile...")
    payload = {
        "text": "Call me at +1 800-555-0199 or email user@example.com. My SSN is 000-12-3456."
    }
    headers = {
        "x-user-id": "user_scrub_approved"
    }
    response = client.post("/scrub", json=payload, headers=headers)
    print(f"Approved User Response Status Code: {response.status_code}")
    print(f"Approved User Response JSON: {response.json()}")
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    scrubbed_text = response.json().get("scrubbed_text", "")
    assert "[SSN_REDACTED]" in scrubbed_text
    assert "[EMAIL_REDACTED]" in scrubbed_text
    assert "[PHONE_REDACTED]" in scrubbed_text
    print("Success case passed.")
    
    # 5. Test rejection case (Pending User)
    print("Testing /scrub with a pending KYC profile...")
    headers_pending = {
        "x-user-id": "user_scrub_pending"
    }
    response_pending = client.post("/scrub", json=payload, headers=headers_pending)
    print(f"Pending User Response Status Code: {response_pending.status_code}")
    print(f"Pending User Response JSON: {response_pending.json()}")
    
    assert response_pending.status_code == 403, f"Expected 403, got {response_pending.status_code}"
    assert "KYC verification pending or rejected" in response_pending.json().get("detail", "")
    print("Rejection case passed.")
    
    # 6. Verify log file records
    log_file = "logs/compliance_audits.log"
    assert os.path.exists(log_file), "Log file compliance_audits.log does not exist"
    
    with open(log_file, "r") as f:
        log_content = f.read()
        
    print("Verifying log entries in compliance_audits.log...")
    # Check for success event logs
    assert "USER: user_scrub_approved | ACTION: TEXT_SCRUB | STATUS: SUCCESS" in log_content
    # Check for redact details logs
    assert "AUDIT_MASK: Redacted SSN match" in log_content
    assert "AUDIT_MASK: Redacted Email match" in log_content
    assert "AUDIT_MASK: Redacted Phone match" in log_content
    # Check for rejection event logs
    assert "USER: user_scrub_pending | ACTION: TEXT_SCRUB | REJECTION: COMPLIANCE_HOLD" in log_content
    print("Compliance log assertions passed.")
    print("ALL ENDPOINT SCRUB TESTS PASSED SUCCESSFULLY!")
    
    # 7. Clean up
    print("Cleaning up test data...")
    db.query(DBProfile).filter(DBProfile.id.in_(["user_scrub_approved", "user_scrub_pending"])).delete()
    db.commit()
    db.close()

if __name__ == "__main__":
    run_endpoint_test()
