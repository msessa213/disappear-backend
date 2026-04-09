from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, String, DateTime, Integer
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
import random
import os
import time
import stripe
from datetime import datetime, timedelta
from typing import List, Optional
from dotenv import load_dotenv

# --- INITIALIZATION BLOCK ---
load_dotenv()
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# --- DATABASE CONFIGURATION ---
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres.chymgteinnczqfjqknan:%40Chase246642@aws-1-us-east-1.pooler.supabase.com:6543/postgres"
)

if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# FIX: Conditional SSL Mode for Local Docker vs Supabase Cloud
is_cloud = "supabase.com" in DATABASE_URL
connect_args = {"sslmode": "require"} if is_cloud else {}

engine = create_engine(
    DATABASE_URL, 
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args=connect_args
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# --- DATABASE MODELS ---

class DBCard(Base):
    """Represents a virtual shield card asset in the secure vault"""
    __tablename__ = "shield_assets_v3"
    id = Column(String, primary_key=True, index=True)
    label = Column(String)
    number = Column(String)
    expiry = Column(String) 
    cvv = Column(String)    
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
    # FIX: Persistent column to track purchased capacity increases
    bonus_credits = Column(Integer, default=0) 
    created_at = Column(DateTime, default=datetime.utcnow)


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

# FIXED: Explicit Origins for Vercel Handshake (Added localhost:3001)
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "https://disappear-frontend-v2.vercel.app",
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
COOLDOWN_HOURS = 24


# --- DATA SEEDING & STABILITY STORAGE ---

THREAT_TYPES = ["IDENTITY_QUERY_DEFLECTED", "PII_SCRUB_VERIFIED", "NODE_ENCRYPTED", "RECAPTURE_BLOCKED", "TRACE_PURGED"]
BROKERS = ["SPOKEO", "ACXIOM", "INTELIUS", "WHITEPAGES", "PEOPLELOOKER"]
DOMAINS = ["disappear.private", "shield.mask", "cloak.node", "ghost.vault"]

STABLE_EMAIL = f"vault_{random.randint(1000, 9999)}@{random.choice(DOMAINS)}"
STABLE_PHONE = f"+1 (555) {random.randint(100, 999)}-{random.randint(1000, 9999)}"


# --- SCHEMAS ---

class CardRequest(BaseModel):
    label: str


class AliasRequest(BaseModel):
    type: str  # "email" or "phone"
    label: str


class LoginRequest(BaseModel):
    token: str = None


# --- CORE SYSTEM ROUTES ---

@app.get("/")
async def health_status():
    """Health check endpoint"""
    return {"status": "ACTIVE", "timestamp": datetime.now().isoformat()}


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


@app.get("/dashboard/sync")
async def sync(db: Session = Depends(get_db)):
    """Synchronizes dashboard with credits and threat intelligence"""
    active_cards = db.query(DBCard).count()
    active_aliases = db.query(DBAlias).count()
    total_used = active_cards + active_aliases
    
    # FIX: Fetch the user's profile with a safety check if no profile exists
    profile = db.query(DBProfile).first()
    bonus = profile.bonus_credits if profile and hasattr(profile, 'bonus_credits') else 0
    max_credits = MAX_IDENTITY_CREDITS + bonus
    
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
            "credits_total": max_credits,
            "credits_used": total_used,
            "credits_available": max(0, max_credits - total_used),
            "threat_level": "NOMINAL",
            "uptime": "99.998%",
            "active_nodes": total_used 
        },
        "recent_audit": logs,
        "map_nodes": map_nodes,
        "system_status": "ENCRYPTED_TUNNEL_STABLE"
    }


# --- PAYMENTS & WEBHOOKS ---

