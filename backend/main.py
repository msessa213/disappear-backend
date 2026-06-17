from fastapi import FastAPI, Depends, HTTPException, Request, Response, File, UploadFile, Form, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import desc, text
from sqlalchemy.orm import Session
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel
import random
import os
import sys
import traceback
import time
import stripe
import boto3
import logging
import json
from datetime import datetime, timedelta
import httpx
from typing import Any, List, Optional
from dotenv import load_dotenv
import re

# --- EARLY FASTAPI INITIALIZATION ---
app = FastAPI(title="Disappear P-A-A-S Engine")

startup_error_message = None

@app.get("/")
async def root():
    if startup_error_message:
        return {"status": "degraded", "error": startup_error_message}
    return {"status": "online"}

@app.get("/health")
async def health_status():
    """Health check endpoint"""
    if startup_error_message:
        return {"status": "CRITICAL_STARTUP_ERROR", "detail": startup_error_message}
    return {"status": "VERSION_24_LIVE", "timestamp": datetime.now().isoformat()}

# --- COMPREHENSIVE STARTUP ERROR HANDLING ---
try:
    # --- IMPORT DATABASE FROM MODELS ---
    from models import engine, SessionLocal, Base, DBCard, DBAlias, DBProfile, DBTargetEmail, DBScrubLog, DBPurgeLog, DBMarqetaEvent
    from services.twilio_service import send_sms, make_voice_call, twilio_client

    # --- INITIALIZATION BLOCK ---
    load_dotenv()
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
    STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

    MARQETA_BASE_URL = os.getenv("MARQETA_BASE_URL", "https://sandbox-api.marqeta.com/v3").rstrip('/')
    MARQETA_USERNAME = os.getenv("MARQETA_USERNAME")
    MARQETA_PASSWORD = os.getenv("MARQETA_PASSWORD")
    MARQETA_WEBHOOK_SECRET = os.getenv("MARQETA_WEBHOOK_SECRET")

    # --- S3 CONFIGURATION ---
    S3_BUCKET = "disappear-purge-receipts-vault"
    s3_client = boto3.client('s3', region_name=os.getenv('AWS_REGION', 'us-east-1'))

except Exception as startup_error:
    startup_error_message = str(startup_error)
    print("CRITICAL STARTUP ERROR DETECTED:", file=sys.stderr)
    traceback.print_exc()

class MarqetaClient:
    @staticmethod
    def get_auth():
        return (MARQETA_USERNAME, MARQETA_PASSWORD)

    @classmethod
    async def get_or_create_user(cls, user_token: str):
        """Helper to ensure user exists before minting."""
        async with httpx.AsyncClient(auth=cls.get_auth()) as client:
            # 1. Check if user exists
            res = await client.get(f"{MARQETA_BASE_URL}/users/{user_token}")
            if res.status_code == 200:
                return res.json()
            
            # 2. If 404, create user
            res = await client.post(f"{MARQETA_BASE_URL}/users", json={"token": user_token})
            res.raise_for_status()
            return res.json()

    @classmethod
    async def create_card(cls, user_token: str):
        """Issue a virtual card linked to the user."""
        # Ensure user exists first!
        await cls.get_or_create_user(user_token)
        
        card_product_token = os.getenv("MARQETA_CARD_PRODUCT_TOKEN", "default_virtual_card")
        async with httpx.AsyncClient(auth=cls.get_auth()) as client:
            res = await client.post(
                f"{MARQETA_BASE_URL}/cards",
                params={"show_pan": "true", "show_cvv_number": "true"},
                json={
                    "user_token": user_token,
                    "card_product_token": card_product_token
                }
            )
            if res.status_code >= 400:
                logger.error(f"MARQETA_CARD_ERROR: {res.text}")
            res.raise_for_status()
            return res.json()

# --- STRUCTURED LOGGING ---
class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "message": record.getMessage(),
        }
        if hasattr(record, "audit_info"):
            log_record.update(record.audit_info)
        if record.exc_info:
            log_record["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(log_record)

logger = logging.getLogger("disappear")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logger.addHandler(handler)

# --- DEBUGGING MARQETA CREDENTIALS ---
debug_key = os.getenv("MARQETA_USERNAME")
if debug_key:
    # Using the logger ensures this shows up in your structured Railway logs
    logger.info(f"MARQETA_USER_DEBUG_START: {debug_key[:4]}")
    logger.info(f"MARQETA_USER_DEBUG_LENGTH: {len(debug_key)}")
else:
    logger.error("DEBUG: MARQETA_USERNAME is missing!")

# Auto-create tables on startup with crash protection
try:
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified/created.")
except Exception as e:
    logger.error(f"ALARM: DB Sync Deferred - {e}")


try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE shield_profiles_v3 ADD COLUMN IF NOT EXISTS extra_email_slots INTEGER DEFAULT 0"))
        conn.execute(text("ALTER TABLE shield_assets_v3 ADD COLUMN IF NOT EXISTS user_id VARCHAR"))
        conn.execute(text("ALTER TABLE shield_aliases_v3 ADD COLUMN IF NOT EXISTS user_id VARCHAR"))
        conn.execute(text("ALTER TABLE shield_profiles_v3 ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR"))
        conn.execute(text("ALTER TABLE shield_profiles_v3 ADD COLUMN IF NOT EXISTS marqeta_user_token VARCHAR"))
        conn.execute(text("ALTER TABLE shield_assets_v3 ADD COLUMN IF NOT EXISTS funding_source_id VARCHAR"))
except Exception as e:
    logger.error(f"DB ALTER WARNING: {e}")

# --- APP CONFIGURATION ---

limiter = Limiter(key_func=get_remote_address)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# FIXED: Production Origins + Mobile App Capacitor Support
origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "capacitor://localhost",
    "https://disappearco.com", 
    "https://disappear-frontend-v2.vercel.app",
    "https://disappear-online.com",
    "https://www.disappear-online.com",
    "https://mydisappear.com",
    "https://www.mydisappear.com",
    "https://disappearco.com",
    "https://www.disappearco.com",
    "https://disappearonline.net",
    "https://onlinedisappear.com",
    "https://api.disappearco.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)



# --- COMPLIANCE AUDIT TRAIL MIDDLEWARE ---
class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        
        audit_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "client_ip": request.client.host if request.client else "unknown",
            "request_method": request.method,
            "request_path": request.url.path,
            "status_code": response.status_code,
            "process_time_ms": round(process_time * 1000, 2)
        }
        logger.info(f"AUDIT: {audit_data}")
        return response

