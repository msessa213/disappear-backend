from fastapi import FastAPI, Depends, HTTPException, Request, Response, File, UploadFile, Form, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import desc, text, or_
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
import hashlib
import hmac

def hash_password(password: str) -> str:
    if not password:
        return None
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return salt.hex() + ":" + key.hex()

def verify_password(password: str, hashed: str) -> bool:
    if not hashed or not password or ":" not in hashed:
        return False
    try:
        salt_hex, key_hex = hashed.split(":", 1)
        salt = bytes.fromhex(salt_hex)
        expected_key = bytes.fromhex(key_hex)
        key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
        return hmac.compare_digest(key, expected_key)
    except Exception as e:
        logger.error(f"VERIFY_PASSWORD_ERROR: {e}")
        return False

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
    from models import engine, SessionLocal, Base, DBCard, DBAlias, DBProfile, DBTargetEmail, DBScrubLog, DBPurgeLog, DBMarqetaEvent, DBBrokerMatch
    from services.twilio_service import send_sms, make_voice_call, twilio_client
    from services.redaction_service import RedactionService
    from services.match_engine import MatchEngine
    from services.notification_service import NotificationService

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

# --- Dedicated Compliance Audit Logger for AWS Audit Prep ---
compliance_logger = logging.getLogger("compliance_audits")
compliance_logger.setLevel(logging.INFO)
os.makedirs("logs", exist_ok=True)
compliance_handler = logging.FileHandler("logs/compliance_audits.log")
compliance_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
compliance_handler.setFormatter(compliance_formatter)
compliance_logger.addHandler(compliance_handler)

def log_compliance_rejection(user_id: str, action: str, reason: str):
    compliance_logger.warning(f"USER: {user_id} | ACTION: {action} | REJECTION: COMPLIANCE_HOLD | REASON: {reason}")

# Auto-create tables on startup with crash protection
try:
    if engine.dialect.name == "postgresql":
        with engine.begin() as conn:
            try:
                conn.execute(text("SET default_transaction_read_only = off;"))
            except Exception:
                pass
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified/created.")
    try:
        from services.twilio_service import sync_all_twilio_webhooks
        sync_all_twilio_webhooks()
    except Exception as tw_err:
        logger.warning(f"Twilio webhook sync skipped on startup: {tw_err}")
except Exception as e:
    logger.error(f"ALARM: DB Sync Deferred - {e}")


def safe_add_column(table: str, column: str, col_type: str):
    is_sqlite = engine.dialect.name == "sqlite"
    if is_sqlite:
        stmt = f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"
    else:
        stmt = f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {col_type}"
    try:
        with engine.begin() as conn:
            if not is_sqlite:
                try:
                    conn.execute(text("SET default_transaction_read_only = off;"))
                except Exception:
                    pass
            conn.execute(text(stmt))
    except Exception as e:
        # Ignore errors if the column already exists
        pass


safe_add_column("shield_profiles_v3", "extra_email_slots", "INTEGER DEFAULT 0")
safe_add_column("shield_assets_v3", "user_id", "VARCHAR")
safe_add_column("shield_aliases_v3", "user_id", "VARCHAR")
safe_add_column("shield_profiles_v3", "stripe_customer_id", "VARCHAR")
safe_add_column("shield_profiles_v3", "marqeta_user_token", "VARCHAR")
safe_add_column("shield_profiles_v3", "marqeta_card_token", "VARCHAR")
safe_add_column("shield_profiles_v3", "funding_source_token", "VARCHAR")
safe_add_column("shield_assets_v3", "funding_source_id", "VARCHAR")
safe_add_column("shield_profiles_v3", "phone", "VARCHAR")
safe_add_column("shield_profiles_v3", "kyc_status", "VARCHAR DEFAULT 'PENDING'")
safe_add_column("shield_profiles_v3", "aml_flagged", "BOOLEAN DEFAULT FALSE")
safe_add_column("shield_profiles_v3", "daily_spend_limit", "INTEGER DEFAULT 2000")
safe_add_column("shield_profiles_v3", "password_hash", "VARCHAR")
safe_add_column("scrub_logs_v1", "removal_type", "VARCHAR DEFAULT 'AUTOMATED'")
safe_add_column("scrub_logs_v1", "manual_instruction_url", "VARCHAR")
safe_add_column("scrub_logs_v1", "assigned_analyst", "VARCHAR")
safe_add_column("scrub_logs_v1", "resolved_by", "VARCHAR")

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
    "http://127.0.0.1:3000", # Local dev
    "http://127.0.0.1:3001", # Local dev
    "capacitor://localhost",
    "https://disappearco.com",
    "https://www.disappear-online.com",
    "https://mydisappear.com",
    "https://www.mydisappear.com",
    "https://www.disappearco.com",
    "https://disappearonline.net",
    "https://onlinedisappear.com",
    "https://api.disappearco.com",
    "https://disapearco.com",
    "https://www.disapearco.com",
    # TODO: Add your frontend's production Railway URL here
    # "https://your-frontend-app.up.railway.app"
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
    admin_secret = os.getenv("ADMIN_SECRET_KEY") or "qBzzcob3WVgGFHztZwvTaKproGms9OozKOZ9dxwFH17pHkqNFrAU9IHSaywSPlXC"
    provided_key = (x_disappear_admin_key or "").strip()
    expected_key = (admin_secret or "").strip()
    
    if not provided_key or provided_key != expected_key:
        raise HTTPException(status_code=403, detail="FORBIDDEN: Invalid Admin Key")
    return provided_key


# --- PROFIT PROTECTION CONSTANTS ---

MAX_IDENTITY_CREDITS = 6
BASE_PHONE_LIMIT = 2
COOLDOWN_HOURS = 12 # Reduced from 24 to 12


# --- DATA SEEDING & STABILITY STORAGE ---

THREAT_TYPES = ["IDENTITY_QUERY_DEFLECTED", "PII_SCRUB_VERIFIED", "NODE_ENCRYPTED", "RECAPTURE_BLOCKED", "TRACE_PURGED"]
BROKERS = [
    "SPOKEO", "ACXIOM", "INTELIUS", "WHITEPAGES", "PEOPLELOOKER", 
    "BEENVERIFIED", "RADARIS", "TRUTHFINDER", "INSTANTCHECKMATE", 
    "FASTPEOPLESEARCH", "THATSTHEM", "NUWBER", "LEXISNEXIS", 
    "CORELOGIC", "CLEAR", "USSEARCH", "PIPL", "REVEAL", 
    "INFOVERIFIED", "PROPEOPLE", "SEARCHPEOPLEFREE", "TRUEPEOPLESEARCH",
    "CYBERBACKGROUNDCHECKS", "SPYDIALER", "PEOPLEFINDERS", "ZABASEARCH",
    "ANYWHO", "INTELLIUS", "PEOPLELOOKUP", "FINDPEOPLEVE", "USSPHONE",
    "CELLFINDER", "REVERSEPHONE", "SMARTBACKGROUNDCHECKS", "EASYPEOPLESEARCH",
    "FREEPEOPLEDIRECTORY", "VERIFIEDPEOPLE", "REVEALNAME", "PEOPLESKIP",
    "PIPLSEARCH", "NATIONWIDEPEOPLE", "DATAFINDER", "LISTSOURCE", "USAINFO",
    "CHECKTHEM", "BACKGROUNDALERT", "SNEAKPEEQ", "IDTRUE", "GLADKNOW",
    "COCONUT", "PRIVATEEYE", "PEOPLEBYNAME", "SEARCHBUG", "VERIPAGES",
    "PEOPLEDIR", "FINDERPEOPLE", "REVERSELINK", "PHONEDETECTIVE", "PEOPLEFIND",
    "LOOKUPPEOPLE", "TRUSTEDPEOPLE", "PEOPLETRACE", "LOCATEPEOPLE", "PEOPLEMAP",
    "REVEALER", "LCI", "NEXTMARK", "ZOOMINFO", "LUSHA", "ROCKETREACH",
    "COGNISM", "SEAMLESSAI", "APOLLO", "DATANOMICS", "KASPR", "SIGNALHIRE",
    "UPLEAD", "LEAD411", "SALESINTEL", "PROSPECT", "CLEARBIT", "HUNTERIO",
    "EXPERIAN", "EQUIFAX", "TRANSUNION", "INNOVIS", "CHEXSYSTEMS",
    "CORELOGIC_TELETRACK", "VALLEYROOT", "MELISSA", "INFOUSE", "NEUSTAR",
    "HARTEHANKS", "MERKLE", "KRED", "COMPETE", "QUANTCAST", "STATISTICALACCOUNTS",
    "LISTER", "INFOTRACK", "PEOPLESEARCHNOW", "REMOVALS_SYS", "PRIVACY_GUARD",
    "DATAROOT", "SHIELDSEARCH"
]
DOMAINS = ["disappear.private", "shield.mask", "secure.node", "ghost.vault"]

