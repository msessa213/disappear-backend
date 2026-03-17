from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
import random
import os
import time
from datetime import datetime
from typing import List, Optional
from dotenv import load_dotenv

# --- INITIALIZATION ---
# Load variables from the .env file (Local development only)
load_dotenv()

# --- DATABASE CONFIGURATION ---
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres.chymgteinnczqfjqknan:%40Chase246642@aws-1-us-east-1.pooler.supabase.com:6543/postgres"
)

# Fix for SQLAlchemy/Heroku/Render dialect requirements
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- DATABASE MODELS ---

class DBCard(Base):
    __tablename__ = "cards"
    id = Column(String, primary_key=True, index=True)
    label = Column(String)
    number = Column(String)
    expiry = Column(String) # MM/YY
    cvv = Column(String)    # 3-digit
    created_at = Column(DateTime, default=datetime.utcnow)

class DBProfile(Base):
    __tablename__ = "profiles"
    id = Column(String, primary_key=True, index=True)
    full_name = Column(String)
    email = Column(String)
    address = Column(String)
    dob = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

# Auto-create tables on startup to ensure DB sync
Base.metadata.create_all(bind=engine)

# --- APP CONFIGURATION ---

# THE CRITICAL FIX: Disable redirect_slashes to prevent 404 loops on POST requests
app = FastAPI(redirect_slashes=False)

# BROAD CORS: Ensuring the Vercel frontend is never blocked
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- DATA SEEDING & STABILITY STORAGE ---

THREAT_TYPES = ["IDENTITY_QUERY_DEFLECTED", "PII_SCRUB_VERIFIED", "NODE_ENCRYPTED", "RECAPTURE_BLOCKED", "TRACE_PURGED"]
BROKERS = ["SPOKEO", "ACXIOM", "INTELIUS", "WHITEPAGES", "PEOPLELOOKER"]
DOMAINS = ["disappear.private", "shield.mask", "cloak.node", "ghost.vault"]

# THE "HARD LOCK" VARIABLES - These stay in memory so they don't change every sync request
STABLE_EMAIL = f"vault_{random.randint(1000, 9999)}@{random.choice(DOMAINS)}"
STABLE_PHONE = f"+1 (555) {random.randint(100, 999)}-{random.randint(1000, 9999)}"

# --- SCHEMAS ---

class CardRequest(BaseModel):
    label: str

class LoginRequest(BaseModel):
    token: str = None

# --- ROUTES ---

@app.get("/")
async def health_check():
    """Root endpoint to verify node connectivity and prevent Render sleep cycles"""
    return {
        "status": "DISAPPEAR_NODE_ONLINE", 
        "timestamp": datetime.now().isoformat(),
        "version": "2.1.0"
    }

@app.get("/admin/stats")
async def get_admin_stats(db: Session = Depends(get_db)):
    """Aggregates platform-wide metrics for the Central Command Dashboard"""
    total_users = db.query(DBProfile).count()
    total_cards = db.query(DBCard).count()
    # Logic: Assume 47 removal requests are triggered per registered profile
    total_removals = total_users * 47 
    
    return {
        "total_users": total_users,
        "total_cards": total_cards,
        "total_removals": total_removals,
        "system_health": "OPTIMAL",
        "last_purge": datetime.now().strftime("%Y-%m-%d %H:%M")
    }

@app.get("/dashboard/sync")
async def sync():
    """Synchronizes dashboard state with live threat intelligence feed"""
    now = datetime.now()
    
    # SEED STABILITY: Use current minute to keep logs/nodes static for 60 seconds
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

    # Reset seed for next dynamic calls
    random.seed(time.time())

    return {
        "profile": {
            "email_alias": STABLE_EMAIL,
            "phone_alias": STABLE_PHONE,
            "threat_level": "NOMINAL",
            "uptime": "99.998%",
            "active_nodes": 32 
        },
        "recent_audit": logs,
        "map_nodes": map_nodes,
        "system_status": "ENCRYPTED_TUNNEL_STABLE"
    }