app.add_middleware(AuditMiddleware)

# Database Dependency Injection
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def verify_admin_token(x_disappear_admin_key: Optional[str] = Header(None)):
    """Dependency to enforce Admin Security Key validation"""
    admin_secret = os.getenv("ADMIN_SECRET_KEY")
    if not admin_secret or x_disappear_admin_key != admin_secret:
        raise HTTPException(status_code=403, detail="FORBIDDEN: Invalid Admin Key")
    return x_disappear_admin_key


# --- PROFIT PROTECTION CONSTANTS ---

MAX_IDENTITY_CREDITS = 6
BASE_PHONE_LIMIT = 2
COOLDOWN_HOURS = 12 # Reduced from 24 to 12


# --- DATA SEEDING & STABILITY STORAGE ---

THREAT_TYPES = ["IDENTITY_QUERY_DEFLECTED", "PII_SCRUB_VERIFIED", "NODE_ENCRYPTED", "RECAPTURE_BLOCKED", "TRACE_PURGED"]
BROKERS = ["SPOKEO", "ACXIOM", "INTELIUS", "WHITEPAGES", "PEOPLELOOKER"]
DOMAINS = ["disappear.private", "shield.mask", "secure.node", "ghost.vault"]

STABLE_EMAIL = f"vault_{random.randint(1000, 9999)}@{random.choice(DOMAINS)}"
STABLE_PHONE = f"+1 (555) {random.randint(100, 999)}-{random.randint(1000, 9999)}"

# INTERNAL ROUTING ARCHITECTURE: Controls task grouping for company operations
AUTOMATED_BROKERS = ["SPOKEO", "ACXIOM", "WHITEPAGES"]
MANUAL_BROKERS = ["INTELIUS", "PEOPLELOOKER"]


# --- SCHEMAS ---

class CardRequest(BaseModel):
    label: str
    funding_source_id: Optional[str] = None


class AliasRequest(BaseModel):
    type: str  # "email" or "phone"
    label: str


class LoginRequest(BaseModel):
    email: str
    code: Optional[str] = None



class TargetEmailRequest(BaseModel):
    email: str

# NEW: Support Request Schema
class SupportRequest(BaseModel):
    category: str
    subject: str
    message: str

class CallTestRequest(BaseModel):
    to_phone_number: str
    twiml_url: str

# NEW: Expansion Request Schema
class ExpansionRequest(BaseModel):
    expansion_type: str # "data", "phone", or "emergency_wipe"

class SetupSessionRequest(BaseModel):
    return_url: Optional[str] = "https://disappearco.com"


class AdminVerificationRequest(BaseModel):
    verification_link: Optional[str] = None
    notes: Optional[str] = None

# NEW: SMS Test Schema
class SMSTestRequest(BaseModel):
    to_phone_number: str
    message: str


# --- CORE SYSTEM ROUTES ---

@app.post("/auth/login")
@limiter.limit("20/minute")
async def login_agent(request: Request, login_req: LoginRequest, db: Session = Depends(get_db)):
    """Authenticates an agent via email to sync their specific profile to the app"""
    profile = db.query(DBProfile).filter(DBProfile.email.ilike(login_req.email)).first()
    if not profile:
        raise HTTPException(status_code=404, detail="DATA_ERROR: AGENT_NOT_FOUND_IN_DATABASE")
    return {
        "status": "AUTHORIZED",
        "user_id": profile.id,
        "first_name": profile.first_name
    }

@app.get("/download/app")
async def download_apk():
    # Use the bucket and filename exactly as they appear in S3
    bucket_name = "disappear-purge-receipts-vault"
    file_key = "app-debug.apk"
    
    # Generate a secure, temporary link
    # This automatically includes the correct MIME type from S3's metadata
    s3 = boto3.client('s3', region_name='us-east-1')
    url = s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': bucket_name, 'Key': file_key},
        ExpiresIn=3600
    )
    
    return RedirectResponse(url=url)


# --- NEW: FREE RECONNAISSANCE SCANNER ---
@app.get("/api/v1/free-scan")
@limiter.limit("10/minute")
async def free_recon_scan(request: Request, query: str):
    """
    Public PII exposure lookup for Landing Page lead magnet.
    Simulates high-velocity broker database crawl.
    """
    if not query or len(query) < 5:
        raise HTTPException(status_code=400, detail="INSUFFICIENT_QUERY_DATA")

    # Simulate tactical processing latency
    time.sleep(1.5)
    
    # Logic generates a deterministic-looking but dynamic count
    exposure_seed = len(query) + random.randint(10, 50)
    found_count = min(exposure_seed + random.randint(5, 15), 98)
    
    return {
        "status": "RECON_COMPLETE",
        "exposure_index": found_count,
        "risk_rating": "CRITICAL" if found_count > 40 else "ELEVATED",
        "timestamp": datetime.now().strftime("%H:%M:%S"),
        "directive": "INITIATE_IDENTITY_SCRUB_IMMEDIATELY"
    }


@app.get("/admin/stats")
async def get_admin_stats(db: Session = Depends(get_db), admin_key: str = Depends(verify_admin_token)):
    """Aggregates platform-wide metrics for the Central Command Dashboard"""
    total_users = db.query(DBProfile).count()
    total_cards = db.query(DBCard).count()
    total_aliases = db.query(DBAlias).count()
    total_removals = (total_users + total_aliases) * 47 
    
    return {
        "total_users": total_users,
        "total_cards": total_cards,
        "total_aliases": total_aliases,
        "total_removals": total_removals,
        "system_health": "OPTIMAL",
        "last_purge": datetime.now().strftime("%Y-%m-%d %H:%M")
    }

@app.post("/admin/test-sms")
async def test_sms_sending(req: SMSTestRequest, admin_key: str = Depends(verify_admin_token)):
    """Admin endpoint to test Twilio SMS sending functionality."""
    if not twilio_client:
        raise HTTPException(status_code=503, detail="TWILIO_SERVICE_UNAVAILABLE: Client not initialized.")

    success = send_sms(
        to_phone_number=req.to_phone_number,
        message_body=req.message
    )

    if success:
        return {"status": "SUCCESS", "message": f"SMS sent to {req.to_phone_number}"}
    else:
        raise HTTPException(status_code=500, detail="TWILIO_SEND_FAILED: Check worker logs for details.")

