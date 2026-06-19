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
from models import SessionLocal, DBProfile, DBCard
from fastapi.testclient import TestClient

# Create the test client
client = TestClient(app)

def run_test():
    db = SessionLocal()
    
    # 1. Clean up any existing test data to start fresh
    db.query(DBCard).filter(DBCard.user_id == "user_test_pending").delete()
    db.query(DBProfile).filter(DBProfile.id == "user_test_pending").delete()
    db.commit()
    
    print("Seeding test user profile with kyc_status='PENDING'...")
    # 2. Seed a test user with kyc_status="PENDING"
    test_profile = DBProfile(
        id="user_test_pending",
        first_name="Pending",
        last_name="Test User",
        email="pending@test.com",
        kyc_status="PENDING",
        aml_flagged=False
    )
    db.add(test_profile)
    db.commit()
    
    # 3. Call financials mint route
    print("Attempting to mint VCC for pending user...")
    payload = {
        "label": "Pending VCC Test",
        "funding_source_id": "stripe_src_123"
    }
    headers = {
        "x-user-id": "user_test_pending"
    }
    
    response = client.post("/financials/mint", json=payload, headers=headers)
    print(f"Response Status Code: {response.status_code}")
    print(f"Response JSON: {response.json()}")
    
    # 4. Assert response is 403 Forbidden
    assert response.status_code == 403, f"Expected status code 403, got {response.status_code}"
    assert "KYC verification pending or rejected" in response.json().get("detail", ""), "Expected KYC error message"
    print("TEST PASSED: VCC minting correctly blocked for PENDING KYC profiles.")
    
    # 5. Clean up
    print("Cleaning up test data...")
    db.query(DBCard).filter(DBCard.user_id == "user_test_pending").delete()
    db.query(DBProfile).filter(DBProfile.id == "user_test_pending").delete()
    db.commit()
    db.close()

if __name__ == "__main__":
    run_test()
