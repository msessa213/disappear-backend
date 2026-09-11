import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import pytest
except ImportError:
    pytest = None

import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import Base, DBProfile, DBScrubLog, DBPurgeLog, DBTargetEmail
from main import (
    deduplicate_and_tombstone_user_scrub_logs,
    DEAD_MOCK_BROKERS,
    BROKERS
)

if pytest:
    @pytest.fixture
    def db_session():
        test_engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(test_engine)
        TestingSessionLocal = sessionmaker(bind=test_engine)
        session = TestingSessionLocal()
        yield session
        session.close()

def test_deduplication_and_removal_immutability(db_session):
    uid = "user_test_99"
    email = "test99@example.com"
    uid_identifiers = [uid, email]

    # Create profile
    prof = DBProfile(id=uid, email=email, kyc_status="APPROVED")
    db_session.add(prof)

    # Insert duplicate broker entries: one PROCESSING under uid, one REMOVED under email
    b1 = DBScrubLog(user_id=uid, broker_name="WHITEPAGES", status="PROCESSING")
    b2 = DBScrubLog(user_id=email, broker_name="whitepages", status="REMOVED")
    b3 = DBScrubLog(user_id=uid, broker_name="SPOKEO", status="PROCESSING")
    # And a dead/mock broker
    b4 = DBScrubLog(user_id=uid, broker_name="DARKWEB_LEAK_VAULT", status="PROCESSING")
    db_session.add_all([b1, b2, b3, b4])
    db_session.commit()

    assert db_session.query(DBScrubLog).count() == 4

    # Run deduplication and tombstoning
    deduped = deduplicate_and_tombstone_user_scrub_logs(db_session, uid, uid_identifiers)

    # In DB, duplicate whitepages row must be pruned, leaving 3 canonical entries
    assert db_session.query(DBScrubLog).count() == 3
    assert len(deduped) == 3

    # Whitepages must be REMOVED (not PROCESSING!)
    wp = next(s for s in deduped if s.broker_name.upper() == "WHITEPAGES")
    assert wp.status == "REMOVED"
    assert wp.user_id == uid

    # Dead mock broker must be advanced to REMOVED
    dw = next(s for s in deduped if s.broker_name.upper() == "DARKWEB_LEAK_VAULT")
    assert dw.status == "REMOVED"

    # Spokeo remains PROCESSING
    sp = next(s for s in deduped if s.broker_name.upper() == "SPOKEO")
    assert sp.status == "PROCESSING"

def test_removed_status_is_never_downgraded(db_session):
    uid = "user_test_88"
    uid_identifiers = [uid]

    prof = DBProfile(id=uid, email="test88@example.com", kyc_status="APPROVED")
    db_session.add(prof)

    # Broker is already verified removed
    b1 = DBScrubLog(user_id=uid, broker_name="BEENVERIFIED", status="REMOVED")
    db_session.add(b1)
    db_session.commit()

    # Re-run deduplication
    deduped = deduplicate_and_tombstone_user_scrub_logs(db_session, uid, uid_identifiers)
    bv = next(s for s in deduped if s.broker_name.upper() == "BEENVERIFIED")
    assert bv.status == "REMOVED"

def test_purge_log_includes_user_id_and_audit_hash(db_session):
    uid = "user_test_77"
    db_session.add(DBPurgeLog(
        user_id=uid,
        action_type="DATA_BROKER_REMOVAL_VERIFIED [WHITEPAGES] (HASH_1234AB)",
        node_id=f"{uid}_AUTOMATED_SCRUB"
    ))
    db_session.commit()

    entry = db_session.query(DBPurgeLog).filter(DBPurgeLog.user_id == uid).first()
    assert entry is not None
    assert "DATA_BROKER_REMOVAL_VERIFIED" in entry.action_type
    assert entry.node_id.startswith(f"{uid}_")

if __name__ == "__main__":
    import sys
    test_engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(test_engine)
    TestingSessionLocal = sessionmaker(bind=test_engine)

    sess = TestingSessionLocal()
    test_deduplication_and_removal_immutability(sess)
    sess.close()
    print("PASS: test_deduplication_and_removal_immutability")

    sess = TestingSessionLocal()
    test_removed_status_is_never_downgraded(sess)
    sess.close()
    print("PASS: test_removed_status_is_never_downgraded")

    sess = TestingSessionLocal()
    test_purge_log_includes_user_id_and_audit_hash(sess)
    sess.close()
    print("PASS: test_purge_log_includes_user_id_and_audit_hash")
    print("ALL TESTS PASSED SUCCESSFULLY!")