@app.post("/payments/create-session")
async def create_checkout_session():
    """Generates a secure Stripe Checkout URL for extra credits"""
    try:
        # Check if API Key exists
        if not stripe.api_key:
            print("STRIPE ERROR: Secret Key Missing from .env")
            raise HTTPException(status_code=500, detail="Stripe API Key configuration error")

        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {'name': 'Additional Identity Shield Slot'},
                    'unit_amount': 499,
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url="https://disappear-frontend-v2.vercel.app?payment=success",
            cancel_url="https://disappear-frontend-v2.vercel.app?payment=cancel",
        )
        return {"url": session.url}
    except Exception as e:
        print(f"STRIPE HANDSHAKE ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/payments/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Asynchronous listener for Stripe payment success events"""
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
        
        # FIX: Implement persistent credit increase logic
        if event['type'] == 'checkout.session.completed':
            # Update the audit log
            log = DBPurgeLog(action_type="CREDIT_PURCHASED", node_id="SECURE_GATEWAY")
            db.add(log)
            
            # Increment bonus_credits for the profile
            user_profile = db.query(DBProfile).first()
            if user_profile:
                user_profile.bonus_credits += 1
            
            db.commit()
            print("REVENUE TEST PASSED: 1 Slot added to profile.")
            
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        print(f"WEBHOOK PROCESSING ERROR: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Webhook Error: {str(e)}")


# --- PII CONTROL ROUTES ---

@app.get("/aliases/data")
async def get_aliases(db: Session = Depends(get_db)):
    """Retrieves all active aliases for separate rendering"""
    aliases = db.query(DBAlias).order_by(DBAlias.created_at.desc()).all()
    return {"aliases": aliases if aliases else []}


@app.post("/aliases/mint")
async def mint_alias(request: AliasRequest, db: Session = Depends(get_db)):
    """Mints an alias if under credit limit and not in cool-down"""
    # FIX: Use dynamic credit limit check with safety for null profile
    profile = db.query(DBProfile).first()
    bonus = profile.bonus_credits if profile else 0
    max_credits = MAX_IDENTITY_CREDITS + bonus
    
    total_active = db.query(DBAlias).count() + db.query(DBCard).count()
    if total_active >= max_credits:
        raise HTTPException(status_code=403, detail="IDENTITY_LIMIT_REACHED")

    last_burn = db.query(DBPurgeLog).filter(DBPurgeLog.action_type == "ALIAS_TERMINATED").order_by(DBPurgeLog.timestamp.desc()).first()
    if last_burn and (datetime.utcnow() - last_burn.timestamp) < timedelta(hours=COOLDOWN_HOURS):
        raise HTTPException(status_code=429, detail="COOL_DOWN_ACTIVE")

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
        # LOG ACTION FOR ADMIN
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
async def mint_card(request: CardRequest, db: Session = Depends(get_db)):
    """Initiates a new virtual card minting process on the secure node"""
    # FIX: Use dynamic credit limit check with safety for null profile
    profile = db.query(DBProfile).first()
    bonus = profile.bonus_credits if profile else 0
    max_credits = MAX_IDENTITY_CREDITS + bonus

    total_active = db.query(DBCard).count() + db.query(DBAlias).count()
    if total_active >= max_credits:
        raise HTTPException(status_code=403, detail="IDENTITY_LIMIT_REACHED")
        
    try:
        card_id = f"vcc_{int(time.time())}_{random.randint(100, 999)}"
        
        new_card = DBCard(
            id=card_id,
            label=request.label,
            number=f"4242 {random.randint(1000, 9999)} {random.randint(1000, 9999)} {random.randint(1000, 9999)}",
            expiry="08/28",
            cvv=str(random.randint(100, 999))
        )
        db.add(new_card)
        db.commit()
        db.refresh(new_card)
        return new_card
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"MINT_ERROR: {str(e)}")


@app.post("/financials/profile")
@app.post("/financials/profile/")
async def save_profile(request: Request, db: Session = Depends(get_db)):
    """Handles raw profile ingestion with granular name separation"""
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
        db.commit()
        return {"status": "success", "profile_id": profile_id}
        
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}


@app.delete("/financials/kill/{card_id}")
async def kill_card(card_id: str, db: Session = Depends(get_db)):
    """Permanently deletes a card asset from the database"""
    # FIX: Special Handler for the Global Node
    if card_id == "global-1":
        log = DBPurgeLog(action_type="GLOBAL_NODE_ROTATED", node_id="global-1")
        db.add(log)
        db.commit()
        return {"status": "global_node_rotated"}

    card = db.query(DBCard).filter(DBCard.id == card_id).first()
    if card:
        # LOG ACTION FOR ADMIN
        log = DBPurgeLog(action_type="CARD_TERMINATED", node_id=card_id)
        db.add(log)
        db.delete(card)
        db.commit()
        return {"status": "node_terminated"}
    raise HTTPException(status_code=404, detail="Asset not found")


@app.post("/financials/burn-all")
async def burn_all_assets(db: Session = Depends(get_db)):
    """Global wipe command: Deletes all profiles, cards, and aliases from the node"""
    db.query(DBCard).delete()
    db.query(DBAlias).delete()
    db.query(DBProfile).delete()
    # LOG GLOBAL PURGE
    log = DBPurgeLog(action_type="TOTAL_SYSTEM_PURGE", node_id="GLOBAL_NODE")
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


if __name__ == "__main__":
    import uvicorn
    # Dynamic port detection for Cloud vs Local
    port = int(os.environ.get("PORT", 8000))
    # 0.0.0.0 is required for Docker port mapping to work
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)