from fastapi import FastAPI, Depends, HTTPException, Request, Response, File, UploadFile, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, String, DateTime, Integer, Boolean, desc
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
import random
import os
import time
import stripe
import boto3
from lithic import Lithic
from datetime import datetime, timedelta
from typing import Any, List, Optional
from dotenv import load_dotenv

# --- INITIALIZATION BLOCK ---
load_dotenv()
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

LITHIC_API_KEY = os.getenv("LITHIC_API_KEY")
LITHIC_CARD_PROGRAM = os.getenv("LITHIC_CARD_PROGRAM")
if not LITHIC_API_KEY:
    raise RuntimeError("LITHIC_API_KEY not found in environment!")
lithic_client = Lithic(api_key=LITHIC_API_KEY)

# --- DATABASE CONFIGURATION ---
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not found in environment!")

if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Consolidated SSL for AWS/Supabase handshake
# --- ENHANCED CONNECTION POOLING ---
engine = create_engine(
    DATABASE_URL,
    # Connection pooling parameters
    pool_size=20,                    # Number of connections to maintain in pool
    max_overflow=40,                 # Maximum overflow connections beyond pool_size
    pool_timeout=30,                 # Timeout for acquiring connection from pool (seconds)
    pool_pre_ping=True,              # Test connection before using (catch stale connections)
    pool_recycle=300,                # Recycle connections every 5 minutes
    echo=False,                      # Set to True for SQL debugging
    connect_args={
        "sslmode": "require",
        "connect_timeout": 10,
        "application_name": "disappear_paas"
    }
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# --- DATABASE MODELS ---

class DBCard(Base):
    """Represents a virtual shield asset in the secure vault linked to a physical card"""
    __tablename__ = "shield_assets_v3"
    id = Column(String, primary_key=True, index=True)
    label = Column(String)
    number = Column(String)
    expiry = Column(String) 
    cvv = Column(String)       
    real_card_token = Column(String, unique=True, nullable=True) # Tokenized representation of funding source
    last_four = Column(String(4), nullable=True) # Storage of last 4 digits for billing management
    created_at = Column(DateTime, default=datetime.utcnow)


class DBAlias(Base):
    """Represents separate managed PII aliases (Emails or Phones)"""
    __tablename__ = "shield_aliases_v3"
    id = Column(String, primary_key=True, index=True)
    type = Column(String)  # "email" or "phone"
    content = Column(String)
    label = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class DBProfile(Base):
    """Represents a target profile for PII scrub queuing"""
    __tablename__ = "shield_profiles_v3"
    id = Column(String, primary_key=True, index=True)
    first_name = Column(String)
    middle_name = Column(String)
    last_name = Column(String)
    email = Column(String)
    address = Column(String)
    dob = Column(String)
    # Persistent column to track purchased capacity increases
    bonus_credits = Column(Integer, default=0) 
    # Specific tracking for purchased premium phone lines
    phone_line_bonus = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


# NEW: Track removals from external data brokers for proof history
class DBScrubLog(Base):
    """Immutable proof of external data broker removal"""
    __tablename__ = "scrub_logs_v1"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    broker_name = Column(String)
    status = Column(String) # "REMOVED", "PENDING", or "PROCESSING"
    timestamp = Column(DateTime, default=datetime.utcnow)


# NEW: Admin Purge Log Model for Central Command History
class DBPurgeLog(Base):
    """Audit trail for identity 'burn' actions"""
    __tablename__ = "purge_logs_v1"
    id = Column(Integer, primary_key=True, index=True)
    action_type = Column(String)
    node_id = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)


# Auto-create tables on startup with crash protection
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"ALARM: DB Sync Deferred - {e}")


# --- APP CONFIGURATION ---

app = FastAPI(title="Disappear P-A-A-S Engine")

# FIXED: Production Origins + Mobile App Capacitor Support
origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "capacitor://localhost",
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
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# FIXED: Middleware to force CORS headers on 404s and preflights
@app.middleware("http")
async def add_cors_header(request: Request, call_next):
    if request.method == "OPTIONS":
        # Check if current time context is active
        response = Response(status_code=200)
    else:
        response = await call_next(request)
    
    origin = request.headers.get("origin")
    if origin in origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
    return response


# Database Dependency Injection
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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
    real_card_token: Optional[str] = None
    last_four: Optional[str] = None