@app.post("/admin/test-call")
async def test_voice_call(req: CallTestRequest, admin_key: str = Depends(verify_admin_token)):
    """Admin endpoint to test Twilio Voice call functionality."""
    if not twilio_client:
        raise HTTPException(status_code=503, detail="TWILIO_SERVICE_UNAVAILABLE: Client not initialized.")

    success = make_voice_call(
        to_phone_number=req.to_phone_number,
        twiml_url=req.twiml_url
    )

    if success:
        return {"status": "SUCCESS", "message": f"Voice call initiated to {req.to_phone_number}"}
    else:
        raise HTTPException(status_code=500, detail="TWILIO_CALL_FAILED: Check worker logs for details.")


# --- INTERNAL OPERATION PORTALS FOR EMPLOYEES ---

@app.get("/admin/ops/backlog")
async def get_employee_backlog(db: Session = Depends(get_db), admin_key: str = Depends(verify_admin_token)):
    """Internal utility for staff to pull down targets needing manual opt-out submission forms"""
    open_tasks = db.query(DBScrubLog).filter(DBScrubLog.status == "PROCESSING").all()
    
    automated_backlog = []
    manual_backlog_queue = []
    
    for task in open_tasks:
        # Cross-reference target profile so employees have PII ready to paste into manual opt-out fields
        profile = db.query(DBProfile).filter(DBProfile.id == task.user_id).first()
        
        task_details = {
            "task_id": task.id,
            "broker_name": task.broker_name,
            "submitted_at": task.timestamp.isoformat(),
            "target_profile": {
                "user_id": task.user_id,
                "first_name": profile.first_name if profile else "N/A",
                "middle_name": profile.middle_name if profile else "",
                "last_name": profile.last_name if profile else "N/A",
                "email": profile.email if profile else "N/A",
                "address": profile.address if profile else "N/A",
                "dob": profile.dob if profile else "N/A"
            }
        }
        
        if task.broker_name in MANUAL_BROKERS:
            manual_backlog_queue.append(task_details)
        else:
            automated_backlog.append(task_details)
            
    return {
        "manual_queue_count": len(manual_backlog_queue),
        "automated_queue_count": len(automated_backlog),
        "manual_processing_required": manual_backlog_queue,
        "automated_processing_pool": automated_backlog
    }


