import os
import sys
from unittest.mock import AsyncMock

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Set mock env variables before imports
os.environ["DATABASE_URL"] = "sqlite:///D:/Users/micha/data-freedom-solutions/disappear.db"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_mock"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_mock"
os.environ["MARQETA_BASE_URL"] = "https://sandbox-api.marqeta.com/v3"
os.environ["MARQETA_USERNAME"] = "mock_user"
os.environ["MARQETA_PASSWORD"] = "mock_pass"
os.environ["MARQETA_CARD_PRODUCT_TOKEN"] = "mock_product"

import main
from main import app
from models import SessionLocal, DBProfile, DBCard

# Mock MarqetaClient.create_card to avoid external API calls and ensure status code 200
main.MarqetaClient.create_card = AsyncMock(return_value={
    "expiration": "1228",
    "pan": "4111111111111111",
    "cvv_number": "123",
    "token": "mocked_marqeta_vcc_token",
    "last_four": "1111"
})

from fastapi.testclient import TestClient
client = TestClient(app)

def test_full_integration():
    db = SessionLocal()
    
    # Clean up test database profiles to prevent clashes
    db.query(DBCard).filter(DBCard.user_id.in_(["user_smoke_approved", "user_smoke_pending"])).delete()
    db.query(DBProfile).filter(DBProfile.id.in_(["user_smoke_approved", "user_smoke_pending"])).delete()
    db.commit()

    print("Seeding test database profiles...")
    # Seed Approved User
    approved_user = DBProfile(
        id="user_smoke_approved",
        first_name="Smoke",
        last_name="Approved User",
        email="approved@smoke.com",
        kyc_status="APPROVED",
        aml_flagged=False
    )
    # Seed Pending User
    pending_user = DBProfile(
        id="user_smoke_pending",
        first_name="Smoke",
        last_name="Pending User",
        email="pending@smoke.com",
        kyc_status="PENDING",
        aml_flagged=False
    )
    db.add(approved_user)
    db.add(pending_user)
    db.commit()

    try:
        # --- TEST 1: Call POST /scrub ---
        print("Test 1: Calling POST /scrub...")
        scrub_payload = {
            "text": "Send the SSN 999-12-3456 to operations@disappear.private immediately."
        }
        headers_approved = {
            "x-user-id": "user_smoke_approved"
        }
        scrub_res = client.post("/scrub", json=scrub_payload, headers=headers_approved)
        print(f"Scrub Status: {scrub_res.status_code}")
        print(f"Scrub Response: {scrub_res.json()}")
        
        assert scrub_res.status_code == 200, f"Test 1 failed: status code {scrub_res.status_code}"
        scrubbed_text = scrub_res.json().get("scrubbed_text", "")
        assert "[SSN_REDACTED]" in scrubbed_text, "Test 1 failed: SSN not redacted"
        assert "[EMAIL_REDACTED]" in scrubbed_text, "Test 1 failed: Email not redacted"
        print("SUCCESS - Test 1 Passed: PII redacted successfully.")

        # --- TEST 2: Verify compliance_audits.log contains INFO entry for Test 1 ---
        print("Test 2: Verifying compliance_audits.log entries...")
        log_file = "logs/compliance_audits.log"
        assert os.path.exists(log_file), "Test 2 failed: compliance_audits.log does not exist"
        
        with open(log_file, "r") as f:
            log_content = f.read()
            
        assert "USER: user_smoke_approved | ACTION: TEXT_SCRUB | STATUS: SUCCESS" in log_content, "Test 2 failed: Log entry missing"
        assert "AUDIT_MASK: Redacted SSN match" in log_content, "Test 2 failed: SSN log match missing"
        print("SUCCESS - Test 2 Passed: Compliance audit logs recorded successfully.")

        # --- TEST 3: Attempt POST /financials/mint with PENDING user ---
        print("Test 3: Calling POST /financials/mint with PENDING KYC profile...")
        mint_payload = {
            "label": "Smoke Test VCC",
            "funding_source_id": "stripe_card_src"
        }
        headers_pending = {
            "x-user-id": "user_smoke_pending"
        }
        mint_pending_res = client.post("/financials/mint", json=mint_payload, headers=headers_pending)
        print(f"Mint Pending Status: {mint_pending_res.status_code}")
        print(f"Mint Pending Response: {mint_pending_res.json()}")
        
        assert mint_pending_res.status_code == 403, f"Test 3 failed: status code {mint_pending_res.status_code}"
        assert "KYC verification pending or rejected" in mint_pending_res.json().get("detail", ""), "Test 3 failed: wrong detail message"
        
        # Verify log entry for Test 3 rejection
        with open(log_file, "r") as f:
            updated_log_content = f.read()
        assert "USER: user_smoke_pending | ACTION: CARD_MINT | REJECTION: COMPLIANCE_HOLD" in updated_log_content, "Test 3 failed: Rejection not logged"
        print("SUCCESS - Test 3 Passed: PENDING user correctly blocked and audited.")

        # --- TEST 4: Attempt POST /financials/mint with APPROVED user ---
        print("Test 4: Calling POST /financials/mint with APPROVED KYC profile...")
        mint_approved_res = client.post("/financials/mint", json=mint_payload, headers=headers_approved)
        print(f"Mint Approved Status: {mint_approved_res.status_code}")
        print(f"Mint Approved Response: {mint_approved_res.json()}")
        
        # Expecting 400 since VCC features are temporarily disabled
        assert mint_approved_res.status_code == 400, f"Test 4 failed: status code {mint_approved_res.status_code}"
        assert "FEATURE_DISABLED" in mint_approved_res.json().get("detail", ""), "Test 4 failed: expected FEATURE_DISABLED error"
        print("SUCCESS - Test 4 Passed: APPROVED user VCC minting correctly returned FEATURE_DISABLED status.")

    finally:
        # Clean up database seeds
        print("Cleaning up smoke test database profiles...")
        db.query(DBCard).filter(DBCard.user_id.in_(["user_smoke_approved", "user_smoke_pending"])).delete()
        db.query(DBProfile).filter(DBProfile.id.in_(["user_smoke_approved", "user_smoke_pending"])).delete()
        db.commit()
        db.close()

if __name__ == "__main__":
    test_full_integration()
