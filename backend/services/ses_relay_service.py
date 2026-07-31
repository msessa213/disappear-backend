import os
import boto3
import logging
from typing import Optional

logger = logging.getLogger("disappear")

class SESRelayService:
    def __init__(self):
        self.aws_key = os.getenv("AWS_ACCESS_KEY_ID")
        self.aws_secret = os.getenv("AWS_SECRET_ACCESS_KEY")
        self.aws_region = os.getenv("AWS_REGION", "us-east-1")
        self.domain = os.getenv("SES_RELAY_DOMAIN", "disappearco.com")
        self.sender_email = os.getenv("SES_SENDER_EMAIL", "vault@disappearco.com")

        self.client = boto3.client(
            'ses',
            aws_access_key_id=self.aws_key,
            aws_secret_access_key=self.aws_secret,
            region_name=self.aws_region
        )

    def generate_alias_address(self, label: str) -> str:
        import random
        clean_label = "".join(filter(str.isalnum, label.lower())) or "vault"
        random_suffix = "".join(random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=8))
        return f"{clean_label}_{random_suffix}@{self.domain}"

    def send_forwarded_email(
        self,
        alias_address: str,
        destination_email: str,
        original_sender: str,
        subject: str,
        body_text: str,
        body_html: Optional[str] = None
    ) -> bool:
        """
        Forwards an incoming email sent to an alias directly to the customer's registered recipient address.
        Requires ZERO recipient verification emails or extra steps from the customer.
        """
        try:
            message = {
                'Subject': {'Data': f"[Relay: {alias_address}] {subject}"},
                'Body': {'Text': {'Data': body_text}}
            }
            if body_html:
                message['Body']['Html'] = {'Data': body_html}

            response = self.client.send_email(
                Source=f"Disappear Relay <{self.sender_email}>",
                Destination={'ToAddresses': [destination_email]},
                Message=message,
                ReplyToAddresses=[original_sender]
            )
            logger.info(f"SES_RELAY_SUCCESS: Forwarded message for {alias_address} to {destination_email}. MessageId: {response.get('MessageId')}")
            return True
        except Exception as e:
            logger.error(f"SES_RELAY_ERROR: Failed to forward message to {destination_email}: {str(e)}")
            return False

ses_relay_service = SESRelayService()
