import logging
from typing import Dict, Any, List

logger = logging.getLogger("disappear.notifications")

class NotificationService:
    @staticmethod
    def send_ambiguity_alert(user_email: str, broker_name: str, verification_url: str, record_summary: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sends an event-driven notification when an ambiguous broker record requires customer review.
        """
        subject = f"[Action Needed] Please verify a potential listing on {broker_name}"
        body = (
            f"Hello,\n\n"
            f"During our automated scan, Disappear detected a potential matching record on {broker_name}:\n"
            f" - Name: {record_summary.get('name', 'N/A')}\n"
            f" - Age: {record_summary.get('age', 'N/A')}\n"
            f" - Locations: {', '.join(record_summary.get('locations', [])) or record_summary.get('state', 'N/A')}\n\n"
            f"Because there are multiple matching names, please confirm if this is your record so we can initiate removal immediately:\n"
            f"{verification_url}\n\n"
            f"Stay private,\nThe Disappear Team"
        )
        logger.info(f"Triggered ambiguity alert for {user_email} on broker '{broker_name}'")
        return {
            "sent": True,
            "recipient": user_email,
            "subject": subject,
            "body": body,
            "type": "AMBIGUITY_ALERT"
        }

    @staticmethod
    def generate_quarterly_summary(user_email: str, user_name: str, quarter: str, stats: Dict[str, int]) -> Dict[str, Any]:
        """
        Generates a quarterly executive summary email highlighting removals completed and value delivered.
        stats format: {"removed": 14, "in_progress": 2, "pending_verification": 1}
        """
        subject = f"Your Disappear {quarter} Privacy Protection Report ({stats.get('removed', 0)} Removals)"
        body = (
            f"Hi {user_name or 'there'},\n\n"
            f"Here is your quarterly privacy protection summary for {quarter}:\n\n"
            f"  - Total Data Broker Listings Removed: {stats.get('removed', 0)}\n"
            f"  - Active Removals In Progress: {stats.get('in_progress', 0)}\n"
            f"  - Action Needed (Pending Verification): {stats.get('pending_verification', 0)}\n\n"
            f"No action is required for automatically removed listings. "
            f"If you have any pending items, you can review them directly in your Disappear Privacy Portal.\n\n"
            f"Thank you for keeping your personal data safe with Disappear.\n\n"
            f"Best regards,\nThe Disappear Privacy Team"
        )
        logger.info(f"Generated quarterly summary for {user_email} ({quarter})")
        return {
            "sent": True,
            "recipient": user_email,
            "subject": subject,
            "body": body,
            "type": "QUARTERLY_SUMMARY"
        }
