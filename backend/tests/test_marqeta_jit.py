import os
import sys
import json
import time

# Add backend directory to sys.path
sys.path.append(os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

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

client = TestClient(app)

def run_jit_tests():
    db = SessionLocal()
    
    # 1. Clean up test users
    db.query(DBProfile).filter(DBProfile.id.startswith("test_jit_")).delete()
    db.commit()
    
    print("\n--- SEEDING TEST PROFILES FOR MARQETA JIT GATEWAY ---")
    
    # User A: Approved KYC, sufficient balance
    user_approved = DBProfile(
        id="test_jit_approved",
        first_name="John",
        last_name="Doe",
        email="john@doe.com",
        kyc_status="APPROVED",
        aml_flagged=False,
        marqeta_user_token="tok_user_approved",
        marqeta_card_token="tok_card_approved",
        funding_source_token="tok_funding_approved",
        bonus_credits=500,
        daily_spend_limit=200
    )
    
    # User B: Pending KYC
    user_pending = DBProfile(
        id="test_jit_pending",
        first_name="Pending",
        last_name="User",
        email="pending@doe.com",
        kyc_status="PENDING",
        aml_flagged=False,
        marqeta_user_token="tok_user_pending",
        marqeta_card_token="tok_card_pending",
        funding_source_token="tok_funding_pending",
        bonus_credits=500,
        daily_spend_limit=200
    )
    
    # User C: Flagged AML
    user_aml = DBProfile(
        id="test_jit_aml",
        first_name="Flagged",
        last_name="User",
        email="flagged@doe.com",
        kyc_status="APPROVED",
        aml_flagged=True,
        marqeta_user_token="tok_user_aml",
        marqeta_card_token="tok_card_aml",
        funding_source_token="tok_funding_aml",
        bonus_credits=500,
        daily_spend_limit=200
    )

    db.add(user_approved)
    db.add(user_pending)
    db.add(user_aml)
    db.commit()

    print("[OK] Seeded test profiles.")
    
    # Warm-up request to eliminate cold start latency
    print("\n[Warm-up] Initializing routes...")
    client.post("/payments/marqeta/jit", json={
        "jit_funding": {
            "token": "jit_tx_warmup",
            "method": "pgfs.authorization",
            "user_token": "tok_user_approved",
            "amount": "0.00"
        }
    })

    # Test 1: Successful JIT Authorization within <200ms
    print("\n[Test 1] Testing JIT Authorization Approval (<200ms)...")
    payload = {
        "jit_funding": {
            "token": "jit_tx_111",
            "method": "pgfs.authorization",
            "user_token": "tok_user_approved",
            "amount": "50.00"
        }
    }
    
    t0 = time.time()
    response = client.post("/payments/marqeta/jit", json=payload)
    elapsed = (time.time() - t0) * 1000
    
    print(f"Status: {response.status_code}")
    print(f"Elapsed time: {elapsed:.2f}ms")
    print(f"Response: {response.json()}")
    
    assert response.status_code == 200
    assert response.json()["jit_funding"]["token"] == "jit_tx_111"
    assert elapsed < 200.0, f"Approval took {elapsed:.2f}ms, exceeding 200ms limit"
    
    # Verify balance was deducted
    db.refresh(user_approved)
    print(f"Updated Balance for user_approved: {user_approved.bonus_credits} (Expected: 450)")
    assert user_approved.bonus_credits == 450

    # Test 2: Rejection due to Pending KYC
    print("\n[Test 2] Testing JIT Rejection due to KYC status...")
    payload = {
        "jit_funding": {
            "token": "jit_tx_222",
            "method": "pgfs.authorization",
            "user_token": "tok_user_pending",
            "amount": "25.00"
        }
    }
    response = client.post("/payments/marqeta/jit", json=payload)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    assert response.status_code == 402
    assert response.json()["decline_reason"] == "COMPLIANCE_BLOCK"

    # Test 3: Rejection due to AML Flag
    print("\n[Test 3] Testing JIT Rejection due to AML Flag...")
    payload = {
        "jit_funding": {
            "token": "jit_tx_333",
            "method": "pgfs.authorization",
            "user_token": "tok_user_aml",
            "amount": "25.00"
        }
    }
    response = client.post("/payments/marqeta/jit", json=payload)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    assert response.status_code == 402
    assert response.json()["decline_reason"] == "COMPLIANCE_BLOCK"

    # Test 4: Rejection due to Velocity Limit (Exceeds daily spend limit)
    print("\n[Test 4] Testing JIT Rejection due to Daily Velocity limit...")
    payload = {
        "jit_funding": {
            "token": "jit_tx_444",
            "method": "pgfs.authorization",
            "user_token": "tok_user_approved",
            "amount": "300.00" # Limit is 200
        }
    }
    response = client.post("/payments/marqeta/jit", json=payload)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    assert response.status_code == 402
    assert response.json()["decline_reason"] == "VELOCITY_LIMIT_EXCEEDED"

    # Test 5: Rejection due to Insufficient Funds (Exceeds remaining bonus_credits)
    print("\n[Test 5] Testing JIT Rejection due to Insufficient Balance...")
    user_approved.bonus_credits = 50
    db.commit()
    payload = {
        "jit_funding": {
            "token": "jit_tx_555",
            "method": "pgfs.authorization",
            "user_token": "tok_user_approved",
            "amount": "100.00" # Exceeds balance (50) but is under daily limit (200)
        }
    }
    response = client.post("/payments/marqeta/jit", json=payload)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    assert response.status_code == 402
    assert response.json()["decline_reason"] == "INSUFFICIENT_FUNDS"

    # Test 6: Commando Mode Fallback (Latency > 1,000ms triggers 504 Gateway Timeout)
    print("\n[Test 6] Testing Commando Mode Fallback with 1.2s simulated delay...")
    payload = {
        "jit_funding": {
            "token": "jit_tx_666",
            "method": "pgfs.authorization",
            "user_token": "tok_user_approved",
            "amount": "10.00"
        },
        "simulate_latency": 1.2
    }
    
    t0 = time.time()
    response = client.post("/payments/marqeta/jit", json=payload)
    elapsed = (time.time() - t0) * 1000
    
    print(f"Status: {response.status_code}")
    print(f"Elapsed: {elapsed:.2f}ms")
    print(f"Response: {response.json()}")
    
    assert response.status_code == 504
    assert "Commando Mode Fallback" in response.json()["detail"]

    # Test 7: Verify monthly Marqeta submission logs are properly formatted
    print("\n[Test 7] Verifying structured audit log formatting...")
    audit_log_path = "logs/marqeta_compliance_audit.log"
    assert os.path.exists(audit_log_path), "Audit log file is missing!"
    
    with open(audit_log_path, "r") as f:
        log_lines = f.readlines()
        
    print(f"Found {len(log_lines)} logged events in marqeta_compliance_audit.log:")
    approved_found = False
    kyc_declined_found = False
    commando_found = False
    
    for line in log_lines:
        try:
            entry = json.loads(line.strip())
            print(f" - {entry['event_type']} for {entry['user_token']}: {entry['status']}")
            # Assert schema details are present
            assert "timestamp" in entry
            assert "event_type" in entry
            assert "user_token" in entry
            
            if entry["event_type"] == "JIT_AUTHORIZATION_APPROVED":
                approved_found = True
            if entry["event_type"] == "COMPLIANCE_BLOCK_AML_KYC":
                kyc_declined_found = True
            if entry["event_type"] == "COMMANDO_MODE_FALLBACK":
                commando_found = True
        except Exception as e:
            print(f"Failed parsing log line: {line}. Error: {e}")
            
    assert approved_found, "Approved log entry not found"
    assert kyc_declined_found, "KYC/AML decline entry not found"
    assert commando_found, "Commando mode fallback entry not found"
    print("[OK] Audit logs verified.")

    # 8. Clean up
    print("\nCleaning up test database records...")
    db.query(DBProfile).filter(DBProfile.id.startswith("test_jit_")).delete()
    db.commit()
    db.close()
    print("ALL MARQETA JIT AND FALLBACK TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_jit_tests()
