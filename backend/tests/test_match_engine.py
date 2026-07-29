import unittest
from backend.services.match_engine import MatchEngine
from backend.services.notification_service import NotificationService

class TestMatchEngineAndNotifications(unittest.TestCase):
    def test_match_engine_high_confidence(self):
        profile = {
            "first_name": "John",
            "last_name": "Smith",
            "middle_name": "Edward",
            "dob": "1985-04-12",
            "address": "123 Main St, New York, NY",
            "phone": "555-123-4567"
        }

        record = {
            "first_name": "John",
            "last_name": "Smith",
            "middle_name": "E",
            "age": "41",  # 2026 - 1985 = 41
            "locations": ["New York, NY"],
            "state": "NY",
            "phones": ["555-123-4567"]
        }

        score, breakdown = MatchEngine.calculate_confidence(profile, record)
        status = MatchEngine.determine_status(score)

        self.assertGreaterEqual(score, 80)
        self.assertEqual(status, "AUTO_REMOVED")
        self.assertIn("Exact last name match (+25)", breakdown["reasons"])
        self.assertIn("Exact first name match (+25)", breakdown["reasons"])

    def test_match_engine_ambiguous_confidence(self):
        profile = {
            "first_name": "John",
            "last_name": "Smith",
            "dob": "1985-04-12",
            "address": "123 Main St, New York, NY"
        }

        record = {
            "first_name": "John",
            "last_name": "Smith",
            "age": "60",  # Different age bracket
            "locations": ["Austin, TX"],
            "state": "TX"
        }

        score, breakdown = MatchEngine.calculate_confidence(profile, record)
        status = MatchEngine.determine_status(score)

        self.assertTrue(40 <= score < 80)
        self.assertEqual(status, "NEEDS_VERIFICATION")

    def test_match_engine_low_confidence(self):
        profile = {
            "first_name": "John",
            "last_name": "Smith",
            "dob": "1985-04-12"
        }

        record = {
            "first_name": "Robert",
            "last_name": "Johnson",
            "age": "22",
            "state": "CA"
        }

        score, breakdown = MatchEngine.calculate_confidence(profile, record)
        status = MatchEngine.determine_status(score)

        self.assertLess(score, 40)
        self.assertEqual(status, "REJECTED")

    def test_notification_service_alert(self):
        alert = NotificationService.send_ambiguity_alert(
            user_email="john@example.com",
            broker_name="Whitepages",
            verification_url="https://disappear.app/verify-match?token=vref_123",
            record_summary={"name": "John Smith", "age": 41, "locations": ["New York, NY"]}
        )

        self.assertTrue(alert["sent"])
        self.assertEqual(alert["recipient"], "john@example.com")
        self.assertIn("Action Needed", alert["subject"])
        self.assertIn("Whitepages", alert["subject"])

    def test_notification_service_quarterly_summary(self):
        summary = NotificationService.generate_quarterly_summary(
            user_email="john@example.com",
            user_name="John Smith",
            quarter="Q3 2026",
            stats={"removed": 14, "in_progress": 3, "pending_verification": 1}
        )

        self.assertTrue(summary["sent"])
        self.assertIn("Q3 2026", summary["subject"])
        self.assertIn("14 Removals", summary["subject"])

if __name__ == "__main__":
    unittest.main()

