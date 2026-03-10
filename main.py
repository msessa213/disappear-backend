from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import random
import uvicorn
from datetime import datetime
from typing import List

app = FastAPI()

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- TACTICAL DATA SEEDING ---
THREAT_TYPES = [
    "IDENTITY_QUERY_DEFLECTED", 
    "PII_SCRUB_VERIFIED", 
    "NODE_ENCRYPTED", 
    "RECAPTURE_BLOCKED", 
    "TRACE_PURGED",
    "RESIDUAL_DATA_CLEARED",
    "DELETION_REQUEST_SENT"
]

BROKERS = [
    "SPOKEO", "ACXIOM", "INTELIUS", "WHITEPAGES", 
    "PEOPLELOOKER", "BEENVERIFIED", "MYLIFE", "SEARCHPEOPLE"
]

DOMAINS = ["disappear.private", "shield.mask", "cloak.node", "ghost.vault"]

# In-memory database for VCCs
db_cards = [
    {"id": "vcc_1", "label": "Shield Card: Amazon", "number": "4242 **** **** 9012"},
    {"id": "vcc_2", "label": "Shield Card: Netflix", "number": "4242 **** **** 5566"}
]

class CardRequest(BaseModel):
    label: str

class LoginRequest(BaseModel):
    token: str = None

# --- ROUTES ---

@app.get("/dashboard/sync")
async def sync():
    """
    Generates real-time audit logs, system status, and map coordinates.
    Updated to provide consistent node data for the tactical map.
    """
    current_time = datetime.now().strftime("%H:%M:%S")
    
    # 1. Generate random recent audit events
    logs = []
    for _ in range(random.randint(3, 5)):
        logs.append({
            "broker": random.choice(BROKERS),
            "action": random.choice(THREAT_TYPES),
            "time": current_time
        })
    
    # 2. Generate Tactical Map Coordinates (18 nodes)
    map_nodes = []
    for i in range(18):
        map_nodes.append({
            "id": i,
            "x": random.randint(5, 95), 
            "y": random.randint(10, 85),
            "status": random.choice(["active", "active", "active", "intercepting"])
        })

    # 3. Network Profile Data
    active_nodes = random.randint(22, 38)
    selected_domain = random.choice(DOMAINS)

    return {
        "profile": {
            "email_alias": f"vault_{random.randint(1000, 9999)}@{selected_domain}",
            "threat_level": "NOMINAL",
            "uptime": "99.998%",
            "active_nodes": active_nodes
        },
        "recent_audit": logs,
        "map_nodes": map_nodes,
        "system_status": "ENCRYPTED_TUNNEL_STABLE"
    }

@app.post("/auth/verify-2fa")
async def verify_2fa(request: LoginRequest):
    """Authorized 2FA endpoint for portal entry."""
    return {"status": "authorized", "session_token": f"token_{random.getrandbits(64)}"}

@app.get("/financials/data")
async def financials():
    """Returns current active Shield cards."""
    return {"cards": db_cards}

@app.post("/financials/mint")
async def mint_card(request: CardRequest):
    """Mints a new virtual asset."""
    new_card = {
        "id": f"vcc_{random.randint(1000, 9999)}",
        "label": f"Shield Card: {request.label}",
        "number": f"4242 **** **** {random.randint(1000, 9999)}"
    }
    db_cards.append(new_card)
    return new_card

@app.delete("/financials/kill/{card_id}")
async def kill_card(card_id: str):
    """Terminates a specific virtual node."""
    global db_cards
    db_cards = [c for c in db_cards if c["id"] != card_id]
    return {
        "status": "node_terminated", 
        "card_id": card_id,
        "message": "VIRTUAL ASSET PERMANENTLY DELETED"
    }

@app.post("/financials/burn-all")
async def burn_all_assets():
    """
    EMERGENCY KILL SWITCH: 
    Wipes all active cards and cycles system identity.
    """
    global db_cards
    count = len(db_cards)
    db_cards = []
    return {
        "status": "TOTAL_PURGE_COMPLETE",
        "assets_destroyed": count,
        "timestamp": datetime.now().isoformat()
    }

@app.post("/financials/regenerate")
async def regenerate_alias():
    """Manually cycle the identity email."""
    selected_domain = random.choice(DOMAINS)
    return {"email_alias": f"vault_{random.randint(1000, 9999)}@{selected_domain}"}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)