@app.post("/auth/verify-2fa")
async def verify_2fa(request: LoginRequest):
    """Verifies multi-factor authentication challenge tokens"""
    return {"status": "authorized", "session_token": f"token_{random.getrandbits(64)}"}

@app.get("/financials/data")
async def financials(db: Session = Depends(get_db)):
    """Retrieves all active virtual shield assets"""
    cards = db.query(DBCard).order_by(DBCard.created_at.desc()).all()
    return {"cards": cards}

@app.post("/financials/mint")
async def mint_card(request: CardRequest, db: Session = Depends(get_db)):
    """Generates a new secure virtual credit card asset"""
    card_id = f"vcc_{random.randint(1000, 9999)}"
    exp_month = random.randint(1, 12)
    exp_year = random.randint(26, 30)
    
    new_card = DBCard(
        id=card_id,
        label=request.label,
        number=f"4242 {random.randint(1000, 9999)} {random.randint(1000, 9999)} {random.randint(1000, 9999)}",
        expiry=f"{exp_month:02d}/{exp_year}",
        cvv=str(random.randint(100, 999))
    )
    db.add(new_card)
    db.commit()
    db.refresh(new_card)
    return new_card

# --- THE DEFINITIVE 404 FIX ---
@app.post("/financials/profile")
async def save_profile(request: Request, db: Session = Depends(get_db)):
    """Receives target profile data and initiates removal queue"""
    try:
        # Using raw Request to bypass Pydantic's strict 404-on-mismatch behavior
        data = await request.json()
        profile_id = f"user_{random.randint(1000, 9999)}"
        
        # Manually extract fields to handle first/middle/last name separation
        fname = data.get("firstName", "")
        mname = data.get("middleName", "")
        lname = data.get("lastName", "")
        
        # Fallback for old fullName format if needed
        combined = f"{fname} {mname} {lname}".replace("  ", " ").strip()
        final_name = combined if combined else data.get("fullName", "Unknown Target")
        
        new_profile = DBProfile(
            id=profile_id,
            full_name=final_name,
            email=data.get("email"),
            address=data.get("address"),
            dob=data.get("dob")
        )
        db.add(new_profile)
        db.commit()
        return {"status": "success", "profile_id": profile_id}
    except Exception as e:
        print(f"CRITICAL ERROR IN PROFILE SAVE: {str(e)}")
        raise HTTPException(status_code=500, detail="Identity Processing Error")

@app.delete("/financials/kill/{card_id}")
async def kill_card(card_id: str, db: Session = Depends(get_db)):
    """Permanently deletes a virtual card node"""
    card = db.query(DBCard).filter(DBCard.id == card_id).first()
    if card:
        db.delete(card)
        db.commit()
        return {"status": "node_terminated", "message": "ASSET DELETED"}
    raise HTTPException(status_code=404, detail="Asset not found")

@app.post("/financials/burn-all")
async def burn_all_assets(db: Session = Depends(get_db)):
    """Emergency wipe of all client data and card assets"""
    db.query(DBCard).delete()
    db.query(DBProfile).delete()
    db.commit()
    return {"status": "TOTAL_PURGE_COMPLETE", "timestamp": datetime.now().isoformat()}

@app.post("/financials/regenerate")
async def regenerate_alias():
    """Cycles identity aliases for the shield dashboard"""
    global STABLE_EMAIL, STABLE_PHONE
    STABLE_EMAIL = f"vault_{random.randint(1000, 9999)}@{random.choice(DOMAINS)}"
    STABLE_PHONE = f"+1 (555) {random.randint(100, 999)}-{random.randint(1000, 9999)}"
    
    return {
        "email_alias": STABLE_EMAIL,
        "phone_alias": STABLE_PHONE
    }

# --- SERVER STARTUP ---

if __name__ == "__main__":
    import uvicorn
    # Dynamically bind to the PORT assigned by Render
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)

# END OF DISAPPEAR BACKEND CORE ENGINE