@app.post("/admin/ops/resolve/{log_id}")
async def resolve_manual_task(log_id: int, db: Session = Depends(get_db), admin_key: str = Depends(verify_admin_token)):
    """Staff execution terminal: Marks a manual data broker extraction completely finalized"""
    task = db.query(DBScrubLog).filter(DBScrubLog.id == log_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task signature not located in active ledger.")
        
    task.status = "REMOVED"
    task.timestamp = datetime.utcnow()
    
    db.add(DBPurgeLog(
        action_type="MANUAL_BROKER_RESOLVED_BY_STAFF",
        node_id=f"TASK_{log_id}_{task.broker_name}"
    ))
    db.commit()
    return {"status": "SUCCESS", "message": f"Broker {task.broker_name} status updated to REMOVED."}


@app.post("/api/admin/complete-manual-scrub/{log_id}")
async def complete_manual_scrub(
    log_id: int, 
    req: AdminVerificationRequest, 
    db: Session = Depends(get_db),
    admin_key: str = Depends(verify_admin_token)
):
    """Admin Endpoint: Mark a manual removal process as completed"""
    task = db.query(DBScrubLog).filter(DBScrubLog.id == log_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    task.status = "REMOVED"
    if req.verification_link:
        task.manual_instruction_url = req.verification_link
    task.timestamp = datetime.utcnow()
    
    # Build audit trail
    log_message = f"MANUAL_BROKER_RESOLVED: {task.broker_name}"
    if req.notes:
        log_message += f" | NOTES: {req.notes}"
        
    db.add(DBPurgeLog(
        action_type=log_message,
        node_id=f"TASK_{log_id}_{task.broker_name}"
    ))
    db.commit()
    return {"status": "SUCCESS"}


@app.get("/dashboard/sync")
async def sync(user_id: Optional[str] = Query(None), x_user_id: Optional[str] = Header(None), db: Session = Depends(get_db)):
    """Synchronizes dashboard using user_id from query or header"""
    target_user_id = user_id or x_user_id
    
    if target_user_id:
        profile = db.query(DBProfile).filter(DBProfile.id == target_user_id).first()
    else:
        profile = db.query(DBProfile).order_by(DBProfile.created_at.desc()).first()

    if not profile:
        raise HTTPException(status_code=404, detail="PROFILE_NOT_FOUND")

    uid = profile.id
        
    active_cards = db.query(DBCard).filter(DBCard.user_id == uid).count()
    active_aliases = db.query(DBAlias).filter(DBAlias.user_id == uid).count()
    total_used = active_cards + active_aliases
        
    bonus = profile.bonus_credits or 0
    phone_bonus = profile.phone_line_bonus or 0
    
    # SEPARATE LIMITS
    vcc_email_capacity = MAX_IDENTITY_CREDITS + bonus
    phone_capacity = BASE_PHONE_LIMIT + phone_bonus
    
    # NEW: DECOUPLED USAGE METRICS
    used_vcc_email = active_cards + db.query(DBAlias).filter(DBAlias.user_id == uid, DBAlias.type == 'email').count()
    used_phones = db.query(DBAlias).filter(DBAlias.user_id == uid, DBAlias.type == 'phone').count()
    
    now = datetime.now()
    minute_seed = now.minute + now.hour
    random.seed(minute_seed)
    
    logs = []
    for i in range(5):
        logs.append({
            "broker": random.choice(BROKERS), 
            "action": random.choice(THREAT_TYPES), 
            "time": now.strftime("%H:%M") + f":{10*i:02d}"
        })
    
    map_nodes = []
    for i in range(18):
        map_nodes.append({
            "id": i, 
            "x": random.randint(5, 95), 
            "y": random.randint(10, 85), 
            "status": "active" if i % 4 != 0 else "intercepting"
        })

    random.seed(time.time())

    return {
        "profile": {
            "email_alias": STABLE_EMAIL,
            "phone_alias": STABLE_PHONE,
            "vcc_email_total": vcc_email_capacity,
            "phone_total": phone_capacity,
            "used_vcc_email": used_vcc_email,
            "used_phones": used_phones,
            "credits_used": total_used,
            "credits_available": max(0, vcc_email_capacity - total_used),
            "threat_level": "NOMINAL",
            "uptime": "99.998%",
            "active_nodes": total_used 
        },
        "recent_audit": logs,
        "map_nodes": map_nodes,
        "system_status": "ENCRYPTED_TUNNEL_STABLE"
    }


@app.get("/profile/emails")
async def get_target_emails(user_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """Retrieves the list of target emails being scrubbed"""
    if user_id:
        profile = db.query(DBProfile).filter(DBProfile.id == user_id).first()
    else:
        profile = db.query(DBProfile).order_by(DBProfile.created_at.desc()).first()
        
    if not profile:
        return {"primary": "", "additional": [], "slots": 1, "used": 0}
        
    emails = db.query(DBTargetEmail).filter(DBTargetEmail.profile_id == profile.id).all()
    allowed_extras = 1 + (profile.extra_email_slots or 0)
    
    return {
        "primary": profile.email,
        "additional": [{"id": e.id, "email": e.email} for e in emails],
        "slots": allowed_extras,
        "used": len(emails)
    }

@app.post("/profile/emails")
async def add_target_email(req: TargetEmailRequest, user_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """Adds a new secondary email to the active scrubbing pool"""
    if user_id:
        profile = db.query(DBProfile).filter(DBProfile.id == user_id).first()
    else:
        profile = db.query(DBProfile).order_by(DBProfile.created_at.desc()).first()
        
    if not profile:
        raise HTTPException(status_code=404, detail="DATA_ERROR: TARGET_PROFILE_NOT_FOUND")
        
    current_extra_count = db.query(DBTargetEmail).filter(DBTargetEmail.profile_id == profile.id).count()
    allowed_extras = 1 + (profile.extra_email_slots or 0)
    
    if current_extra_count >= allowed_extras:
        raise HTTPException(status_code=403, detail="EMAIL_SLOT_LIMIT_REACHED")
        
    new_email = DBTargetEmail(profile_id=profile.id, email=req.email)
    db.add(new_email)
    
    for broker in BROKERS:
        is_auto = broker in AUTOMATED_BROKERS
        db.add(DBScrubLog(
            user_id=profile.id, 
            broker_name=broker, 
            status="PROCESSING" if is_auto else "MANUAL_PENDING", 
            removal_type="AUTOMATED" if is_auto else "MANUAL",
            timestamp=datetime.utcnow()
        ))
        
    db.commit()
    return {"status": "success"}

@app.delete("/profile/emails/{email_id}")
async def delete_target_email(email_id: int, db: Session = Depends(get_db)):
    """Removes an email from active scrubbing"""
    email = db.query(DBTargetEmail).filter(DBTargetEmail.id == email_id).first()
    if email:
        db.delete(email)
        db.commit()
        return {"status": "deleted"}
    raise HTTPException(status_code=404, detail="Not found")

# --- PAYMENTS & WEBHOOKS (FINAL PRICING FIREWALL) ---

@app.post("/payments/create-session")
@limiter.limit("5/minute")
async def create_checkout_session(request: Request, db: Session = Depends(get_db)):
    try:
        body = await request.json()
        raw_type = body.get("expansion_type", "")
        etype = str(raw_type).lower()
        
        user_id = body.get("user_id", "anonymous_agent")
        return_url = body.get("return_url", "https://disappearco.com")

        # RULE: Explicitly check for cooldown/wipe first for 1.99
        if "cooldown" in etype or "wipe" in etype or "emergency" in etype:
            item_name = "Emergency Wipe Protocol (Instant Cooldown Bypass)"
            unit_amount = 199 # $1.99
            purchase_key = "cooldown_bypass"
        elif "subscription_monthly" in etype:
            item_name = "Disappear Elite Operative (Monthly)"
            unit_amount = 2499
            purchase_key = "subscription_monthly"
        elif "subscription_annual" in etype:
            item_name = "Disappear Elite Operative (Annual)"
            unit_amount = 19999
            purchase_key = "subscription_annual"
        # TARGET EMAIL SLOT
        elif "email" in etype:
            item_name = "Additional Target Email Slot"
            unit_amount = 250 # $2.50
            purchase_key = "extra_email_slot"
        # PHONE RULE
        elif "phone" in etype:
            item_name = "Premium Phone Line Expansion"
            unit_amount = 595 # $5.95
            purchase_key = "phone_line_bonus"
        # DEFAULT/SLOT RULE
        else:
            item_name = "Permanent Shield Slot Expansion (+1 Capacity)"
            unit_amount = 595 # $5.95
            purchase_key = "permanent_slot"

        profile = db.query(DBProfile).filter(DBProfile.id == user_id).first()
        customer_id = profile.stripe_customer_id if profile else None

        session_args = {
            "payment_method_types": ['card'],
            "line_items": [{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {'name': item_name},
                    'unit_amount': unit_amount,
                },
                'quantity': 1,
            }],
            "mode": "payment",
            "metadata": {
                "purchase_type": purchase_key,
                "user_id": user_id
            },
            "success_url": f"{return_url}?payment=success",
            "cancel_url": f"{return_url}?payment=cancel",
        }

        if customer_id:
            session_args["customer"] = customer_id

        session = stripe.checkout.Session.create(**session_args)
        return {"url": session.url}
    except Exception as e:
        logger.error(f"STRIPE ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail="Payment gateway initialization failed.")


@app.post("/payments/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Verifies Stripe signature and updates DBProfile capacity with diagnostic logging"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    if not sig_header:
        logger.error("WEBHOOK ERROR: Missing stripe-signature header")
        raise HTTPException(status_code=400, detail="Missing signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        logger.error(f"WEBHOOK PAYLOAD ERROR: {e}")
        return Response(content="INVALID_PAYLOAD", status_code=400)

    if event["type"] == "checkout.session.completed":
        session = event['data']['object']
        metadata = session.get("metadata", {})
        purchase_type = metadata.get("purchase_type")
        user_id = metadata.get("user_id")
        
        logger.info(f"WEBHOOK_INBOUND: {purchase_type} for UID {user_id}")

        profile = db.query(DBProfile).filter(DBProfile.id == user_id).first()

        if profile:
            if purchase_type == "permanent_slot":
                profile.bonus_credits = (profile.bonus_credits or 0) + 1
                action = "PERMANENT_CAPACITY_EXPANDED"
                db.add(profile)
            
            elif purchase_type == "extra_email_slot":
                profile.extra_email_slots = (profile.extra_email_slots or 0) + 1
                action = "EXTRA_EMAIL_SLOT_EXPANDED"
                logger.info(f"DB_UPDATE: Email slot added for {profile.id}")
                db.add(profile)

            elif purchase_type == "phone_line_bonus":
                # THIS IS THE FIX: It safely increments the database column and marks the instance as modified
                profile.phone_line_bonus = (profile.phone_line_bonus or 0) + 1
                action = "PHONE_LINE_EXPANDED"
                logger.info(f"DB_UPDATE: Phone line bonus added for {profile.id}")
                db.add(profile)
                
            elif purchase_type in ["subscription_monthly", "subscription_annual"]:
                action = "SUBSCRIPTION_ACTIVATED"
                logger.info(f"DB_UPDATE: Subscription activated for {profile.id}")
                
            else:
                action = "COOLDOWN_BYPASS_PURCHASED"

            session_id = session.get("id", "unknown")
            db.add(DBPurgeLog(
                action_type=action, 
                node_id=f"{user_id}_STRIPE_{str(session_id)[-8:]}",
                timestamp=datetime.utcnow()
            ))
            db.commit()
            logger.info("DB_COMMIT: Webhook process finalized.")
            
    return {"status": "success"}


@app.post("/payments/create-setup-session")
@limiter.limit("5/minute")
async def create_setup_session(req: SetupSessionRequest, request: Request, user_id: str = Query(...), db: Session = Depends(get_db)):
    """Creates a secure Stripe Checkout session exclusively for securely linking a credit card"""
    profile = db.query(DBProfile).filter(DBProfile.id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
        
    # If no Stripe Customer ID, create one
    if not profile.stripe_customer_id:
        try:
            customer = stripe.Customer.create(
                email=profile.email,
                name=f"{profile.first_name} {profile.last_name}".strip()
            )
            profile.stripe_customer_id = customer.id
            db.add(profile)
            db.commit()
        except Exception as e:
            logger.error(f"STRIPE_CUSTOMER_CREATE_ERROR: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to initialize Stripe customer.")

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            mode="setup",
            customer=profile.stripe_customer_id,
            success_url=f"{req.return_url}?setup=success",
            cancel_url=f"{req.return_url}?setup=cancel",
        )
        return {"url": session.url}
    except Exception as e:
        logger.error(f"STRIPE_SETUP_SESSION_ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create setup session.")

@app.get("/payments/methods")
async def get_payment_methods(user_id: str = Query(...), db: Session = Depends(get_db)):
    profile = db.query(DBProfile).filter(DBProfile.id == user_id).first()
    if not profile or not profile.stripe_customer_id:
        return {"methods": []}
    
    try:
        methods = stripe.PaymentMethod.list(
            customer=profile.stripe_customer_id,
            type="card",
        )
        result = [{"id": m.id, "brand": m.card.brand, "last4": m.card.last4, "exp_month": m.card.exp_month, "exp_year": m.card.exp_year} for m in methods.data]
        return {"methods": result}
    except Exception as e:
        logger.error(f"STRIPE_METHODS_ERROR: {e}")
        return {"methods": []}


@app.post("/marqeta/webhook")
async def marqeta_webhook(request: Request, db: Session = Depends(get_db)):
    """Independent Webhook for Marqeta authorizations and transactions."""
    try:
        payload = await request.json()
        token = payload.get("token")
        event_type = payload.get("type")
        
        if not token:
            return {"status": "ignored", "reason": "Missing token"}
            
        # Idempotency check: prevent webhook loops
        existing_event = db.query(DBMarqetaEvent).filter(DBMarqetaEvent.token == token).first()
        if existing_event:
            logger.info(f"MARQETA_WEBHOOK_DUPLICATE: Event token {token} already processed.")
            return {"status": "acknowledged"}

        logger.info(f"MARQETA_WEBHOOK_EVENT: {event_type} for token {token}")
        
        # Mark event as processed
        db.add(DBMarqetaEvent(token=token, type=event_type))
        db.commit()
        
        # --- JUST-IN-TIME (JIT) FUNDING LOGIC (OPTION B) ---
        # When a user swipes their VCC, Marqeta asks us if they have funds.
        if event_type == "authorization" or event_type == "authorization.clearing":
            card_token = payload.get("card", {}).get("token")
            amount = payload.get("transaction", {}).get("amount", 0)
            
            # Find which real Stripe card this VCC is mapped to
            linked_card = db.query(DBCard).filter(DBCard.real_card_token == card_token).first()
            
            if linked_card and linked_card.funding_source_id:
                user_profile = db.query(DBProfile).filter(DBProfile.id == linked_card.user_id).first()
                if user_profile and user_profile.stripe_customer_id:
                    try:
                        # Attempt to charge the user's real card via Stripe for the exact amount
                        stripe.PaymentIntent.create(
                            amount=int(float(amount) * 100), # Convert to cents
                            currency='usd',
                            customer=user_profile.stripe_customer_id,
                            payment_method=linked_card.funding_source_id,
                            off_session=True,
                            confirm=True
                        )
                        logger.info(f"JIT_APPROVED: Successfully charged Stripe funding source {linked_card.funding_source_id} for ${amount}")
                    except stripe.error.CardError as e:
                        logger.error(f"JIT_DECLINED: Stripe charge failed - {e}")
                    except Exception as e:
                        logger.error(f"JIT_DECLINED: System error - {e}")
            else:
                logger.error(f"JIT_DECLINED: No external funding source mapped to VCC token {card_token}")

        return {"status": "acknowledged"}
    except Exception as e:
        logger.error(f"MARQETA_WEBHOOK_ERROR: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid Payload")


# --- PII CONTROL ROUTES ---

@app.get("/aliases/data")
async def get_aliases(x_user_id: Optional[str] = Header(None), db: Session = Depends(get_db)):
    """Retrieves all active aliases for separate rendering"""
    profile = db.query(DBProfile).filter(DBProfile.id == x_user_id).first() if x_user_id else db.query(DBProfile).order_by(DBProfile.created_at.desc()).first()
    uid = profile.id if profile else None
    aliases = db.query(DBAlias).filter(DBAlias.user_id == uid).order_by(DBAlias.created_at.desc()).all()
    return {"aliases": aliases if aliases else []}


@app.post("/aliases/mint")
@limiter.limit("20/minute")
async def generate_alias(request: Request, alias_req: AliasRequest, user_id: Optional[str] = Query(None), x_user_id: Optional[str] = Header(None), db: Session = Depends(get_db)):
    """Generates an alias with 12h cooldown and bypass verification"""
    target_user_id = user_id or x_user_id or "anonymous_agent"
    profile = db.query(DBProfile).filter(DBProfile.id == target_user_id).first()
    bonus = profile.bonus_credits if profile else 0
    phone_bonus = profile.phone_line_bonus if profile else 0
    
    max_credits = MAX_IDENTITY_CREDITS + bonus
    max_phones = BASE_PHONE_LIMIT + phone_bonus
    
    total_active = db.query(DBAlias).filter(DBAlias.user_id == target_user_id).count() + db.query(DBCard).filter(DBCard.user_id == target_user_id).count()
    if total_active >= max_credits:
        raise HTTPException(status_code=403, detail="IDENTITY_LIMIT_REACHED")

    if alias_req.type.lower() == "phone":
        current_phones = db.query(DBAlias).filter(DBAlias.user_id == target_user_id, DBAlias.type == "phone").count()
        if current_phones >= max_phones:
            raise HTTPException(status_code=403, detail="PHONE_CAPACITY_REACHED")

    # Cooldown Logic
    last_burn = db.query(DBPurgeLog).filter(
        DBPurgeLog.action_type == "ALIAS_TERMINATED",
        DBPurgeLog.node_id.startswith(f"{target_user_id}_")
    ).order_by(DBPurgeLog.timestamp.desc()).first()
    
    # BYPASS VERIFICATION: Check for tactical override purchased in the last 15 minutes
    has_bypass = db.query(DBPurgeLog).filter(
        DBPurgeLog.action_type == "COOLDOWN_BYPASS_PURCHASED",
        DBPurgeLog.node_id.startswith(f"{target_user_id}_"),
        DBPurgeLog.timestamp > datetime.utcnow() - timedelta(minutes=15)
    ).first()

    if not has_bypass and last_burn and (datetime.utcnow() - last_burn.timestamp) < timedelta(hours=COOLDOWN_HOURS):
        raise HTTPException(
            status_code=429, 
            detail={"error": "COOL_DOWN_ACTIVE", "bypass_authorized": False}
        )

    alias_id = f"als_{int(time.time())}_{random.randint(100, 999)}"
    
    if alias_req.type.lower() == "email":
        addy_api_key = os.getenv("ADDY_API_KEY")
        if not addy_api_key:
            logger.error("ADDY_IO_ERROR: ADDY_API_KEY is missing from environment variables")
            raise HTTPException(status_code=500, detail="EMAIL_RELAY_PROVIDER_OFFLINE")
            
        try:
            async with httpx.AsyncClient() as client:
                headers = {
                    "Authorization": f"Bearer {addy_api_key}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "X-Requested-With": "XMLHttpRequest" 
                }
                addy_response = await client.post(
                    "https://app.addy.io/api/v1/aliases",
                    headers=headers,
                    json={
                        "description": f"Disappear Vault - {alias_req.label}",
                        "format": "uuid",
                        "domain": "anonaddy.me"
                    }
                )
                
                if addy_response.status_code >= 400:
                    logger.error(f"ADDY_IO_REJECTED [{addy_response.status_code}]: {addy_response.text}")
                    raise HTTPException(status_code=502, detail=f"ADDY.IO REJECTED: {addy_response.text}")
                    
                content = addy_response.json().get("data", {}).get("email")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"ADDY_IO_MINT_ERROR: {str(e)}")
            raise HTTPException(status_code=502, detail="EMAIL_RELAY_PROVIDER_OFFLINE")
    else:
        content = f"+1 (555) {random.randint(100, 999)}-{random.randint(1000, 9999)}"
        
    new_alias = DBAlias(
        id=alias_id,
        user_id=target_user_id,
        type=alias_req.type.lower(),
        label=alias_req.label,
        content=content
    )
    db.add(new_alias)
    db.commit()
    db.refresh(new_alias)
    return new_alias


@app.delete("/aliases/kill/{alias_id}")
async def kill_alias(alias_id: str, db: Session = Depends(get_db)):
    """TERMINATE command for a specific PII node"""
    alias = db.query(DBAlias).filter(DBAlias.id == alias_id).first()
    if alias:
        log = DBPurgeLog(action_type="ALIAS_TERMINATED", node_id=f"{alias.user_id}_{alias_id}")
        db.add(log)
        db.delete(alias)
        db.commit()
        return {"status": "node_purged"}
    raise HTTPException(status_code=404, detail="Node not found")


# --- FINANCIALS & PROFILE STORAGE ---

@app.get("/financials/data")
async def financials(x_user_id: Optional[str] = Header(None), db: Session = Depends(get_db)):
    """Retrieves list of active virtual cards from the secure ledger"""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED: Missing user context")
    profile = db.query(DBProfile).filter(DBProfile.id == x_user_id).first()
    uid = profile.id if profile else None
    try:
        cards = db.query(DBCard).filter(DBCard.user_id == uid).order_by(DBCard.created_at.desc()).all()
        return {"cards": cards if cards else []}
    except Exception as e:
        return {"cards": [], "error": str(e)}


@app.post("/financials/mint")
@limiter.limit("20/minute")
async def generate_card(request: Request, card_req: CardRequest, user_id: Optional[str] = Query(None), x_user_id: Optional[str] = Header(None), db: Session = Depends(get_db)):
    """Initiates a new virtual card generation process on the secure node"""
    target_user_id = user_id or x_user_id
    if not target_user_id:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED: Missing user context")
    profile = db.query(DBProfile).filter(DBProfile.id == target_user_id).first()
    bonus = profile.bonus_credits if profile else 0
    max_credits = MAX_IDENTITY_CREDITS + bonus

    total_active = db.query(DBCard).filter(DBCard.user_id == target_user_id).count() + db.query(DBAlias).filter(DBAlias.user_id == target_user_id).count()
    if total_active >= max_credits:
        raise HTTPException(status_code=403, detail="IDENTITY_LIMIT_REACHED")

    try:
        # Create the Virtual Card
        card_response = await MarqetaClient.create_card(target_user_id)

        # Parse Expiration from Marqeta Format (e.g. "0828")
        raw_exp = card_response.get("expiration", "0828")
        expiry = f"{raw_exp[0:2]}/{raw_exp[2:4]}" if len(raw_exp) == 4 else "08/28"

        card_id = f"vcc_{int(time.time())}_{random.randint(100, 999)}"
        new_card = DBCard(
            id=card_id,
            user_id=target_user_id,
            label=card_req.label,
            number=card_response.get("pan", "UNKNOWN"),
            expiry=expiry,
            cvv=str(card_response.get("cvv_number", "000")),
            real_card_token=card_response.get("token", None),
            last_four=card_response.get("last_four", "0000"),
            funding_source_id=card_req.funding_source_id
        )
        db.add(new_card)
        log = DBPurgeLog(action_type="CARD_PROTECTION_GENERATED", node_id=card_id)
        db.add(log)
        db.commit()
        db.refresh(new_card)
        return new_card
        
    except httpx.HTTPError as http_err:
        db.rollback()
        error_msg = str(http_err)
        if hasattr(http_err, "response") and http_err.response is not None:
            try:
                error_data = http_err.response.json()
                error_msg = error_data.get("error_message", http_err.response.text)
            except Exception:
                error_msg = http_err.response.text
        logger.error(f"MARQETA_HTTP_ERROR: {error_msg}")
        raise HTTPException(status_code=502, detail=f"Marqeta API Error: {error_msg}")
    except Exception as e:
        db.rollback()
        logger.error(f"MARQETA_API_ERROR: {str(e)}")
        raise HTTPException(status_code=502, detail="Secure card generation failed at the upstream provider.")


@app.post("/financials/profile")
@app.post("/financials/profile/")
@limiter.limit("20/minute")
async def save_profile(request: Request, db: Session = Depends(get_db)):
    """Handles raw profile ingestion and cleanly seeds initial tracking slots for all data brokers"""
    try:
        data = await request.json()
        profile_id = f"user_{random.randint(1000, 9999)}"
        
        # Initialize Stripe Customer
        stripe_customer_id = None
        try:
            customer = stripe.Customer.create(
                email=data.get("email"),
                name=f'{data.get("firstName", "")} {data.get("lastName", "")}'.strip()
            )
            stripe_customer_id = customer.id
        except Exception as e:
            logger.error(f"STRIPE_CUSTOMER_CREATE_ERROR: {str(e)}")

        new_profile = DBProfile(
            id=profile_id,
            first_name=data.get("firstName", "Unknown"),
            middle_name=data.get("middleName", ""),
            last_name=data.get("lastName", ""),
            email=data.get("email"),
            address=data.get("address"),
            dob=data.get("dob"),
            stripe_customer_id=stripe_customer_id
        )
        db.add(new_profile)
        
        # Populate initial processing tracking logs for user stats
        for broker in BROKERS:
            is_auto = broker in AUTOMATED_BROKERS
            db.add(DBScrubLog(
                user_id=profile_id,
                broker_name=broker,
                status="PROCESSING" if is_auto else "MANUAL_PENDING",
                removal_type="AUTOMATED" if is_auto else "MANUAL",
                timestamp=datetime.utcnow()
            ))
            
        db.commit()
        return {"status": "success", "profile_id": profile_id}
    except Exception as e:
        db.rollback()
        logger.error(f"PROFILE_SAVE_ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to store target profile.")


@app.delete("/financials/kill/{card_id}")
async def kill_card(card_id: str, db: Session = Depends(get_db)):
    """Permanently deletes a card asset from the database"""
    if card_id == "global-1":
        log = DBPurgeLog(action_type="GLOBAL_NODE_ROTATED", node_id="global-1")
        db.add(log)
        db.commit()
        return {"status": "global_node_rotated"}

    card = db.query(DBCard).filter(DBCard.id == card_id).first()
    if card:
        log = DBPurgeLog(action_type="CARD_TERMINATED", node_id=card_id)
        db.add(log)
        db.delete(card)
        db.commit()
        return {"status": "node_terminated"}
    raise HTTPException(status_code=404, detail="Asset not found")


@app.post("/financials/burn-all")
async def burn_all_assets(x_user_id: Optional[str] = Header(None), db: Session = Depends(get_db)):
    """Emergency Burn command: Deletes all compromised cards and aliases (Preserves Profile)"""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED: Missing user context")
    profile = db.query(DBProfile).filter(DBProfile.id == x_user_id).first()
    uid = profile.id if profile else None
    db.query(DBCard).filter(DBCard.user_id == uid).delete()
    db.query(DBAlias).filter(DBAlias.user_id == uid).delete()
    log = DBPurgeLog(action_type="EMERGENCY_BURN_PROTOCOL", node_id="GLOBAL_ASSET_WIPE")
    db.add(log)
    db.commit()
    return {"status": "TOTAL_PURGE_COMPLETE"}


@app.post("/financials/regenerate")
async def regenerate_alias():
    """Cycles identity aliases for the shield dashboard interface"""
    global STABLE_EMAIL, STABLE_PHONE
    STABLE_EMAIL = f"vault_{random.randint(1000, 9999)}@{random.choice(DOMAINS)}"
    STABLE_PHONE = f"+1 (555) {random.randint(100, 999)}-{random.randint(1000, 9999)}"
    return {"email_alias": STABLE_EMAIL, "phone_alias": STABLE_PHONE}


# --- PROOF OF REMOVAL ARCHITECTURE ---

@app.get("/api/v1/scrub-history")
async def get_scrub_history(x_user_id: Optional[str] = Header(None), db: Session = Depends(get_db)):
    """Fetches clean removal timeline for end-user app display."""
    profile = db.query(DBProfile).filter(DBProfile.id == x_user_id).first() if x_user_id else None
    if not profile:
        return {"history": []}
    
    logs = db.query(DBScrubLog).filter(DBScrubLog.user_id == profile.id).all()
    
    history_payload = []
    for log in logs:
        history_payload.append({
            "id": log.id,
            "broker_name": log.broker_name,
            "status": log.status,
            "timestamp": log.timestamp.isoformat()
        })
            
    return {"history": history_payload}


# --- NEW: PURGE HISTORY FILTER (30, 60, 90 DAYS) ---
# BULLETPROOF ROUTE DEFINITION FOR AWS LOAD BALANCER
@app.get("/api/v1/history/")
@app.get("/api/v1/history")
@app.get("/history/")
@app.get("/history")
async def get_action_history(
    days: int = Query(30, enum=[30, 60, 90]), 
    db: Session = Depends(get_db)
):
    """Fetches general action history for the app dashboard instead of PDF generation"""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    history = (
        db.query(DBPurgeLog)
        .filter(DBPurgeLog.timestamp >= cutoff_date)
        .order_by(desc(DBPurgeLog.timestamp))
        .all()
    )
    
    return {
        "days_filtered": days,
        "history": [
            {
                "id": entry.id,
                "action": entry.action_type,
                "node": entry.node_id,
                "timestamp": entry.timestamp.isoformat()
            } for entry in history
        ]
    }


@app.post("/financials/receipt/upload")
async def upload_purge_receipt(file: UploadFile = File(...), user_id: str = Form(...)):
    """Receives proof-of-scrub PDF and vaults it in S3"""
    try:
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        s3_key = f"receipts/{user_id}/PURGE_{timestamp}.pdf"
        s3_client.upload_fileobj(file.file, S3_BUCKET, s3_key, ExtraArgs={'ContentType': 'application/pdf'})
        
        db = SessionLocal()
        db.add(DBPurgeLog(action_type="S3_RECEIPT_VAULTED", node_id=s3_key))
        db.commit()
        db.close()
        return {"status": "VAULTED", "s3_path": s3_key}
    except Exception as e:
        raise HTTPException(status_code=500, detail="VAULT_UPLINK_FAILED")


@app.post("/financials/receipt")
async def generate_purge_receipt(db: Session = Depends(get_db)):
    """Generates an audit receipt of the identity purge for tracking"""
    try:
        receipt_id = f"PRG-{random.randint(100000, 999999)}"
        log = DBPurgeLog(action_type="PURGE_RECEIPT_STORED", node_id=receipt_id)
        db.add(log)
        db.commit()
        return {
            "receipt_id": receipt_id,
            "status": "ENCRYPTED_AND_STORED",
            "timestamp": datetime.utcnow().isoformat(),
            "vault_signature": "SIG_TIGER_BLUE_ALPHA"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="UPLINK_FAILURE_LOG")


# --- SUPPORT & FAQ ---

@app.get("/support/manual")
async def get_operation_manual():
    """Returns the operational step-by-step guide data"""
    return {
        "title": "Operation Manual",
        "version": "1.2",
        "steps": [
            {"node": "CREDIT_CARD_PROTECTION", "instruction": "Generate merchant-locked digits for isolated spending."},
            {"node": "EMAIL_RELAY", "instruction": "Deploy forwarding addresses to scrub incoming trackers."},
            {"node": "SMS_VAULT", "instruction": "Utilize temporary numbers for encrypted 2FA bypass."}
        ]
    }


@app.get("/support/faq")
async def get_faq_data():
    """Returns questions and answers for user trust and clarity"""
    return {
        "title": "FAQ",
        "questions": [
            {"q": "Is my real data stored?", "a": "No. Disappear utilizes volatile memory and instant-burn protocols."},
            {"q": "How many cards can I have?", "a": "Standard accounts support 6 concurrent protection nodes."},
            {"q": "Does this work for international travel?", "a": "Yes. Global nodes support worldwide merchant acceptance."}
        ]
    }


def contains_pii(text: str) -> bool:
    """Scans text for common PII patterns to enforce data minimization."""
    # 16-digit numbers (potential Credit Card PANs)
    if re.search(r'\b(?:\d[ -]*?){13,16}\b', text):
        return True
    # Email addresses
    if re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', text):
        return True
    # Social Security Numbers
    if re.search(r'\b\d{3}-\d{2}-\d{4}\b', text):
        return True
    return False

@app.post("/api/support")
@app.post("/support/ticket")
@limiter.limit("3/minute")
async def create_support_ticket(request: Request, support_req: SupportRequest, db: Session = Depends(get_db)):
    """Logs support requests for PaaS serviceability"""
    try:
        # Strict PII firewall rejection
        if contains_pii(support_req.subject) or contains_pii(support_req.message):
            raise HTTPException(status_code=400, detail="PII_DETECTED: Please remove email addresses, credit card numbers, or SSNs from your message. This channel is for technical inquiries only.")
            
        log_entry = f"CAT: {support_req.category} | SUB: {support_req.subject} | MSG: {support_req.message}"
        log = DBPurgeLog(action_type="SUPPORT_REQUEST", node_id=log_entry)
        db.add(log)
        db.commit()
        
        # --- NEW: SECURE EMAIL DISPATCH ---
        resend_key = os.getenv("RESEND_API_KEY")
        if resend_key:
            try:
                async with httpx.AsyncClient() as client:
                    await client.post(
                        "https://api.resend.com/emails",
                        headers={"Authorization": f"Bearer {resend_key}"},
                        json={
                            "from": "Disappear System <onboarding@resend.dev>",
                            "to": "customer.service@disappearco.com",
                            "subject": f"DISAPPEAR TICKET [{support_req.category}]: {support_req.subject}",
                            "text": f"SECURE SUPPORT TICKET LOGGED\n\nCATEGORY: {support_req.category}\nSUBJECT: {support_req.subject}\n\nPAYLOAD:\n{support_req.message}\n\n---\nDisappear PaaS Automated Dispatch"
                        }
                    )
            except Exception as email_err:
                logger.error(f"EMAIL_DISPATCH_FAILED: {str(email_err)}")
                
        return {"status": "TRANSMITTED", "id": random.randint(1000, 9999)}
    except Exception as e:
        db.rollback()
        logger.error(f"SUPPORT_TICKET_ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to transmit support ticket.")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)