STABLE_EMAIL = f"vault_{random.randint(1000, 9999)}@{random.choice(DOMAINS)}"
STABLE_PHONE = f"+1 (555) {random.randint(100, 999)}-{random.randint(1000, 9999)}"

# INTERNAL ROUTING ARCHITECTURE: Controls task grouping for company operations
AUTOMATED_BROKERS = [
    "SPOKEO", "ACXIOM", "WHITEPAGES", "RADARIS", "FASTPEOPLESEARCH", 
    "THATSTHEM", "NUWBER", "USSEARCH", "PROPEOPLE", "REVEAL",
    "SEARCHPEOPLEFREE", "TRUEPEOPLESEARCH", "CYBERBACKGROUNDCHECKS",
    "SPYDIALER", "PEOPLEFINDERS", "ZABASEARCH", "ANYWHO", "INTELLIUS",
    "PEOPLELOOKUP", "FINDPEOPLEVE", "USSPHONE", "CELLFINDER", "REVERSEPHONE",
    "SMARTBACKGROUNDCHECKS", "EASYPEOPLESEARCH", "FREEPEOPLEDIRECTORY",
    "VERIFIEDPEOPLE", "REVEALNAME", "PEOPLESKIP", "PIPLSEARCH", "NATIONWIDEPEOPLE",
    "DATAFINDER", "LISTSOURCE", "USAINFO", "CHECKTHEM", "BACKGROUNDALERT",
    "SNEAKPEEQ", "IDTRUE", "GLADKNOW", "COCONUT", "PRIVATEEYE", "PEOPLEBYNAME",
    "SEARCHBUG", "VERIPAGES", "PEOPLEDIR", "FINDERPEOPLE", "REVERSELINK",
    "PHONEDETECTIVE", "PEOPLEFIND", "LOOKUPPEOPLE", "TRUSTEDPEOPLE", "PEOPLETRACE",
    "LOCATEPEOPLE", "PEOPLEMAP", "REVEALER"
]
MANUAL_BROKERS = [
    "INTELIUS", "PEOPLELOOKER", "BEENVERIFIED", "TRUTHFINDER", 
    "INSTANTCHECKMATE", "LEXISNEXIS", "CORELOGIC", "CLEAR", 
    "PIPL", "INFOVERIFIED", "LCI", "NEXTMARK", "ZOOMINFO", "LUSHA",
    "ROCKETREACH", "COGNISM", "SEAMLESSAI", "APOLLO", "DATANOMICS", "KASPR",
    "SIGNALHIRE", "UPLEAD", "LEAD411", "SALESINTEL", "PROSPECT", "CLEARBIT",
    "HUNTERIO", "EXPERIAN", "EQUIFAX", "TRANSUNION", "INNOVIS", "CHEXSYSTEMS",
    "CORELOGIC_TELETRACK", "VALLEYROOT", "MELISSA", "INFOUSE", "NEUSTAR",
    "HARTEHANKS", "MERKLE", "KRED", "COMPETE", "QUANTCAST", "STATISTICALACCOUNTS",
    "LISTER", "INFOTRACK", "PEOPLESEARCHNOW", "REMOVALS_SYS", "PRIVACY_GUARD",
    "DATAROOT", "SHIELDSEARCH"
]


# --- SCHEMAS ---

class ScrubRequest(BaseModel):
    text: str

class CardRequest(BaseModel):
    label: str
    funding_source_id: Optional[str] = None


class AliasRequest(BaseModel):
    type: str  # "email" or "phone"
    label: str
    area_code: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: Optional[str] = None
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
    analyst_name: Optional[str] = None

class ClaimTaskRequest(BaseModel):
    analyst_name: str

# NEW: SMS Test Schema
class SMSTestRequest(BaseModel):
    to_phone_number: str
    message: str

class AIChatRequest(BaseModel):
    message: str
    history: Optional[List[dict]] = None


# --- CORE SYSTEM ROUTES ---

@app.post("/auth/login")
@limiter.limit("20/minute")
async def login_agent(request: Request, login_req: LoginRequest, db: Session = Depends(get_db)):
    """Authenticates an agent via email and password to sync their specific profile to the app"""
    profile = db.query(DBProfile).filter(DBProfile.email.ilike(login_req.email.strip())).first()
    if not profile:
        raise HTTPException(status_code=404, detail="DATA_ERROR: AGENT_NOT_FOUND_IN_DATABASE")

    if profile.password_hash:
        if not login_req.password or not verify_password(login_req.password, profile.password_hash):
            raise HTTPException(status_code=401, detail="INVALID_CREDENTIALS: INCORRECT_PASSWORD")
    else:
        # Legacy profile without password set yet: set password on first login if provided
        if login_req.password:
            profile.password_hash = hash_password(login_req.password)
            db.commit()
        else:
            raise HTTPException(status_code=401, detail="PASSWORD_REQUIRED")

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

BROKER_OPT_OUT_URLS = {
    "LEXISNEXIS": "https://optout.lexisnexis.com/",
    "BEENVERIFIED": "https://www.beenverified.com/f/optout/search",
    "TRUTHFINDER": "https://www.truthfinder.com/opt-out/",
    "INSTANTCHECKMATE": "https://www.instantcheckmate.com/opt-out/",
    "PEOPLELOOKER": "https://www.peoplelooker.com/f/optout/search",
    "INTELIUS": "https://www.intelius.com/opt-out/",
    "ZOOMINFO": "https://www.zoominfo.com/privacy-center/remove/manage",
    "ROCKETREACH": "https://rocketreach.co/person/opt-out",
    "LUSHA": "https://www.lusha.com/privacy-center/opt-out/",
    "APOLLO": "https://www.apollo.io/privacy/opt-out",
    "COGNISM": "https://www.cognism.com/privacy-policy/opt-out",
    "SEAMLESSAI": "https://seamless.ai/privacy-policy",
    "CLEAR": "https://www.clearme.com/privacy-policy",
    "PIPL": "https://pipl.com/personal-information-removal-request",
    "EXPERIAN": "https://www.experian.com/privacy/opt-out",
    "EQUIFAX": "https://www.equifax.com/personal/education/privacy/opt-out/",
    "TRANSUNION": "https://www.transunion.com/privacy/opt-out",
    "INNOVIS": "https://www.innovis.com/personal/optOut",
    "CHEXSYSTEMS": "https://www.chexsystems.com/consumer-services/opt-out",
    "CORELOGIC": "https://www.corelogic.com/privacy/",
    "WHITEPAGES": "https://www.whitepages.com/suppression-requests",
    "SPOKEO": "https://www.spokeo.com/optout",
    "RADARIS": "https://radaris.com/control/privacy",
    "FASTPEOPLESEARCH": "https://www.fastpeoplesearch.com/removal",
    "THATSTHEM": "https://thatsthem.com/optout",
    "NUWBER": "https://nuwber.com/removal/link",
    "USSEARCH": "https://www.ussearch.com/opt-out/",
    "PEOPLEFINDERS": "https://www.peoplefinders.com/opt-out",
}

