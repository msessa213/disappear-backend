import json
import uuid
import logging
from typing import Dict, Any, Tuple

logger = logging.getLogger("disappear.match_engine")

class MatchEngine:
    AUTO_REMOVE_THRESHOLD = 80
    MIN_AMBIGUOUS_THRESHOLD = 40

    @classmethod
    def calculate_confidence(cls, profile_data: Dict[str, Any], record: Dict[str, Any]) -> Tuple[int, Dict[str, Any]]:
        """
        Calculates confidence score (0 to 100) by comparing user profile data against a data broker record.
        Returns (confidence_score, breakdown_details).
        """
        score = 0
        reasons = []

        # 1. First & Last Name Match (Up to 50 points)
        prof_first = (profile_data.get("first_name") or "").strip().lower()
        prof_last = (profile_data.get("last_name") or "").strip().lower()
        rec_first = (record.get("first_name") or "").strip().lower()
        rec_last = (record.get("last_name") or "").strip().lower()

        if prof_last and prof_last == rec_last:
            score += 25
            reasons.append("Exact last name match (+25)")
        
        if prof_first and prof_first == rec_first:
            score += 25
            reasons.append("Exact first name match (+25)")
        elif prof_first and rec_first and (prof_first in rec_first or rec_first in prof_first):
            score += 15
            reasons.append("Partial first name match (+15)")

        # 2. Middle Name / Initial Match (Up to 10 points)
        prof_mid = (profile_data.get("middle_name") or "").strip().lower()
        rec_mid = (record.get("middle_name") or "").strip().lower()
        if prof_mid and rec_mid:
            if prof_mid == rec_mid:
                score += 10
                reasons.append("Exact middle name match (+10)")
            elif prof_mid[0] == rec_mid[0]:
                score += 5
                reasons.append("Middle initial match (+5)")

        # 3. Location Match (City/State) (Up to 20 points)
        prof_addr = (profile_data.get("address") or "").strip().lower()
        rec_locations = [loc.lower() for loc in record.get("locations", [])]
        rec_state = (record.get("state") or "").strip().lower()

        state_matched = False
        if prof_addr:
            for loc in rec_locations:
                if loc in prof_addr or prof_addr in loc:
                    score += 20
                    reasons.append(f"Location match '{loc}' (+20)")
                    state_matched = True
                    break
            
            if not state_matched and rec_state and rec_state in prof_addr:
                score += 10
                reasons.append(f"State match '{rec_state}' (+10)")

        # 4. Age / DOB Match (Up to 20 points)
        prof_dob = profile_data.get("dob")
        rec_age = record.get("age")
        if prof_dob and rec_age:
            try:
                birth_year = int(str(prof_dob).split("-")[0]) if "-" in str(prof_dob) else int(str(prof_dob)[-4:])
                current_year = 2026
                calculated_age = current_year - birth_year
                rec_age_int = int(rec_age)
                
                if abs(calculated_age - rec_age_int) <= 1:
                    score += 20
                    reasons.append("Exact age match (+20)")
                elif abs(calculated_age - rec_age_int) <= 3:
                    score += 10
                    reasons.append("Close age match (+10)")
            except (ValueError, TypeError, IndexError):
                pass

        # 5. Phone / Relative Match (Up to 10 points bonus)
        prof_phone = (profile_data.get("phone") or "").replace("-", "").replace(" ", "")
        rec_phones = [(p or "").replace("-", "").replace(" ", "") for p in record.get("phones", [])]
        if prof_phone and any(prof_phone in p for p in rec_phones if p):
            score += 10
            reasons.append("Phone number match (+10)")

        # Clamp score between 0 and 100
        score = max(0, min(100, score))

        breakdown = {
            "score": score,
            "reasons": reasons,
            "record_summary": {
                "name": f"{record.get('first_name', '')} {record.get('last_name', '')}".strip(),
                "age": record.get("age"),
                "locations": record.get("locations", []),
                "state": record.get("state")
            }
        }
        return score, breakdown

    @classmethod
    def determine_status(cls, score: int) -> str:
        if score >= cls.AUTO_REMOVE_THRESHOLD:
            return "AUTO_REMOVED"
        elif score >= cls.MIN_AMBIGUOUS_THRESHOLD:
            return "NEEDS_VERIFICATION"
        else:
            return "REJECTED"

    @classmethod
    def generate_verification_token(cls) -> str:
        return f"vref_{uuid.uuid4().hex}"