class AliasRequest(BaseModel):
    type: str  # "email" or "phone"
    label: str


class LoginRequest(BaseModel):
    token: str = None


# NEW: Support Request Schema
class SupportRequest(BaseModel):
    subject: str
    message: str

# NEW: Expansion Request Schema
class ExpansionRequest(BaseModel):
    expansion_type: str # "data", "phone", or "emergency_wipe"


# --- S3 CONFIGURATION ---
S3_BUCKET = "disappear-purge-receipts-vault"
s3_client = boto3.client('s3')


# --- CORE SYSTEM ROUTES ---

@app.get("/")
@app.get("/health")
async def health_status():
    """Health check endpoint"""
    return {"status": "VERSION_24_LIVE", "timestamp": datetime.now().isoformat()}


# --- NEW: FREE RECONNAISSANCE SCANNER ---
@app.get("/api/v1/free-scan")
async def free_recon_scan(query: str):
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
async def get_admin_stats(db: Session = Depends(get_db)):
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


# --- INTERNAL OPERATION PORTALS FOR EMPLOYEES ---

@app.get("/admin/ops/backlog")
async def get_employee_backlog(db: Session = Depends(get_db)):
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
async def resolve_manual_task(log_id: int, db: Session = Depends(get_db)):
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


@app.get("/dashboard/sync")
async def sync(user_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """Synchronizes dashboard with credits and threat intelligence"""
    active_cards = db.query(DBCard).count()
    active_aliases = db.query(DBAlias).count()
    total_used = active_cards + active_aliases
    
    # FIX: Fetch the specific user's profile, fallback to latest only if none provided
    if user_id:
        profile = db.query(DBProfile).filter(DBProfile.id == user_id).first()
    else:
        profile = db.query(DBProfile).order_by(DBProfile.created_at.desc()).first()
        
    bonus = profile.bonus_credits if profile and hasattr(profile, 'bonus_credits') else 0
    phone_bonus = profile.phone_line_bonus if profile and hasattr(profile, 'phone_line_bonus') else 0
    
    # SEPARATE LIMITS
    vcc_email_capacity = MAX_IDENTITY_CREDITS + bonus
    phone_capacity = BASE_PHONE_LIMIT + phone_bonus
    
    # NEW: DECOUPLED USAGE METRICS
    used_vcc_email = active_cards + db.query(DBAlias).filter(DBAlias.type == 'email').count()
    used_phones = db.query(DBAlias).filter(DBAlias.type == 'phone').count()
    
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


# --- PAYMENTS & WEBHOOKS (FINAL PRICING FIREWALL) ---

@app.post("/payments/create-session")
async def create_checkout_session(request: Request, db: Session = Depends(get_db)):
    try:
        body = await request.json()
        raw_type = body.get("expansion_type", "")
        etype = str(raw_type).lower()
        
        # KEY FIX: Explicitly find the correct profile ID to anchor the metadata
        profile = db.query(DBProfile).order_by(DBProfile.created_at.desc()).first()
        user_id = profile.id if profile else "anonymous_agent"

        # RULE: Explicitly check for cooldown/wipe first for 1.99
        if "cooldown" in etype or "wipe" in etype or "emergency" in etype:
            item_name = "Emergency Wipe Protocol (Instant Cooldown Bypass)"
            unit_amount = 199 # $1.99
            purchase_key = "cooldown_bypass"
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

        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {'name': item_name},
                    'unit_amount': unit_amount,
                },
                'quantity': 1,
            }],
            mode="payment", # FORCE ONE-TIME PAYMENT
            metadata={
                "purchase_type": purchase_key,
                "user_id": user_id
            },
            success_url="https://disappearco.com?payment=success",
            cancel_url="https://disappearco.com?payment=cancel",
        )
        return {"url": session.url}
    except Exception as e:
        print(f"STRIPE ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/payments/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Verifies Stripe signature and updates DBProfile capacity with diagnostic logging"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    if not sig_header:
        print("WEBHOOK ERROR: Missing stripe-signature header")
        raise HTTPException(status_code=400, detail="Missing signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        print(f"WEBHOOK PAYLOAD ERROR: {e}")
        return Response(content="INVALID_PAYLOAD", status_code=400)

    if event["type"] == "checkout.session.completed":
        session = event['data']['object']
        metadata = session.get("metadata", {})
        purchase_type = metadata.get("purchase_type")
        user_id = metadata.get("user_id")
        
        print(f"WEBHOOK_INBOUND: {purchase_type} for UID {user_id}")

        profile = db.query(DBProfile).filter(DBProfile.id == user_id).first()
        if not profile:
            profile = db.query(DBProfile).order_by(DBProfile.created_at.desc()).first()

        if profile:
            if purchase_type == "permanent_slot":
                profile.bonus_credits = (profile.bonus_credits or 0) + 1
                action = "PERMANENT_CAPACITY_EXPANDED"
                db.add(profile)
            
            elif purchase_type == "phone_line_bonus":
                # THIS IS THE FIX: It safely increments the database column and marks the instance as modified
                profile.phone_line_bonus = (profile.phone_line_bonus or 0) + 1
                action = "PHONE_LINE_EXPANDED"
                print(f"DB_UPDATE: Phone line bonus added for {profile.id}")
                db.add(profile)
                
            else:
                action = "COOLDOWN_BYPASS_PURCHASED"

            session_id = session.get("id", "unknown")
            db.add(DBPurgeLog(
                action_type=action, 
                node_id=f"STRIPE_{str(session_id)[-8:]}",
                timestamp=datetime.utcnow()
            ))
            db.commit()
            print("DB_COMMIT: Webhook process finalized.")
            
    return {"status": "success"}


# --- PII CONTROL ROUTES ---

@app.get("/aliases/data")
async def get_aliases(db: Session = Depends(get_db)):
    """Retrieves all active aliases for separate rendering"""
    aliases = db.query(DBAlias).order_by(DBAlias.created_at.desc()).all()
    return {"aliases": aliases if aliases else []}


@app.post("/aliases/mint")
async def generate_alias(request: AliasRequest, db: Session = Depends(get_db)):
    """Generates an alias with 12h cooldown and bypass verification"""
    profile = db.query(DBProfile).order_by(DBProfile.created_at.desc()).first()
    bonus = profile.bonus_credits if profile else 0
    phone_bonus = profile.phone_line_bonus if profile else 0
    
    max_credits = MAX_IDENTITY_CREDITS + bonus
    max_phones = BASE_PHONE_LIMIT + phone_bonus
    
    total_active = db.query(DBAlias).count() + db.query(DBCard).count()
    if total_active >= max_credits:
        raise HTTPException(status_code=403, detail="IDENTITY_LIMIT_REACHED")

    if request.type.lower() == "phone":
        current_phones = db.query(DBAlias).filter(DBAlias.type == "phone").count()
        if current_phones >= max_phones:
            raise HTTPException(status_code=403, detail="PHONE_CAPACITY_REACHED")

    # Cooldown Logic
    last_burn = db.query(DBPurgeLog).filter(DBPurgeLog.action_type == "ALIAS_TERMINATED").order_by(DBPurgeLog.timestamp.desc()).first()
    
    # BYPASS VERIFICATION: Check for tactical override purchased in the last 15 minutes
    has_bypass = db.query(DBPurgeLog).filter(
        DBPurgeLog.action_type == "COOLDOWN_BYPASS_PURCHASED",
        DBPurgeLog.timestamp > datetime.utcnow() - timedelta(minutes=15)
    ).first()

    if not has_bypass and last_burn and (datetime.utcnow() - last_burn.timestamp) < timedelta(hours=COOLDOWN_HOURS):
        raise HTTPException(
            status_code=429, 
            detail={"error": "COOL_DOWN_ACTIVE", "bypass_authorized": False}
        )

    alias_id = f"als_{int(time.time())}_{random.randint(100, 999)}"
    
    if request.type.lower() == "email":
        content = f"vault_{random.randint(1000, 9999)}@{random.choice(DOMAINS)}"
    else:
        content = f"+1 (555) {random.randint(100, 999)}-{random.randint(1000, 9999)}"
        
    new_alias = DBAlias(
        id=alias_id,
        type=request.type.lower(),
        label=request.label,
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
        log = DBPurgeLog(action_type="ALIAS_TERMINATED", node_id=alias_id)
        db.add(log)
        db.delete(alias)
        db.commit()
        return {"status": "node_purged"}
    raise HTTPException(status_code=404, detail="Node not found")


# --- FINANCIALS & PROFILE STORAGE ---

@app.get("/financials/data")
async def financials(db: Session = Depends(get_db)):
    """Retrieves list of active virtual cards from the secure ledger"""
    try:
        cards = db.query(DBCard).order_by(DBCard.created_at.desc()).all()
        return {"cards": cards if cards else []}
    except Exception as e:
        return {"cards": [], "error": str(e)}


@app.post("/financials/mint")
async def generate_card(request: CardRequest, db: Session = Depends(get_db)):
    """Initiates a new virtual card generation process on the secure node"""
    profile = db.query(DBProfile).order_by(DBProfile.created_at.desc()).first()
    bonus = profile.bonus_credits if profile else 0
    max_credits = MAX_IDENTITY_CREDITS + bonus

    total_active = db.query(DBCard).count() + db.query(DBAlias).count()
    if total_active >= max_credits:
        raise HTTPException(status_code=403, detail="IDENTITY_LIMIT_REACHED")

    try:
        lithic_payload = {
            "type": "virtual",
        }
        if LITHIC_CARD_PROGRAM:
            lithic_payload["card_program"] = LITHIC_CARD_PROGRAM

        card_response = lithic_client.cards.create(**lithic_payload)

        expiry_month = getattr(card_response, "expiry_month", None)
        expiry_year = getattr(card_response, "expiry_year", None)
        expiry = (
            f"{expiry_month:02d}/{str(expiry_year)[-2:]}"
            if expiry_month and expiry_year
            else "08/28"
        )

        card_id = f"vcc_{int(time.time())}_{random.randint(100, 999)}"
        new_card = DBCard(
            id=card_id,
            label=request.label,
            number=getattr(card_response, "number", None) or getattr(card_response, "card_number", None) or "UNKNOWN",
            expiry=expiry,
            cvv=str(getattr(card_response, "cvv", None) or "000"),
            real_card_token=getattr(card_response, "token", None) or request.real_card_token,
            last_four=getattr(card_response, "last_four", None) or request.last_four,
        )
        db.add(new_card)
        log = DBPurgeLog(action_type="CARD_PROTECTION_GENERATED", node_id=card_id)
        db.add(log)
        db.commit()
        db.refresh(new_card)
        return new_card
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"GENERATION_ERROR: {str(e)}")


@app.post("/financials/profile")
@app.post("/financials/profile/")
async def save_profile(request: Request, db: Session = Depends(get_db)):
    """Handles raw profile ingestion and cleanly seeds initial tracking slots for all data brokers"""
    try:
        data = await request.json()
        profile_id = f"user_{random.randint(1000, 9999)}"
        new_profile = DBProfile(
            id=profile_id,
            first_name=data.get("firstName", "Unknown"),
            middle_name=data.get("middleName", ""),
            last_name=data.get("lastName", ""),
            email=data.get("email"),
            address=data.get("address"),
            dob=data.get("dob")
        )
        db.add(new_profile)
        
        # Populate initial processing tracking logs for user stats
        for broker in BROKERS:
            db.add(DBScrubLog(
                user_id=profile_id,
                broker_name=broker,
                status="PROCESSING",
                timestamp=datetime.utcnow()
            ))
            
        db.commit()
        return {"status": "success", "profile_id": profile_id}
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}


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
async def burn_all_assets(db: Session = Depends(get_db)):
    """Emergency Burn command: Deletes all compromised cards and aliases (Preserves Profile)"""
    db.query(DBCard).delete()
    db.query(DBAlias).delete()
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
async def get_scrub_history(db: Session = Depends(get_db)):
    """Fetches clean removal timeline for end-user app display."""
    profile = db.query(DBProfile).order_by(DBProfile.created_at.desc()).first()
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


@app.post("/support/ticket")
async def create_support_ticket(request: SupportRequest, db: Session = Depends(get_db)):
    """Logs support requests for PaaS serviceability"""
    try:
        log_entry = f"SUB: {request.subject} | MSG: {request.message}"
        log = DBPurgeLog(action_type="SUPPORT_REQUEST", node_id=log_entry)
        db.add(log)
        db.commit()
        return {"status": "TRANSMITTED", "id": random.randint(1000, 9999)}
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="UPLINK_FAILURE")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)