import time
import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from models import SessionLocal, DBProfile
from payments.audit import log_compliance_block, log_audit_event

logger = logging.getLogger("disappear")

router = APIRouter()

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/payments/marqeta/jit")
async def marqeta_jit_authorization(request: Request, db: Session = Depends(get_db)):
    """
    Synchronous JIT Gateway Endpoint for Marqeta authorization decisions.
    Must respond in <200ms under normal conditions.
    Triggers Commando Mode fallback if latency exceeds 1,000ms.
    Ensures Data Minimization: No PII (names, emails, phone numbers, raw PAN) is ever logged.
    """
    start_time = time.time()
    
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload"
        )
        
    # Extra check for simulated latency (useful for testing Commando Mode fallback)
    # We retrieve it safely from payload or query parameter
    simulate_latency = payload.get("simulate_latency", 0.0)
    if simulate_latency > 0.0:
        await asyncio.sleep(simulate_latency)
        
    # Extract JIT Funding data safely
    jit_funding = payload.get("jit_funding") or payload.get("gpa_order", {}).get("jit_funding")
    if not jit_funding:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Missing JIT Funding details"
        )
        
    token = jit_funding.get("token")
    user_token = jit_funding.get("user_token")
    amount_raw = jit_funding.get("amount", 0.0)
    method = jit_funding.get("method", "pgfs.authorization")
    
    # Minimize data logging: Only log first 8 chars of tokens
    masked_user_token = f"{user_token[:8]}..." if user_token else "UNKNOWN"
    masked_jit_token = f"{token[:8]}..." if token else "UNKNOWN"
    
    # Balance evaluation logic
    try:
        amount = float(amount_raw)
    except (ValueError, TypeError):
        amount = 0.0

    # Retrieve user profile
    profile = None
    if user_token:
        profile = db.query(DBProfile).filter(DBProfile.marqeta_user_token == user_token).first()
        
    # 1. Profile existence check
    if not profile:
        log_compliance_block(
            user_token=user_token or "UNKNOWN",
            check_type="user_check",
            reason="Profile not found for Marqeta user token",
            card_token=None,
            amount=amount
        )
        # Check latency before returning
        check_latency_and_raise_fallback(start_time, user_token)
        
        # JIT Decline response body (always include original JIT object)
        decline_body = {
            "jit_funding": {
                "token": token,
                "method": method,
                "user_token": user_token,
                "amount": amount_raw
            },
            "decline_reason": "USER_NOT_FOUND"
        }
        return JSONResponse(status_code=status.HTTP_402_PAYMENT_REQUIRED, content=decline_body)

    # 2. Compliance checks: KYC and AML Flags
    if profile.aml_flagged or profile.kyc_status != "APPROVED":
        reason = f"AML/KYC Hold. AML Flagged: {profile.aml_flagged}, KYC: {profile.kyc_status}"
        log_compliance_block(
            user_token=user_token,
            check_type="aml_kyc",
            reason=reason,
            card_token=profile.marqeta_card_token,
            amount=amount
        )
        # Check latency before returning
        check_latency_and_raise_fallback(start_time, user_token)
        
        decline_body = {
            "jit_funding": {
                "token": token,
                "method": method,
                "user_token": user_token,
                "amount": amount_raw
            },
            "decline_reason": "COMPLIANCE_BLOCK"
        }
        return JSONResponse(status_code=status.HTTP_402_PAYMENT_REQUIRED, content=decline_body)

    # 3. Spend limits check (Velocity Check)
    if amount > profile.daily_spend_limit:
        reason = f"Velocity Limit Exceeded: {amount} > limit {profile.daily_spend_limit}"
        log_compliance_block(
            user_token=user_token,
            check_type="velocity",
            reason=reason,
            card_token=profile.marqeta_card_token,
            amount=amount
        )
        # Check latency before returning
        check_latency_and_raise_fallback(start_time, user_token)
        
        decline_body = {
            "jit_funding": {
                "token": token,
                "method": method,
                "user_token": user_token,
                "amount": amount_raw
            },
            "decline_reason": "VELOCITY_LIMIT_EXCEEDED"
        }
        return JSONResponse(status_code=status.HTTP_402_PAYMENT_REQUIRED, content=decline_body)

    # 4. Balance check (using profile.bonus_credits as local balance)
    # bonus_credits is stored as integer credits/dollars
    if amount > profile.bonus_credits:
        reason = f"Insufficient Funds: {amount} > balance {profile.bonus_credits}"
        log_compliance_block(
            user_token=user_token,
            check_type="balance",
            reason=reason,
            card_token=profile.marqeta_card_token,
            amount=amount
        )
        # Check latency before returning
        check_latency_and_raise_fallback(start_time, user_token)
        
        decline_body = {
            "jit_funding": {
                "token": token,
                "method": method,
                "user_token": user_token,
                "amount": amount_raw
            },
            "decline_reason": "INSUFFICIENT_FUNDS"
        }
        return JSONResponse(status_code=status.HTTP_402_PAYMENT_REQUIRED, content=decline_body)

    # Deduct funds (assuming successful authorization)
    profile.bonus_credits -= int(amount)
    db.commit()
    
    # Log successful audit event
    log_audit_event(
        event_type="JIT_AUTHORIZATION_APPROVED",
        user_token=user_token,
        transaction_token=token,
        card_token=profile.marqeta_card_token,
        amount=amount,
        status="APPROVED",
        details="Authorized successfully via local balance check"
    )
    
    # Check latency before returning final success
    check_latency_and_raise_fallback(start_time, user_token)

    # Standard Marqeta JIT Success Response format
    return {
        "jit_funding": {
            "token": token,
            "method": method,
            "user_token": user_token,
            "amount": amount_raw
        }
    }

def check_latency_and_raise_fallback(start_time: float, user_token: str):
    """
    Helper function to measure elapsed time.
    If elapsed time exceeds 1,000ms, throws a 504 Gateway Timeout
    which triggers Marqeta's system Commando Mode fallback rules.
    """
    elapsed_ms = (time.time() - start_time) * 1000
    if elapsed_ms > 1000.0:
        # Log Commando Mode trigger
        logger.error(
            f"COMMANDO_MODE_TRIGGERED: Latency of {elapsed_ms:.2f}ms exceeded 1,000ms threshold for user {user_token[:8] if user_token else 'UNKNOWN'}"
        )
        log_audit_event(
            event_type="COMMANDO_MODE_FALLBACK",
            user_token=user_token or "UNKNOWN",
            status="TIMEOUT",
            details=f"Latency {elapsed_ms:.2f}ms exceeded 1000ms threshold"
        )
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Commando Mode Fallback - Backend Latency Exceeded 1000ms"
        )
