from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
import random
import os
from datetime import datetime
from typing import List
from dotenv import load_dotenv

# Load variables from the .env file (Local development only)
load_dotenv()

# --- DATABASE CONFIGURATION ---
DATABASE_URL = os.getenv("DATABASE_URL")

# Production Fix: Ensure the dialect is 'postgresql' and not 'postgres'
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Initialize SQLAlchemy
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- DATABASE MODEL ---
class DBCard(Base):
    __tablename__ = "cards"
    id = Column(String, primary_key=True, index=True)
    label = Column(String)
    number = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

# Auto-create tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI()

# Enable CORS - allow all for initial deployment testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get the DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- DATA SEEDING ---
THREAT_TYPES = ["IDENTITY_QUERY_DEFLECTED", "PII_SCRUB_VERIFIED", "NODE_ENCRYPTED", "RECAPTURE_BLOCKED", "TRACE_PURGED"]
BROKERS = ["SPOKEO", "ACXIOM", "INTELIUS", "WHITEPAGES", "PEOPLELOOKER"]
DOMAINS = ["disappear.private", "shield.mask", "cloak.node", "ghost.vault"]

# --- SCHEMAS ---
class CardRequest(BaseModel):
    label: str

class LoginRequest(BaseModel):
    token: str = None

# --- ROUTES ---

@app.get("/dashboard/sync")
async def sync():
    current_time = datetime.now().strftime("%H:%M:%S")
    logs = [{"broker": random.choice(BROKERS), "action": random.choice(THREAT_TYPES), "time": current_time} 
            for _ in range(random.randint(3, 5))]
    map_nodes = [{"id": i, "x": random.randint(5, 95), "y": random.randint(10, 85), 
                  "status": random.choice(["active", "active", "intercepting"])} for i in range(18)]

    return {
        "profile": {
            "email_alias": f"vault_{random.randint(1000, 9999)}@{random.choice(DOMAINS)}",
            "threat_level": "NOMINAL",
            "uptime": "99.998%",
            "active_nodes": random.randint(22, 38)
        },
        "recent_audit": logs,
        "map_nodes": map_nodes,
        "system_status": "ENCRYPTED_TUNNEL_STABLE"
    }

@app.post("/auth/verify-2fa")
async def verify_2fa(request: LoginRequest):
    return {"status": "authorized", "session_token": f"token_{random.getrandbits(64)}"}

@app.get("/financials/data")
async def financials(db: Session = Depends(get_db)):
    cards = db.query(DBCard).all()
    return {"cards": cards}

@app.post("/financials/mint")
async def mint_card(request: CardRequest, db: Session = Depends(get_db)):
    card_id = f"vcc_{random.randint(1000, 9999)}"
    new_card = DBCard(
        id=card_id,
        label=f"Shield Card: {request.label}",
        number=f"4242 **** **** {random.randint(1000, 9999)}"
    )
    db.add(new_card)
    db.commit()
    db.refresh(new_card)
    return new_card

@app.delete("/financials/kill/{card_id}")
async def kill_card(card_id: str, db: Session = Depends(get_db)):
    card = db.query(DBCard).filter(DBCard.id == card_id).first()
    if card:
        db.delete(card)
        db.commit()
        return {"status": "node_terminated", "message": "ASSET DELETED"}
    raise HTTPException(status_code=404, detail="Asset not found")

@app.post("/financials/burn-all")
async def burn_all_assets(db: Session = Depends(get_db)):
    db.query(DBCard).delete()
    db.commit()
    return {"status": "TOTAL_PURGE_COMPLETE", "timestamp": datetime.now().isoformat()}

@app.post("/financials/regenerate")
async def regenerate_alias():
    return {"email_alias": f"vault_{random.randint(1000, 9999)}@{random.choice(DOMAINS)}"}

# --- PRODUCTION SERVER BOOT ---
if __name__ == "__main__":
    import uvicorn
    # Render provides the port via the PORT environment variable
    port = int(os.environ.get("PORT", 8000))
    # Use 0.0.0.0 to bind to all interfaces for external access
    uvicorn.run(app, host="0.0.0.0", port=port)