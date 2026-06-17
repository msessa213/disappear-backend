import os
import logging
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import create_engine, Column, String, DateTime, Integer, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger("disappear")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not found in environment!")

if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=40,
    pool_timeout=30,
    pool_pre_ping=True,
    pool_recycle=300,
    echo=False,
    connect_args={
        "sslmode": "require",
        "connect_timeout": 10,
        "application_name": "disappear_paas"
    }
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class DBCard(Base):
    __tablename__ = "shield_assets_v3"
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=True)
    label = Column(String)
    number = Column(String)
    expiry = Column(String) 
    cvv = Column(String)       
    real_card_token = Column(String, unique=True, nullable=True)
    last_four = Column(String(4), nullable=True)
    funding_source_id = Column(String, nullable=True) # Holds the Stripe PaymentMethod ID
    created_at = Column(DateTime, default=datetime.utcnow)

class DBAlias(Base):
    __tablename__ = "shield_aliases_v3"
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=True)
    type = Column(String)
    content = Column(String)
    label = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class DBProfile(Base):
    __tablename__ = "shield_profiles_v3"
    id = Column(String, primary_key=True, index=True)
    first_name = Column(String)
    middle_name = Column(String)
    last_name = Column(String)
    email = Column(String)
    address = Column(String)
    dob = Column(String)
    phone = Column(String, nullable=True)
    bonus_credits = Column(Integer, default=0) 
    phone_line_bonus = Column(Integer, default=0)
    extra_email_slots = Column(Integer, default=0)
    stripe_customer_id = Column(String, nullable=True)
    marqeta_user_token = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class DBTargetEmail(Base):
    __tablename__ = "shield_target_emails_v1"
    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(String, index=True)
    email = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class DBScrubLog(Base):
    __tablename__ = "scrub_logs_v1"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    broker_name = Column(String)
    status = Column(String)
    removal_type = Column(String, default="AUTOMATED") # NEW: AUTOMATED or MANUAL
    manual_instruction_url = Column(String, nullable=True) # NEW
    timestamp = Column(DateTime, default=datetime.utcnow)

class DBPurgeLog(Base):
    __tablename__ = "purge_logs_v1"
    id = Column(Integer, primary_key=True, index=True)
    action_type = Column(String)
    node_id = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)

class DBMarqetaEvent(Base):
    __tablename__ = "marqeta_processed_events_v1"
    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True)
    type = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)