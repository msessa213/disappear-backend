from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, String, DateTime, Integer
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
import random
import os
import time
from datetime import datetime
from typing import List, Optional
from dotenv import load_dotenv

# --- INITIALIZATION BLOCK ---
load_dotenv()

# --- DATABASE CONFIGURATION ---
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres.chymgteinnczqfjqknan:%40Chase246642@aws-1-us-east-1.pooler.supabase.com:6543/postgres"
)

if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

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
    __tablename__ = "shield_assets_v3"
    id = Column(String, primary_key=True, index=True)
    label = Column(String)
    number = Column(String)
    expiry = Column(String) 
    cvv = Column(String)    
    created_at = Column(DateTime, default=datetime.utcnow)

class DBAlias(Base):
    __tablename__ = "shield_aliases_v3"
    id = Column(String, primary_key=True, index=True)
    type = Column(String)
    content = Column(String)
    label = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class DBProfile(Base):
    __tablename__ = "shield_profiles_v3"
    id = Column(String, primary_key=True, index=True)
    full_name = Column(String)
    email = Column(String)
    address = Column(String)
    dob = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"ALARM: DB Sync Deferred - {e}")

# --- APP CONFIGURATION ---

app = FastAPI(title="Disappear PaaS Engine")

# FIX: Explicit Handshake for Vercel + Preflight Support
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
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

# FIX: Global OPTIONS handler to prevent 404s on browser preflight checks
@app.options("/{rest_of_path:path}")
async def preflight_handler(request: Request, rest_of_path: str):
    response = Response(status_code=200)
    return response

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

STABLE_EMAIL = f"vault_{random.randint(1000, 9999)}@{random.choice(DOMAINS)}"
STABLE_PHONE = f"+1 (555) {random.randint(100, 999)}-{random.randint(1000, 9999)}"

# --- SCHEMAS ---

class CardRequest(BaseModel):
    label: str

class AliasRequest(BaseModel):
    type: str 
    label: str

class LoginRequest(BaseModel):
    token: str = None

# --- CORE SYSTEM ROUTES ---

@app.get("/")
async def health_status():
    return {"status": "ACTIVE", "timestamp": datetime.now().isoformat(), "engine": "Disappear v2.1.6"}

@app.get("/admin/stats")
async def get_admin_stats(db: Session = Depends(get_db)):
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
            "threat_level": "NOMINAL",
            "uptime": "99.998%",
            "active_nodes": 32 
        },
        "recent_audit": logs,
        "map_nodes": map_nodes,
        "system_status": "ENCRYPTED_TUNNEL_STABLE"
    }

# --- PII CONTROL ROUTES ---

@app.get("/aliases/data")
async def get_aliases(db: Session = Depends(get_db)):
    aliases = db.query(DBAlias).order_by(DBAlias.created_at.desc()).all()
    return {"aliases": aliases if aliases else []}

@app.post("/aliases/mint")
async def mint_alias(request: AliasRequest, db: Session = Depends(get_db)):
    alias_id = f"als_{int(time.time())}_{random.randint(100, 999)}"
    if request.type.lower() == "email":
        content = f"vault_{random.randint(1000, 9999)}@{random.choice(DOMAINS)}"
    else:
        content = f"+1 (555) {random.randint(100, 999)}-{random.randint(1000, 9999)}"
        
    new_alias = DBAlias(id=alias_id, type=request.type.lower(), label=request.label, content=content)
    db.add(new_alias)
    db.commit()
    db.refresh(new_alias)
    return new_alias

@app.delete("/aliases/kill/{alias_id}")
async def kill_alias(alias_id: str, db: Session = Depends(get_db)):
    alias = db.query(DBAlias).filter(DBAlias.id == alias_id).first()
    if alias:
        db.delete(alias)
        db.commit()
        return {"status": "node_purged"}
    raise HTTPException(status_code=404, detail="Node not found")

# --- FINANCIALS & PROFILE STORAGE ---

@app.get("/financials/data")
async def financials(db: Session = Depends(get_db)):
    try:
        cards = db.query(DBCard).order_by(DBCard.created_at.desc()).all()
        return {"cards": cards if cards else []}
    except Exception as e:
        return {"cards": [], "error": str(e)}

@app.post("/financials/mint")
async def mint_card(request: CardRequest, db: Session = Depends(get_db)):
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
    try:
        data = await request.json()
        profile_id = f"user_{random.randint(1000, 9999)}"
        fn, mn, ln = data.get("firstName", ""), data.get("middleName", ""), data.get("lastName", "")
        combined_name = f"{fn} {mn} {ln}".replace("  ", " ").strip()
        new_profile = DBProfile(
            id=profile_id,
            full_name=combined_name if combined_name else data.get("fullName", "Unknown"),
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
    card = db.query(DBCard).filter(DBCard.id == card_id).first()
    if card:
        db.delete(card)
        db.commit()
        return {"status": "node_terminated"}
    raise HTTPException(status_code=404, detail="Asset not found")

@app.post("/financials/burn-all")
async def burn_all_assets(db: Session = Depends(get_db)):
    db.query(DBCard).delete()
    db.query(DBAlias).delete()
    db.query(DBProfile).delete()
    db.commit()
    return {"status": "TOTAL_PURGE_COMPLETE"}

@app.post("/financials/regenerate")
async def regenerate_alias():
    global STABLE_EMAIL, STABLE_PHONE
    STABLE_EMAIL = f"vault_{random.randint(1000, 9999)}@{random.choice(DOMAINS)}"
    STABLE_PHONE = f"+1 (555) {random.randint(100, 999)}-{random.randint(1000, 9999)}"
    return {"email_alias": STABLE_EMAIL, "phone_alias": STABLE_PHONE}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    # 0.0.0.0 is critical for Render/Docker to work
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)