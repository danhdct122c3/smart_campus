"""Attendance Rule Engine (Workflow 3, Step 5).

Applies business rules to determine whether an attendance check-in is:
  - PRESENT  → on time
  - LATE     → arrived after the late threshold
  - REJECTED → already checked in (duplicate), wrong session, or policy violation
"""

from datetime import datetime, timezone, time


# ── Session definitions (configurable) ────────────────────────────────────────

class Session:
    def __init__(self, name: str, start: time, late_threshold: time, end: time):
        self.name = name
        self.start = start
        self.late_threshold = late_threshold
        self.end = end


SESSIONS: list[Session] = [
    Session("MORNING",   time(7, 0),  time(7, 15), time(12, 0)),
    Session("AFTERNOON", time(13, 0), time(13, 15), time(17, 30)),
    Session("EVENING",   time(17, 30), time(17, 45), time(21, 0)),
]


# ── Rule Engine ────────────────────────────────────────────────────────────────

class RuleResult:
    def __init__(self, allowed: bool, status: str, session_name: str, reason: str = ""):
        self.allowed = allowed
        self.status = status          # "PRESENT" | "LATE" | "REJECTED"
        self.session_name = session_name
        self.reason = reason


def evaluate(
    capture_time: datetime,
    existing_record: dict | None,
) -> RuleResult:
    """
    Evaluate attendance rules and return a RuleResult.

    Args:
        capture_time: The datetime when the face was captured.
        existing_record: Existing DynamoDB item for this user+date+session, or None.

    Returns:
        RuleResult with allowed=True/False, status, and session_name.
    """
    t = capture_time.time()

    # 1. Identify which session this belongs to
    current_session: Session | None = None
    for session in SESSIONS:
        if session.start <= t <= session.end:
            current_session = session
            break

    if current_session is None:
        return RuleResult(
            allowed=False,
            status="REJECTED",
            session_name="UNKNOWN",
            reason=f"No active session at {t.strftime('%H:%M')}. Check-in is only allowed during scheduled sessions.",
        )

    # 2. Idempotency – duplicate check
    if existing_record and existing_record.get("status") in ("PRESENT", "LATE"):
        return RuleResult(
            allowed=False,
            status="REJECTED",
            session_name=current_session.name,
            reason="Attendance already recorded for this session (duplicate).",
        )

    # 3. Determine PRESENT vs LATE
    att_status = "PRESENT" if t <= current_session.late_threshold else "LATE"

    return RuleResult(
        allowed=True,
        status=att_status,
        session_name=current_session.name,
        reason="",
    )