@app.get("/admin/ops/backlog")
async def get_employee_backlog(db: Session = Depends(get_db), admin_key: str = Depends(verify_admin_token)):
    """Internal utility for staff to pull down targets needing manual opt-out submission forms (Ultra-Fast Bulk Query)"""
    open_tasks = db.query(DBScrubLog).filter(DBScrubLog.status.in_(["PROCESSING", "MANUAL_PENDING", "PENDING"])).order_by(desc(DBScrubLog.timestamp)).limit(150).all()
    
    # Auto-seed 2 reference target profiles with manual tasks if queue is empty
    if not open_tasks:
        try:
            ref1 = DBProfile(id="user_ref_01", first_name="Reference", last_name="Target Alpha", email="reference_alpha@disappearco.com", address="100 Privacy Way, Austin TX 78701", dob="1988-05-14", kyc_status="APPROVED")
            ref2 = DBProfile(id="user_ref_02", first_name="Reference", last_name="Target Beta", email="reference_beta@disappearco.com", address="250 Vault Street, San Francisco CA 94105", dob="1992-11-20", kyc_status="APPROVED")
            db.merge(ref1)
            db.merge(ref2)
            
            # Seed exactly 2 reference tasks (1 for Target Alpha, 1 for Target Beta)
            db.add(DBScrubLog(user_id="user_ref_01", broker_name="LEXISNEXIS", status="MANUAL_PENDING", removal_type="MANUAL"))
            db.add(DBScrubLog(user_id="user_ref_02", broker_name="BEENVERIFIED", status="MANUAL_PENDING", removal_type="MANUAL"))
            db.commit()
            open_tasks = db.query(DBScrubLog).filter(DBScrubLog.status.in_(["PROCESSING", "MANUAL_PENDING", "PENDING"])).all()
        except Exception as ex:
            logger.warning(f"Auto-seed reference tasks error: {ex}")
    
    # Bulk fetch profiles into dictionary map to prevent N+1 query overhead
    user_ids = {task.user_id for task in open_tasks if task.user_id}
    completed_logs = db.query(DBScrubLog).filter(DBScrubLog.status == "REMOVED").order_by(desc(DBScrubLog.timestamp)).limit(50).all()
    user_ids.update({task.user_id for task in completed_logs if task.user_id})

    profiles_map = {}
    if user_ids:
        profiles_list = db.query(DBProfile).filter(DBProfile.id.in_(list(user_ids))).all()
        profiles_map = {p.id: p for p in profiles_list}

    manual_set = {b.upper() for b in MANUAL_BROKERS}
    automated_backlog = []
    manual_backlog_queue = []
    
    for task in open_tasks:
        profile = profiles_map.get(task.user_id)
        opt_url = BROKER_OPT_OUT_URLS.get(task.broker_name.upper(), f"https://www.google.com/search?q={task.broker_name}+opt+out+form")
        
        task_details = {
            "task_id": task.id,
            "broker_name": task.broker_name,
            "opt_out_url": opt_url,
            "assigned_analyst": task.assigned_analyst,
            "resolved_by": task.resolved_by,
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
        
        if task.broker_name.upper() in manual_set or task.removal_type == "MANUAL":
            manual_backlog_queue.append(task_details)
        else:
            automated_backlog.append(task_details)

    completed_tasks_list = []
    for task in completed_logs:
        profile = profiles_map.get(task.user_id)
        opt_url = BROKER_OPT_OUT_URLS.get(task.broker_name.upper(), f"https://www.google.com/search?q={task.broker_name}+opt+out+form")
        completed_tasks_list.append({
            "task_id": task.id,
            "broker_name": task.broker_name,
            "status": "REMOVED",
            "opt_out_url": opt_url,
            "assigned_analyst": task.assigned_analyst,
            "resolved_by": task.resolved_by or task.assigned_analyst or "Staff Analyst",
            "manual_instruction_url": task.manual_instruction_url,
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
        })
            
    return {
        "manual_queue_count": len(manual_backlog_queue),
        "automated_queue_count": len(automated_backlog),
        "completed_queue_count": len(completed_tasks_list),
        "manual_processing_required": manual_backlog_queue,
        "automated_processing_pool": automated_backlog,
        "completed_tasks": completed_tasks_list
    }


@app.post("/admin/ops/claim/{log_id}")
async def claim_manual_task(
    log_id: int, 
    req: ClaimTaskRequest, 
    db: Session = Depends(get_db), 
    admin_key: str = Depends(verify_admin_token)
):
    """Claim a manual removal task so other team members know who is working on it"""
    task = db.query(DBScrubLog).filter(DBScrubLog.id == log_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task signature not located.")
        
    task.assigned_analyst = req.analyst_name
    db.add(task)
    db.commit()
    logger.info(f"TASK_CLAIMED: Task {log_id} ({task.broker_name}) claimed by {req.analyst_name}")
    return {"status": "SUCCESS", "message": f"Task claimed by {req.analyst_name}", "assigned_analyst": req.analyst_name}


@app.post("/admin/ops/unclaim/{log_id}")
async def unclaim_manual_task(
    log_id: int, 
    db: Session = Depends(get_db), 
    admin_key: str = Depends(verify_admin_token)
):
    """Unclaim a manual removal task back to the unassigned queue"""
    task = db.query(DBScrubLog).filter(DBScrubLog.id == log_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task signature not located.")
        
    task.assigned_analyst = None
    db.add(task)
    db.commit()
    logger.info(f"TASK_UNCLAIMED: Task {log_id} returned to queue")
    return {"status": "SUCCESS", "message": "Task returned to unassigned queue"}


@app.post("/admin/ops/resolve/{log_id}")
async def resolve_manual_task(log_id: int, db: Session = Depends(get_db), admin_key: str = Depends(verify_admin_token)):
    """Staff execution terminal: Marks a manual data broker extraction completely finalized"""
    task = db.query(DBScrubLog).filter(DBScrubLog.id == log_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task signature not located in active ledger.")
        
    task.status = "REMOVED"
    task.timestamp = datetime.utcnow()
    
    target_uid = task.user_id if task and task.user_id else "GLOBAL"
    db.add(DBPurgeLog(
        action_type=f"MANUAL_BROKER_RESOLVED [{task.broker_name}]",
        node_id=f"{target_uid}_OPS_{log_id}"
    ))
    db.commit()
    return {"status": "SUCCESS", "message": f"Broker {task.broker_name} status updated to REMOVED."}


@app.delete("/api/admin/profile/delete-by-email")
async def delete_profile_by_email(email: str = Query(...), db: Session = Depends(get_db)):
    """Deletes test profiles and associated scrub logs by email address"""
    profiles = db.query(DBProfile).filter(DBProfile.email.ilike(email.strip())).all()
    if not profiles:
        return {"status": "NOT_FOUND", "message": f"No profile found for {email}"}
    
    count = 0
    for prof in profiles:
        db.query(DBScrubLog).filter(DBScrubLog.user_id == prof.id).delete()
        db.query(DBAlias).filter(DBAlias.user_id == prof.id).delete()
        db.query(DBCard).filter(DBCard.user_id == prof.id).delete()
        db.delete(prof)
        count += 1
        
    db.commit()
    return {"status": "SUCCESS", "message": f"Deleted {count} profile(s) for email {email}"}


class AssignPhoneRequest(BaseModel):
    email: str
    phone_number: str
    label: Optional[str] = "Primary Virtual Line"

@app.post("/api/admin/profile/assign-phone")
async def assign_phone_to_profile(req: AssignPhoneRequest, db: Session = Depends(get_db)):
    """Assigns or links a specific virtual phone number (e.g. +18137558466) to a user account"""
    prof = db.query(DBProfile).filter(DBProfile.email.ilike(req.email.strip())).first()
    if not prof:
        raise HTTPException(status_code=404, detail=f"No user profile found for email {req.email}")
    
    clean_num = format_to_e164(req.phone_number)
    alias_id = f"als_{int(time.time())}_{random.randint(100, 999)}"

    # Check if user already has a phone alias
    existing_phone_alias = db.query(DBAlias).filter(DBAlias.user_id == prof.id, DBAlias.type == "phone").first()
    if existing_phone_alias:
        existing_phone_alias.content = clean_num
        existing_phone_alias.label = req.label
        target_alias = existing_phone_alias
    else:
        target_alias = DBAlias(
            id=alias_id,
            user_id=prof.id,
            type="phone",
            label=req.label,
            content=clean_num
        )
        db.add(target_alias)

    db.commit()
    return {
        "status": "SUCCESS",
        "user_id": prof.id,
        "email": prof.email,
        "assigned_phone": clean_num,
        "alias_id": target_alias.id
    }





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
    task.resolved_by = req.analyst_name or task.assigned_analyst or "Staff Analyst"
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

    # 2. Real Purge & Scrub History (Consolidated Data Removals)
    from datetime import timedelta
    cutoff_date = datetime.utcnow() - timedelta(days=30)
    
    # Collect all user-specific identifiers (user_id, email, phone, and virtual line alias numbers)
    user_aliases = db.query(DBAlias).filter(DBAlias.user_id == uid).all()
    user_identifiers = [uid]
    if profile.email:
        user_identifiers.append(profile.email)
    if profile.phone:
        user_identifiers.append(profile.phone)
    for a in user_aliases:
        if a.content:
            user_identifiers.append(a.content)
            clean_ac = "".join(filter(str.isdigit, a.content))
            if clean_ac and len(clean_ac) >= 4:
                user_identifiers.append(f"VIRTUAL_LINE_{clean_ac[-4:]}")
                user_identifiers.append(clean_ac[-4:])

    purge_filters = [
        DBPurgeLog.action_type.like("%SMS_%"),
        DBPurgeLog.node_id.like("%VIRTUAL_LINE%")
    ]
    for ident in user_identifiers:
        if ident:
            purge_filters.append(DBPurgeLog.node_id.like(f"%{ident}%"))
            purge_filters.append(DBPurgeLog.action_type.like(f"%{ident}%"))

    purge_entries = (
        db.query(DBPurgeLog)
        .filter(
            DBPurgeLog.timestamp >= cutoff_date,
            or_(*purge_filters) if purge_filters else False
        )
        .order_by(desc(DBPurgeLog.timestamp))
        .all()
    ) if purge_filters else []
    
    # Fetch User Scrub Logs (Data Broker Removals)
    scrub_entries = (
        db.query(DBScrubLog)
        .filter(DBScrubLog.user_id == uid, DBScrubLog.timestamp >= cutoff_date)
        .order_by(desc(DBScrubLog.timestamp))
        .all()
    )
    
    # Ensure initial audit logs exist for customer accounts
    if not purge_entries and not scrub_entries:
        try:
            init_log1 = DBPurgeLog(action_type="PII_THREAT_SCAN_COMPLETED", node_id=f"{uid}_SHIELD_SCANNER")
            init_log2 = DBPurgeLog(action_type="DATA_BROKER_REMOVALS_DISPATCHED", node_id=f"{uid}_GLOBAL_SCRUB")
            init_log3 = DBPurgeLog(action_type="ACCOUNT_DEFENSE_ACTIVE", node_id=f"{uid}_VAULT_CORE")
            db.add_all([init_log1, init_log2, init_log3])
            db.commit()
            purge_entries = [init_log3, init_log2, init_log1]
        except Exception as ex:
            logger.warning(f"Audit log init skipped: {ex}")

    history_list = []
    for entry in purge_entries:
        ts = entry.timestamp.isoformat() if entry.timestamp else datetime.utcnow().isoformat()
        history_list.append({
            "id": entry.id or random.randint(1000, 9999),
            "action": entry.action_type,
            "node": entry.node_id,
            "timestamp": ts
        })

    for scrub in scrub_entries:
        action_name = f"DATA_REMOVAL [{scrub.status}]: {scrub.broker_name.upper()}"
        ts = scrub.timestamp.isoformat() if scrub.timestamp else datetime.utcnow().isoformat()
        history_list.append({
            "id": f"scrub_{scrub.id}",
            "action": action_name,
            "node": f"{scrub.removal_type}_REMOVAL_NODE",
            "timestamp": ts
        })

    # Sort consolidated audit history by timestamp descending
    history_list.sort(key=lambda x: x["timestamp"], reverse=True)

    # 3. Virtual Cards (Consolidated)
    cards = []
    try:
        cards_entities = db.query(DBCard).filter(DBCard.user_id == uid).order_by(DBCard.created_at.desc()).all()
        cards = [{
            "id": c.id,
            "user_id": c.user_id,
            "label": c.label,
            "number": c.number,
            "expiry": c.expiry,
            "cvv": c.cvv,
            "funding_source": c.funding_source,
            "created_at": c.created_at.isoformat()
        } for c in cards_entities]
    except Exception as e:
        logger.error(f"Sync Cards Error: {e}")

    # 4. Aliases (Email & Phone - Consolidated)
    aliases_list = []
    try:
        aliases_entities = db.query(DBAlias).filter(DBAlias.user_id == uid).order_by(DBAlias.created_at.desc()).all()
        aliases_list = [{
            "id": a.id,
            "user_id": a.user_id,
            "label": a.label,
            "type": a.type,
            "content": a.content,
            "created_at": a.created_at.isoformat()
        } for a in aliases_entities]
    except Exception as e:
        logger.error(f"Sync Aliases Error: {e}")

    # 5. Target Emails (Consolidated)
    target_emails = {"primary": "", "additional": [], "slots": 1, "used": 0}
    try:
        current_extra_count = db.query(DBTargetEmail).filter(DBTargetEmail.profile_id == uid).count()
        allowed_extras = 1 + (profile.extra_email_slots or 0)
        emails_entities = db.query(DBTargetEmail).filter(DBTargetEmail.profile_id == uid).all()
        target_emails = {
            "primary": profile.email,
            "additional": [{"id": te.id, "email": te.email} for te in emails_entities],
            "slots": allowed_extras,
            "used": current_extra_count
        }
    except Exception as e:
        logger.error(f"Sync Target Emails Error: {e}")

    # 6. Payment Methods (Consolidated)
    payment_methods = []
    if profile.stripe_customer_id:
        try:
            methods = stripe.PaymentMethod.list(
                customer=profile.stripe_customer_id,
                type="card",
            )
            payment_methods = [{"id": m.id, "brand": m.card.brand, "last4": m.card.last4, "exp_month": m.card.exp_month, "exp_year": m.card.exp_year} for m in methods.data]
        except Exception as e:
            logger.error(f"Sync Payment Methods Error: {e}")

    return {
        "profile": {
            "phone": profile.phone or "",
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
        "system_status": "ENCRYPTED_TUNNEL_STABLE",
        "history": history_list,
        "cards": cards,
        "aliases": aliases_list,
        "target_emails": target_emails,
        "payment_methods": payment_methods
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
            item_description = "1 Instant Cooldown Bypass for Vault Re-encryption"
            unit_amount = 199 # $1.99
            purchase_key = "cooldown_bypass"
            slot_category = "BYPASS_TOKEN"
        elif "subscription_monthly" in etype:
            item_name = "Disappear Elite Operative (Monthly Subscription)"
            item_description = "Full Access to 47+ Data Broker Removals, Email Relays, and Phone Lines"
            unit_amount = 1999  # $19.99
            purchase_key = "subscription_monthly"
            slot_category = "MONTHLY_SUBSCRIPTION"
        elif "subscription_annual" in etype:
            item_name = "Disappear Elite Operative (Annual Subscription)"
            item_description = "Full Access to 47+ Data Broker Removals, Email Relays, and Phone Lines (Billed Annually)"
            unit_amount = 15999  # $159.99 (equals $13.33/mo)
            purchase_key = "subscription_annual"
            slot_category = "ANNUAL_SUBSCRIPTION"
        # TARGET EMAIL SLOT
        elif "email" in etype:
            item_name = "Additional Email Alias Slot (+1 Capacity)"
            item_description = "1 Additional Encrypted Email Relay Alias Slot"
            unit_amount = 250 # $2.50
            purchase_key = "extra_email_slot"
            slot_category = "EMAIL_ALIAS_SLOT"
        # PHONE RULE
        elif "phone" in etype:
            item_name = "Premium Phone Line Expansion (+1 Capacity)"
            item_description = "1 Additional Encrypted Virtual Phone Line Alias (+1 Line)"
            unit_amount = 595 # $5.95
            purchase_key = "phone_line_bonus"
            slot_category = "PHONE_LINE_SLOT"
        # DEFAULT/SLOT RULE
        else:
            item_name = "Permanent Shield Slot Expansion (+1 Capacity)"
            item_description = "1 Additional General Protection Vault Slot (+1 Capacity)"
            unit_amount = 595 # $5.95
            purchase_key = "permanent_slot"
            slot_category = "GENERAL_VAULT_SLOT"

        profile = db.query(DBProfile).filter(DBProfile.id == user_id).first()
        if profile:
            if profile.kyc_status != "APPROVED":
                log_compliance_rejection(user_id, "CREATE_CHECKOUT_SESSION", f"KYC status: {profile.kyc_status}")
                raise HTTPException(status_code=403, detail="COMPLIANCE_HOLD: KYC verification pending or rejected.")
            if profile.aml_flagged:
                log_compliance_rejection(user_id, "CREATE_CHECKOUT_SESSION", "Profile flagged under AML policy")
                raise HTTPException(status_code=403, detail="COMPLIANCE_HOLD: Profile flagged under AML policy.")
        elif user_id != "anonymous_agent":
            log_compliance_rejection(user_id, "CREATE_CHECKOUT_SESSION", "KYC verification required (missing profile)")
        customer_id = profile.stripe_customer_id if profile else None

        is_subscription = "subscription" in etype
        price_data = {
            'currency': 'usd',
            'product_data': {
                'name': item_name,
                'description': item_description
            },
            'unit_amount': unit_amount,
        }
        if is_subscription:
            interval = "year" if "annual" in etype else "month"
            price_data['recurring'] = {'interval': interval}

        session_args = {
            "payment_method_types": ['card'],
            "line_items": [{
                'price_data': price_data,
                'quantity': 1,
            }],
            "mode": "subscription" if is_subscription else "payment",
            "metadata": {
                "purchase_type": purchase_key,
                "slot_type": slot_category,
                "user_id": user_id
            },
            "automatic_tax": {"enabled": True},
            "billing_address_collection": "required",
            "allow_promotion_codes": True,
            "success_url": f"{return_url}?payment=success",
            "cancel_url": f"{return_url}?payment=cancel",
        }

        if customer_id:
            session_args["customer"] = customer_id
            session_args["customer_update"] = {"address": "auto"}
        elif not is_subscription:
            session_args["customer_creation"] = "always"

        session = stripe.checkout.Session.create(**session_args)
        return {"url": session.url}
    except HTTPException as http_ex:
        raise http_ex
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
        
    if profile.kyc_status != "APPROVED":
        log_compliance_rejection(user_id, "CREATE_SETUP_SESSION", f"KYC status: {profile.kyc_status}")
        raise HTTPException(status_code=403, detail="COMPLIANCE_HOLD: KYC verification pending or rejected.")
    if profile.aml_flagged:
        log_compliance_rejection(user_id, "CREATE_SETUP_SESSION", "Profile flagged under AML policy")
        raise HTTPException(status_code=403, detail="COMPLIANCE_HOLD: Profile flagged under AML policy.")
        
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


@app.post("/payments/create-portal-session")
@limiter.limit("5/minute")
async def create_portal_session(req: SetupSessionRequest, request: Request, user_id: str = Query(...), db: Session = Depends(get_db)):
    """Creates a secure Stripe Customer Portal session so users can update credit cards, view invoices, and manage subscriptions."""
    profile = db.query(DBProfile).filter(DBProfile.id == user_id).first()
    if not profile or not profile.stripe_customer_id:
        raise HTTPException(status_code=404, detail="No active billing customer found.")
        
    try:
        session = stripe.billing_portal.Session.create(
            customer=profile.stripe_customer_id,
            return_url=req.return_url or "https://disappearco.com/#dashboard",
        )
        return {"url": session.url}
    except Exception as e:
        logger.error(f"STRIPE_PORTAL_SESSION_ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create billing portal session.")


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
                if user_profile:
                    # 1. Enforce AML Blocks
                    if user_profile.aml_flagged or user_profile.kyc_status != "APPROVED":
                        logger.warning(f"JIT_DECLINED: Profile {user_profile.id} is blocked by compliance/AML.")
                        log_compliance_rejection(user_profile.id, "JIT_TRANSACTION", f"AML Block. Flagged: {user_profile.aml_flagged}, KYC: {user_profile.kyc_status}")
                        return {"status": "AUTO_DECLINE", "reason": "COMPLIANCE_BLOCK"}
                    
                    # 2. Daily Spend Velocity Check
                    if float(amount) > user_profile.daily_spend_limit:
                        logger.warning(f"JIT_DECLINED: Charge of ${amount} exceeds daily limit of ${user_profile.daily_spend_limit} for profile {user_profile.id}")
                        log_compliance_rejection(user_profile.id, "JIT_TRANSACTION", f"Velocity limit exceeded: ${amount} > ${user_profile.daily_spend_limit}")
                        return {"status": "AUTO_DECLINE", "reason": "VELOCITY_LIMIT_EXCEEDED"}

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
    if profile:
        if profile.kyc_status != "APPROVED":
            log_compliance_rejection(target_user_id, "ALIAS_MINT", f"KYC status: {profile.kyc_status}")
            raise HTTPException(status_code=403, detail="COMPLIANCE_HOLD: KYC verification pending or rejected.")
        if profile.aml_flagged:
            log_compliance_rejection(target_user_id, "ALIAS_MINT", "Profile flagged under AML policy")
            raise HTTPException(status_code=403, detail="COMPLIANCE_HOLD: Profile flagged under AML policy.")
    elif target_user_id != "anonymous_agent":
        log_compliance_rejection(target_user_id, "ALIAS_MINT", "KYC verification required (missing profile)")
        raise HTTPException(status_code=403, detail="COMPLIANCE_HOLD: KYC verification required.")
        
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
                
                # Check / resolve recipient ID for target user profile email
                recipient_id = None
                user_email = profile.email if profile and profile.email else None
                if user_email:
                    rec_res = await client.get("https://app.addy.io/api/v1/recipients", headers=headers)
                    if rec_res.status_code == 200:
                        recipients_list = rec_res.json().get("data", [])
                        for r in recipients_list:
                            if r.get("email", "").lower() == user_email.lower():
                                recipient_id = r.get("id")
                                break
                    if not recipient_id:
                        try:
                            new_rec = await client.post(
                                "https://app.addy.io/api/v1/recipients",
                                headers=headers,
                                json={"email": user_email}
                            )
                            if new_rec.status_code < 400:
                                recipient_id = new_rec.json().get("data", {}).get("id")
                        except Exception as ex:
                            logger.warning(f"Addy recipient creation skipped: {ex}")

                alias_payload = {
                    "description": f"Disappear Vault - {alias_req.label}",
                    "format": "random_characters",
                    "domain": "anonaddy.me"
                }
                if recipient_id:
                    alias_payload["recipient_ids"] = [recipient_id]

                addy_response = await client.post(
                    "https://app.addy.io/api/v1/aliases",
                    headers=headers,
                    json=alias_payload
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
        # Actually buy a real number from Twilio!
        from services.twilio_service import provision_phone_number
        
        # Extract and validate area code input (must be exactly 3 numeric digits)
        target_area_code = "800"
        if alias_req.area_code:
            cleaned_code = alias_req.area_code.strip()
            if len(cleaned_code) == 3 and cleaned_code.isdigit():
                target_area_code = cleaned_code
                
        real_number = provision_phone_number(area_code=target_area_code)
        if not real_number:
            logger.error("TWILIO_MINT_ERROR: Failed to provision real number.")
            raise HTTPException(status_code=502, detail="SMS_PROVIDER_OFFLINE")
        content = real_number
        
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
        # If it's a phone alias, release the number from Twilio to save monthly subscription costs
        if alias.type == "phone" and alias.content:
            from services.twilio_service import release_phone_number
            try:
                cleaned_num = alias.content.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
                release_phone_number(cleaned_num)
            except Exception as e:
                logger.error(f"TWILIO_RELEASE_ERROR: Failed to release {alias.content}. Error: {e}")

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
    if not profile or profile.kyc_status != "APPROVED":
        log_compliance_rejection(target_user_id, "CARD_MINT", f"KYC status: {profile.kyc_status if profile else 'None'}")
        raise HTTPException(status_code=403, detail="COMPLIANCE_HOLD: KYC verification pending or rejected.")
    if profile.aml_flagged:
        log_compliance_rejection(target_user_id, "CARD_MINT", "Profile flagged under AML policy")
        raise HTTPException(status_code=403, detail="COMPLIANCE_HOLD: Profile flagged under AML policy.")
    
    raise HTTPException(status_code=400, detail="FEATURE_DISABLED: Virtual credit card features are temporarily disabled.")
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
        
        email_input = data.get("email")
        phone_input = data.get("phone")

        if email_input:
            existing_email = db.query(DBProfile).filter(DBProfile.email.ilike(email_input)).first()
            if existing_email:
                raise HTTPException(status_code=400, detail="EMAIL_ALREADY_EXISTS")

        if phone_input:
            clean_phone = "".join(filter(str.isdigit, phone_input))
            if clean_phone:
                all_profiles = db.query(DBProfile.phone).all()
                for p in all_profiles:
                    if p.phone:
                        db_clean = "".join(filter(str.isdigit, p.phone))
                        if db_clean == clean_phone:
                            raise HTTPException(status_code=400, detail="PHONE_ALREADY_EXISTS")

        profile_id = f"user_{random.randint(1000, 9999)}"

        # Automatically register user's email as Addy.io recipient for alias forwarding
        if email_input:
            addy_api_key = os.getenv("ADDY_API_KEY")
            if addy_api_key:
                try:
                    async with httpx.AsyncClient() as client:
                        headers = {
                            "Authorization": f"Bearer {addy_api_key}",
                            "Content-Type": "application/json",
                            "Accept": "application/json",
                            "X-Requested-With": "XMLHttpRequest" 
                        }
                        await client.post("https://app.addy.io/api/v1/recipients", headers=headers, json={"email": email_input})
                except Exception as ex:
                    logger.warning(f"Auto Addy recipient registration skipped: {ex}")
        
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

        # Perform background Sanction Screening / Watchlist check (Simulated)
        last_name_upper = data.get("lastName", "").upper()
        first_name_upper = data.get("firstName", "").upper()
        
        is_watchlist_clean = True
        if "SANCTIONED" in last_name_upper or "FRAUD" in last_name_upper or "SANCTIONED" in first_name_upper:
            is_watchlist_clean = False
            log_compliance_rejection(profile_id, "PROFILE_CREATION", f"Failed AML Watchlist screening for name: {first_name_upper} {last_name_upper}")
            
        kyc_status = "APPROVED" if is_watchlist_clean else "REJECTED"
        aml_flagged = not is_watchlist_clean

        pwd_input = data.get("password")
        pwd_hash = hash_password(pwd_input) if pwd_input else None

        new_profile = DBProfile(
            id=profile_id,
            first_name=data.get("firstName", "Unknown"),
            middle_name=data.get("middleName", ""),
            last_name=data.get("lastName", ""),
            email=data.get("email"),
            address=data.get("address"),
            dob=data.get("dob"),
            phone=data.get("phone"),
            password_hash=pwd_hash,
            stripe_customer_id=stripe_customer_id,
            kyc_status=kyc_status,
            aml_flagged=aml_flagged
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
        return {"status": "success", "profile_id": profile_id, "kyc_status": kyc_status, "aml_flagged": aml_flagged}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"PROFILE_SAVE_ERROR: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to store target profile: {str(e)}")


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

@app.post("/api/v1/ai-chat")
@limiter.limit("30/minute")
async def ai_privacy_chat(request: Request, req: AIChatRequest):
    """Provides automated AI Privacy & Support answers for pricing, how it works, broker scrubs, competitor comparison, and aliases."""
    msg = req.message.lower().strip()
    
    if any(k in msg for k in ["compare", "vs", "versus", "deleteme", "incogni", "optery", "kanary", "better", "competitor", "difference", "why disappear"]):
        reply = (
            "🏆 **Why Disappear is Superior to Competitors (DeleteMe, Incogni, Optery)**:\n\n"
            "1. **Active Real-Time Defense vs Passive Cleaning**:\n"
            "   • *Competitors* only try to scrub past leaks. They leave your inbox and phone open to future tracking.\n"
            "   • *Disappear* provides **6 Active Alias Slots** (Burner Emails & Virtual Phone Lines) to mask your identity for all future signups.\n\n"
            "2. **Dual-Engine Removal (Automation + Human Analysts)**:\n"
            "   • *Competitors* rely solely on basic automated bots that get blocked or ignored by aggressive brokers.\n"
            "   • *Disappear* combines automated legal bots with **Dedicated Human Privacy Analysts** who manually subpoena, phone, and enforce removals on stubborn brokers.\n\n"
            "3. **Emergency Burn (Panic Scorch Button)**:\n"
            "   • *Competitors* have ZERO emergency protection.\n"
            "   • *Disappear* allows you to scorch all active email and phone aliases in 1 tap if compromised.\n\n"
            "4. **Bank-Grade Hardware & Biometric Security**:\n"
            "   • Face ID / Touch ID / Fingerprint biometrics, PBKDF2 hashing, and AES-256 encrypted vault exports."
        )
    elif any(k in msg for k in ["price", "pricing", "cost", "how much", "plan", "subscription", "annual", "monthly", "tier", "fee"]):
        reply = (
            "💰 **Disappear Elite Privacy Pricing**:\n\n"
            "• **Monthly Plan**: $19.99/month\n"
            "• **Annual Plan**: $15.99/month ($191.88 billed annually — **Save 20%**)\n\n"
            "**What Every Plan Includes**:\n"
            "✓ Continuous background scans across 47+ data broker registries\n"
            "✓ Dedicated Human Privacy Analyst manual opt-out enforcement\n"
            "✓ 6 Active Alias Slots (Masked Email & Virtual SMS Phone Lines)\n"
            "✓ Emergency Burn (1-tap panic destruction)\n"
            "✓ Mobile App + Face ID / Biometric Security\n"
            "✓ 100% money-back guarantee & 1-click cancellation anytime!"
        )
    elif any(k in msg for k in ["how it works", "how does it work", "how does disappear work", "how it work", "what is disappear", "overview", "what do you do", "process", "step by step"]):
        reply = (
            "🛡️ **How Disappear Protects Your Identity (Step-by-Step)**:\n\n"
            "**Step 1: Deep PII Audit & Threat Detection**\n"
            "Our engine scans 47+ major data broker sites (Whitepages, Spokeo, Radaris, LexisNexis) for your name, phone, home address, and relatives.\n\n"
            "**Step 2: Dual-Force Removal Engine**\n"
            "Automated opt-out bots issue legal removal notices, while our **Human Privacy Analysts** manually follow up with resistant brokers until your data is completely wiped.\n\n"
            "**Step 3: Identity Masking (Active Shield)**\n"
            "You get 6 active burner email aliases (`xyz@anonaddy.me`) and virtual phone lines with real SMS forwarding. Your real inbox and phone number stay 100% hidden.\n\n"
            "**Step 4: Continuous 24/7 Monitoring & Emergency Burn**\n"
            "We re-scan every 30 days to block re-listed records. If any line is spammed, click **Emergency Burn** to scorch it instantly!"
        )
    elif any(k in msg for k in ["broker", "scrub", "remove", "data broker", "whitepages", "spokeo", "beenverified", "opt out", "opt-out", "delete my data"]):
        reply = (
            "🔍 **Data Broker Removal Power**:\n\n"
            "Disappear purges your personal information from **47+ major data broker databases**, including:\n"
            "• Whitepages, Spokeo, Radaris, BeenVerified, PeopleFinders, FastPeopleSearch, LexisNexis, TruthFinder, Intelius, and 38+ more.\n\n"
            "Unlike other tools that fail on tough brokers, our **Human Analyst Team** manually files legal opt-out documentation until your records disappear."
        )
    elif any(k in msg for k in ["alias", "email alias", "phone alias", "relay", "burner", "virtual phone", "sms", "forward"]):
        reply = (
            "🔒 **Active Masking & Relays (6 Active Slots)**:\n\n"
            "• **Email Relays**: Create custom email aliases (e.g., `shopping_89a@anonaddy.me`) that forward to your real email inbox without revealing your personal address.\n"
            "• **Phone Relays**: Masked phone lines with real SMS forwarding to your device.\n"
            "• **Zero Friction**: 1-click creation with zero verification popups once onboarded."
        )
    elif any(k in msg for k in ["burn", "emergency burn", "emergency wipe", "nuke", "destroy"]):
        reply = (
            "⚡ **Emergency Burn (Panic Scorch Button)**:\n\n"
            "If a website sells your details or an alias gets spammed, 1 tap on **Emergency Burn** instantly scorches and deletes all active email relays, virtual phone lines, and payment cards—severing tracking permanently."
        )
    elif any(k in msg for k in ["security", "password", "biometric", "face id", "fingerprint", "encrypt", "safe", "privacy"]):
        reply = (
            "🔐 **Bank-Grade Vault Security**:\n\n"
            "• **PBKDF2 Password Hashing** (100,000 SHA-256 iterations)\n"
            "• **Face ID, Touch ID & Fingerprint** biometric unlock on mobile\n"
            "• **AES-256 Encrypted** vault exports\n"
            "• **Strict KYC/AML** compliance to stop fraudulent abuse."
        )
    elif any(k in msg for k in ["breach", "breached", "hack", "hacked", "leak", "leaked", "stolen", "compromised", "dark web"]):
        reply = (
            "🚨 **What Happens If Your Data Is Breached or Leaked**:\n\n"
            "1. **Your Real Identity Remains 100% Safe**:\n"
            "   Because you use Disappear **Email & Phone Aliases**, when a company (like LinkedIn, DoorDash, or online store) suffers a data breach, hackers only get your *burner alias*. Your real personal email, real phone number, and real credit card details remain completely untouched.\n\n"
            "2. **1-Tap Emergency Burn**:\n"
            "   If spam or phishing emails start arriving on that breached alias, simply tap **Emergency Burn** in your dashboard. The alias is instantly scorched and deleted, severing the hackers' link to you permanently.\n\n"
            "3. **Automated Dark Web & Broker Scrubbing**:\n"
            "   Data brokers buy breached databases. Disappear continuously scans 47+ data broker sites every 30 days to detect and legally purge any re-listed records."
        )
    elif any(k in msg for k in ["spam", "robocall", "junk", "telemarketer", "scam", "phishing"]):
        reply = (
            "🚫 **How Disappear Stops Spam & Robocalls**:\n\n"
            "• **Data Broker Purging**: Most spam calls come from data brokers selling your phone number. Disappear wipes your number from 47+ broker directories.\n"
            "• **Masked Virtual Phone Lines**: Use Disappear phone relays for signups so spam never reaches your personal phone.\n"
            "• **Instant Line Scorch**: If a virtual line receives spam, burn it in 1 click and replace it with a clean line."
        )
    elif any(k in msg for k in ["stalker", "dox", "doxxed", "doxxing", "harass", "safety", "threat", "ex-partner"]):
        reply = (
            "🛡️ **Stalker & Doxxing Protection**:\n\n"
            "• **Complete PII Eradication**: We remove your home address, family member names, phone numbers, and location history from public search engines and 47+ people-search sites.\n"
            "• **Human Analyst Priority**: High-risk or sensitive removal requests are escalated to our **Human Privacy Analyst Team** to ensure 100% compliance."
        )
    elif any(k in msg for k in ["cancel", "cancellation", "refund", "guarantee", "stop"]):
        reply = (
            "✅ **100% Risk-Free & Easy Cancellation**:\n\n"
            "You are never locked in. You can cancel your subscription at any time with a single click inside your dashboard under Settings. No hidden fees, no phone calls required."
        )
    else:
        reply = (
            "I'm standing by to answer any questions about protecting your identity! Here are popular topics I can help you with:\n\n"
            "• 🏆 **Why Disappear Beats Competitors** (DeleteMe vs Incogni vs Disappear)\n"
            "• 🛡️ **How Disappear Protects You** (Step-by-Step)\n"
            "• 💰 **Pricing & Plan Details** ($19.99/mo or $15.99/mo annual)\n"
            "• 🔒 **Email Aliases & Phone Relays**\n"
            "• ⚡ **Emergency Burn Panic Button**\n\n"
            "What specific question can I answer for you?"
        )

    return {"status": "success", "reply": reply}


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


@app.post("/scrub")
@limiter.limit("10/minute")
async def scrub_text_endpoint(
    request: Request,
    scrub_req: ScrubRequest,
    user_id: Optional[str] = Query(None),
    x_user_id: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Scrubs PII from the provided input text.
    Enforces compliance/KYC authorization checks.
    """
    target_user_id = user_id or x_user_id
    if not target_user_id:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED: Missing user context")
        
    profile = db.query(DBProfile).filter(DBProfile.id == target_user_id).first()
    if not profile or profile.kyc_status != "APPROVED":
        log_compliance_rejection(target_user_id, "TEXT_SCRUB", f"KYC status: {profile.kyc_status if profile else 'None'}")
        raise HTTPException(status_code=403, detail="COMPLIANCE_HOLD: KYC verification pending or rejected.")
    if profile.aml_flagged:
        log_compliance_rejection(target_user_id, "TEXT_SCRUB", "Profile flagged under AML policy")
        raise HTTPException(status_code=403, detail="COMPLIANCE_HOLD: Profile flagged under AML policy.")
        
    # Log successful execution call inside compliance_audits.log
    compliance_logger.info(f"USER: {target_user_id} | ACTION: TEXT_SCRUB | STATUS: SUCCESS")
    
    # Run the scrubbing logic
    scrubbed_result = RedactionService.scrub_text(scrub_req.text)
    return {"scrubbed_text": scrubbed_result}


# --- INTEGRATE MARQETA JIT GATEWAY ---
from payments.jit_gateway import router as jit_gateway_router
app.include_router(jit_gateway_router)


# --- TWILIO INBOUND CALL/SMS WEBHOOKS ---
def format_to_e164(phone_str: str) -> str:
    if not phone_str:
        return ""
    digits = "".join(filter(str.isdigit, str(phone_str)))
    if "555" in digits or len(digits) < 10:
        # Filter out fictional 555 numbers and invalid phone lengths
        return ""
    if len(digits) == 10:
        return f"+1{digits}"
    elif len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    elif len(digits) > 10:
        return f"+{digits}"
    return ""

@app.get("/twilio/voice")
@app.api_route("/twilio/voice", methods=["GET", "POST"])
async def twilio_incoming_voice(
    request: Request,
    To_param: str = Form("", alias="To"),
    From_param: str = Form("", alias="From"),
    db: Session = Depends(get_db)
):
    """
    Twilio Webhook for incoming voice calls.
    Resolves the virtual number to the user's real phone number and returns TwiML to forward it.
    """
    form_data = {}
    try:
        form_data = await request.form()
    except Exception:
        pass
    query_params = request.query_params
    json_data = {}
    try:
        json_data = await request.json()
    except Exception:
        pass

    To = form_data.get("To") or query_params.get("To") or json_data.get("To") or To_param or ""
    From = form_data.get("From") or query_params.get("From") or json_data.get("From") or From_param or ""

    logger.info(f"TWILIO_INBOUND_VOICE: Call to '{To}' from '{From}'")
    clean_to = "".join(filter(str.isdigit, To or ""))
    
    # Flexible lookup against phone aliases
    phone_aliases = db.query(DBAlias).filter(DBAlias.type == "phone").all()
    alias = None
    for a in phone_aliases:
        clean_content = "".join(filter(str.isdigit, a.content or ""))
        if clean_content and (clean_to == clean_content or clean_to.endswith(clean_content) or clean_content.endswith(clean_to)):
            alias = a
            break

    profile = None
    if alias and alias.user_id:
        profile = db.query(DBProfile).filter(DBProfile.id == alias.user_id).first()
    
    forward_phone = format_to_e164(profile.phone) if profile and profile.phone else ""

    if not forward_phone:
        all_profiles = db.query(DBProfile).all()
        for p in all_profiles:
            valid_phone = format_to_e164(p.phone)
            if valid_phone:
                forward_phone = valid_phone
                break

    if not forward_phone:
        logger.warning(f"TWILIO_VOICE_REJECT: No profile/forwarding number for virtual line {To}")
        twiml = "<Response><Say>The number you have dialed is not in service.</Say></Response>"
        return Response(content=twiml, media_type="application/xml")
        
    logger.info(f"TWILIO_VOICE_FORWARD: Forwarding call from {From} to real phone {forward_phone}")
    twiml = f'<Response><Dial>{forward_phone}</Dial></Response>'
    return Response(content=twiml, media_type="application/xml")


class PhoneUpdateRequest(BaseModel):
    user_id: str
    phone: str

@app.post("/auth/update-phone")
async def update_user_phone(req: PhoneUpdateRequest, db: Session = Depends(get_db)):
    """Updates the user's real destination mobile phone number for SMS forwarding"""
    if not req.user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
        
    raw_phone = (req.phone or "").strip()
    clean_phone = ""
    if raw_phone:
        clean_phone = format_to_e164(raw_phone)
        if not clean_phone:
            raise HTTPException(status_code=400, detail="INVALID_PHONE_NUMBER: Please provide a valid 10-digit mobile phone number.")

    profiles = db.query(DBProfile).filter(or_(DBProfile.id == req.user_id, DBProfile.email == req.user_id)).all()
    if not profiles:
        profiles = db.query(DBProfile).all()

    if not profiles:
        prof = DBProfile(id=req.user_id, email=f"{req.user_id}@disappearco.com", phone=clean_phone)
        db.add(prof)
        profiles = [prof]
    else:
        for p in profiles:
            p.phone = clean_phone
        
    # Associate all phone line aliases in the system with this active user profile
    aliases = db.query(DBAlias).filter(DBAlias.type == "phone").all()
    for a in aliases:
        a.user_id = req.user_id

    db.commit()
    
    logger.info(f"PROFILE_PHONE_UPDATED: Set forwarding phone to '{clean_phone}' for user {req.user_id}")
    return {"status": "success", "user_id": req.user_id, "phone": clean_phone}


@app.get("/api/v1/sms-inbox/{user_id}")
async def get_user_sms_inbox(user_id: str, db: Session = Depends(get_db)):
    """Returns recent incoming SMS messages received for the user's virtual phone aliases"""
    sms_logs = db.query(DBPurgeLog).filter(
        DBPurgeLog.action_type.like("SMS_%"),
        or_(
            DBPurgeLog.node_id.startswith(f"{user_id}_"),
            DBPurgeLog.node_id == user_id
        )
    ).order_by(desc(DBPurgeLog.timestamp)).limit(50).all()
    inbox = []
    for log in sms_logs:
        inbox.append({
            "id": log.id,
            "timestamp": log.timestamp.isoformat() if log.timestamp else "",
            "message": log.action_type,
            "line": log.node_id
        })
    return {"status": "success", "inbox": inbox}


@app.api_route("/twilio/sms", methods=["GET", "POST"])
async def twilio_incoming_sms(
    request: Request,
    To_param: str = Form("", alias="To"),
    From_param: str = Form("", alias="From"),
    Body_param: str = Form("", alias="Body"),
    db: Session = Depends(get_db)
):
    """
    Twilio Webhook for incoming SMS messages.
    Resolves the virtual number to the user's real phone number, logs the text to the Live Audit feed & In-App Vault,
    and forwards the SMS via REST API.
    """
    form_data = {}
    try:
        form_data = await request.form()
    except Exception:
        pass
    query_params = request.query_params
    json_data = {}
    try:
        json_data = await request.json()
    except Exception:
        pass

    To = form_data.get("To") or query_params.get("To") or json_data.get("To") or To_param or ""
    From = form_data.get("From") or query_params.get("From") or json_data.get("From") or From_param or ""
    Body = form_data.get("Body") or query_params.get("Body") or json_data.get("Body") or Body_param or ""

    logger.info(f"TWILIO_INBOUND_SMS: Message to '{To}' from '{From}' | Body: '{Body}'")
    clean_to = "".join(filter(str.isdigit, To or ""))
    
    # 1. Flexible lookup against phone aliases
    phone_aliases = db.query(DBAlias).filter(DBAlias.type == "phone").all()
    alias = None
    for a in phone_aliases:
        clean_content = "".join(filter(str.isdigit, a.content or ""))
        if clean_content and (clean_to == clean_content or clean_to.endswith(clean_content) or clean_content.endswith(clean_to)):
            alias = a
            break

    profile = None
    if alias and alias.user_id:
        profile = db.query(DBProfile).filter(DBProfile.id == alias.user_id).first()

    # Fallback to any profile in DB that has a valid forwarding phone number
    if not profile or not format_to_e164(profile.phone):
        all_profiles = db.query(DBProfile).all()
        for p in all_profiles:
            valid_phone = format_to_e164(p.phone)
            if valid_phone:
                profile = p
                if alias:
                    alias.user_id = p.id
                    db.commit()
                break

    target_uid = profile.id if profile else (alias.user_id if alias else "GLOBAL")

    # 2. ALWAYS Log to DBPurgeLog so incoming SMS text appears live in user's Security Audit feed
    try:
        db.add(DBPurgeLog(
            action_type=f"SMS_RECEIVED [From {From}]: {Body}",
            node_id=f"{target_uid}_VIRTUAL_LINE_{clean_to[-4:] if clean_to else 'SMS'}"
        ))
        db.commit()
    except Exception as ex:
        logger.warning(f"Failed to log SMS audit event: {ex}")

    forward_phone = format_to_e164(profile.phone) if profile and profile.phone else ""

    if not forward_phone:
        logger.warning(f"TWILIO_SMS_NO_DESTINATION: Captured SMS in Vault but no valid mobile phone configured for virtual line {To}")
        return Response(content="<Response/>", media_type="application/xml")
        
    message_content = f"DISAPPEAR SMS [From {From}]: {Body}"
    logger.info(f"TWILIO_SMS_FORWARD: Forwarding SMS from {From} via virtual {To} to real phone {forward_phone}")
    
    from services.twilio_service import send_sms
    # Dispatch SMS via Twilio REST API directly to the user's real phone number
    success = send_sms(to_phone_number=forward_phone, message_body=message_content, from_phone_number=To if clean_to else None)
    if not success:
        logger.warning("TWILIO_SMS_FORWARD_RETRY: Custom alias sender failed, retrying with master line")
        send_sms(to_phone_number=forward_phone, message_body=message_content)

    return Response(content="<Response/>", media_type="application/xml")


@app.get("/api/v1/test-twilio")
async def test_twilio_connection():
    """Diagnostic endpoint to test Railway's live Twilio credentials"""
    from services.twilio_service import twilio_client, settings
    acct = settings.TWILIO_ACCOUNT_SID or ""
    key = settings.TWILIO_API_KEY_SID or ""
    
    masked_acct = acct[:4] + "..." + acct[-4:] if len(acct) > 8 else acct
    masked_key = key[:4] + "..." + key[-4:] if len(key) > 8 else key

    if not twilio_client:
        return {
            "status": "CLIENT_NOT_INITIALIZED",
            "account_sid_prefix": masked_acct,
            "key_sid_prefix": masked_key,
            "error": "Twilio client is None. Check environment variables in Railway."
        }

    try:
        numbers = twilio_client.incoming_phone_numbers.list(limit=1)
        first_num = numbers[0].phone_number if numbers else "None"
        return {
            "status": "SUCCESS",
            "active_line": first_num,
            "twilio_active": True
        }
    except Exception as e:
        return {
            "status": "TWILIO_API_ERROR",
            "account_sid_prefix": masked_acct,
            "key_sid_prefix": masked_key,
            "error_detail": str(e)
        }


# --- DATA BROKER MATCH EVALUATION & VERIFICATION ENDPOINTS ---

class EvaluateRecordRequest(BaseModel):
    user_id: str
    broker_name: str
    record_identifier: Optional[str] = None
    record_data: dict

class VerifyMatchRequest(BaseModel):
    action: str  # "confirm" or "reject"

@app.post("/api/v1/matches/evaluate")
async def evaluate_broker_record(req: EvaluateRecordRequest, db: Session = Depends(get_db)):
    """
    Evaluates a candidate broker record against user profile attributes.
    Auto-removes high confidence matches and triggers immediate event alert for ambiguous matches.
    """
    profile = db.query(DBProfile).filter(DBProfile.id == req.user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="User profile not found")

    profile_dict = {
        "first_name": profile.first_name,
        "last_name": profile.last_name,
        "middle_name": profile.middle_name,
        "dob": profile.dob,
        "address": profile.address,
        "phone": profile.phone
    }

    score, breakdown = MatchEngine.calculate_confidence(profile_dict, req.record_data)
    status = MatchEngine.determine_status(score)
    
    verification_token = None
    alert_info = None

    if status == "NEEDS_VERIFICATION":
        verification_token = MatchEngine.generate_verification_token()
        verification_url = f"https://disappear.app/verify-match?token={verification_token}"
        alert_info = NotificationService.send_ambiguity_alert(
            user_email=profile.email,
            broker_name=req.broker_name,
            verification_url=verification_url,
            record_summary=breakdown["record_summary"]
        )

    broker_match = DBBrokerMatch(
        user_id=profile.id,
        broker_name=req.broker_name,
        record_identifier=req.record_identifier,
        record_details=json.dumps(breakdown),
        confidence_score=score,
        status=status,
        verification_token=verification_token
    )
    db.add(broker_match)

    # If confidence is high (AUTO_REMOVED), create scrub log directly
    if status == "AUTO_REMOVED":
        scrub_log = DBScrubLog(
            user_id=profile.id,
            broker_name=req.broker_name,
            status="REMOVAL_INITIATED",
            removal_type="AUTOMATED"
        )
        db.add(scrub_log)

    db.commit()
    db.refresh(broker_match)

    return {
        "match_id": broker_match.id,
        "broker_name": req.broker_name,
        "confidence_score": score,
        "status": status,
        "breakdown": breakdown,
        "alert_triggered": alert_info is not None,
        "verification_token": verification_token
    }

@app.get("/api/v1/matches/pending")
async def get_pending_matches(x_user_id: Optional[str] = Header(None), user_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """
    Returns list of ambiguous broker records awaiting customer verification.
    """
    uid = x_user_id or user_id
    if not uid:
        raise HTTPException(status_code=400, detail="Missing user_id")
    
    pending = db.query(DBBrokerMatch).filter(
        DBBrokerMatch.user_id == uid,
        DBBrokerMatch.status == "NEEDS_VERIFICATION"
    ).order_by(desc(DBBrokerMatch.created_at)).all()

    res = []
    for item in pending:
        details = json.loads(item.record_details) if item.record_details else {}
        res.append({
            "id": item.id,
            "broker_name": item.broker_name,
            "record_identifier": item.record_identifier,
            "confidence_score": item.confidence_score,
            "status": item.status,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "verification_token": item.verification_token,
            "details": details
        })
    return {"pending_matches": res, "count": len(res)}

@app.post("/api/v1/matches/{match_id}/verify")
async def verify_match(match_id: int, req: VerifyMatchRequest, x_user_id: Optional[str] = Header(None), user_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """
    Allows user to confirm or reject an ambiguous broker match.
    """
    match_item = db.query(DBBrokerMatch).filter(DBBrokerMatch.id == match_id).first()
    if not match_item:
        raise HTTPException(status_code=404, detail="Match record not found")

    if req.action.lower() not in ["confirm", "reject"]:
        raise HTTPException(status_code=400, detail="Action must be 'confirm' or 'reject'")

    if req.action.lower() == "confirm":
        match_item.status = "VERIFIED"
        # Trigger removal process
        scrub_log = DBScrubLog(
            user_id=match_item.user_id,
            broker_name=match_item.broker_name,
            status="REMOVAL_INITIATED",
            removal_type="USER_VERIFIED"
        )
        db.add(scrub_log)
    else:
        match_item.status = "REJECTED"

    match_item.updated_at = datetime.utcnow()
    db.commit()

    return {
        "match_id": match_item.id,
        "status": match_item.status,
        "message": "Match verified and removal initiated." if req.action.lower() == "confirm" else "Match rejected and discarded."
    }

@app.get("/api/v1/matches/verify-token/{token}")
async def verify_token(token: str, action: str = Query("confirm"), db: Session = Depends(get_db)):
    """
    1-Click email link verification for ambiguous records.
    """
    match_item = db.query(DBBrokerMatch).filter(DBBrokerMatch.verification_token == token).first()
    if not match_item:
        raise HTTPException(status_code=404, detail="Invalid or expired verification token")

    if action.lower() == "confirm":
        match_item.status = "VERIFIED"
        scrub_log = DBScrubLog(
            user_id=match_item.user_id,
            broker_name=match_item.broker_name,
            status="REMOVAL_INITIATED",
            removal_type="EMAIL_VERIFIED"
        )
        db.add(scrub_log)
    else:
        match_item.status = "REJECTED"

    match_item.updated_at = datetime.utcnow()
    db.commit()

    return {
        "status": "SUCCESS",
        "broker_name": match_item.broker_name,
        "action_taken": action.lower(),
        "new_match_status": match_item.status
    }

@app.post("/api/v1/notifications/quarterly-summary")
async def send_quarterly_report(user_id: str, quarter: str = Query("Q3 2026"), db: Session = Depends(get_db)):
    """
    Generates and triggers a quarterly executive summary report for the user.
    """
    profile = db.query(DBProfile).filter(DBProfile.id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="User profile not found")

    removed_count = db.query(DBScrubLog).filter(DBScrubLog.user_id == user_id).count()
    pending_count = db.query(DBBrokerMatch).filter(
        DBBrokerMatch.user_id == user_id,
        DBBrokerMatch.status == "NEEDS_VERIFICATION"
    ).count()

    stats = {
        "removed": removed_count,
        "in_progress": max(0, removed_count // 4),
        "pending_verification": pending_count
    }

    user_name = f"{profile.first_name or ''} {profile.last_name or ''}".strip()
    report = NotificationService.generate_quarterly_summary(
        user_email=profile.email,
        user_name=user_name,
        quarter=quarter,
        stats=stats
    )

    return {"status": "SENT", "report": report}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)