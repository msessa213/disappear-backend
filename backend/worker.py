import os
import time
import logging
from datetime import datetime
from sqlalchemy.orm import Session

from models import SessionLocal, DBScrubLog, DBPurgeLog
from main import AUTOMATED_BROKERS

# Configure Worker Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - WORKER - %(levelname)s - %(message)s')
logger = logging.getLogger("disappear_worker")

last_heartbeat = time.time()

def process_scrub_queue():
    """
    Simulates the Search & Destroy automated scraping worker.
    It looks for tasks marked as 'PROCESSING' for automated brokers,
    processes them, and marks them as 'REMOVED'.
    """
    db: Session = SessionLocal()
    try:
        # Find pending tasks designated for automated removal
        pending_tasks = db.query(DBScrubLog).filter(
            DBScrubLog.status == "PROCESSING",
            DBScrubLog.broker_name.in_(AUTOMATED_BROKERS)
        ).all()

        if not pending_tasks:
            logger.info("No pending automated tasks. Standing by...")
            return

        logger.info(f"Found {len(pending_tasks)} targets to neutralize.")

        for task in pending_tasks:
            logger.info(f"Executing automated API scrub for Task ID: {task.id} (Broker: {task.broker_name})")
            
            # Simulate tactical scraper execution / API request latency
            time.sleep(3)
            
            # Update task status
            task.status = "REMOVED"
            task.timestamp = datetime.utcnow()
            
            # Add audit entry to the purge log
            db.add(DBPurgeLog(
                action_type="AUTOMATED_BROKER_REMOVED",
                node_id=f"TASK_{task.id}_{task.broker_name}"
            ))
            
            db.commit()
            logger.info(f"Task ID: {task.id} successfully neutralized.")
            
    except Exception as e:
        logger.error(f"Worker execution error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    logger.info("Starting Disappear Search & Destroy Worker...")
    while True:
        try:
            process_scrub_queue()
            
            # 5-Minute Heartbeat log for cloud monitoring (Render/AWS)
            current_time = time.time()
            if current_time - last_heartbeat > 300:
                logger.info("HEARTBEAT: Worker is alive and awaiting tasks...")
                last_heartbeat = current_time
                
        except Exception as e:
            logger.error(f"Critical Worker Loop Error: {e}")
            
        time.sleep(60)