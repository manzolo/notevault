"""Tests for the reminder scheduler logic (_next_occurrence_after)."""
import pytest
from datetime import datetime, timedelta, timezone

from app.services.scheduler import _next_occurrence_after, _datetimes_equal


def now_utc() -> datetime:
    return datetime.now(tz=timezone.utc)


def dt_from_now(days: float = 0, hours: float = 0) -> datetime:
    """Return a UTC datetime relative to now, for use with recurring rules."""
    return now_utc() + timedelta(days=days, hours=hours)


def dt(iso: str) -> datetime:
    return datetime.fromisoformat(iso).replace(tzinfo=timezone.utc)


class _FakeEvent:
    def __init__(self, start: datetime, rrule: str | None = None):
        self.start_datetime = start
        self.recurrence_rule = rrule
        self.is_archived = False


def test_non_recurring_first_notification():
    start = dt_from_now(days=10)
    ev = _FakeEvent(start)
    occ = _next_occurrence_after(ev, after=None)
    assert occ == start


def test_non_recurring_already_notified():
    start = dt_from_now(days=10)
    ev = _FakeEvent(start)
    occ = _next_occurrence_after(ev, after=start)
    assert occ is None


def test_recurring_daily_first():
    start = dt_from_now(days=1)
    rrule = "FREQ=DAILY"
    ev = _FakeEvent(start, rrule=rrule)
    occ = _next_occurrence_after(ev, after=None)
    assert occ is not None
    assert _datetimes_equal(occ, start)


def test_recurring_daily_next_after_first():
    start = dt_from_now(days=1)
    rrule = "FREQ=DAILY"
    ev = _FakeEvent(start, rrule=rrule)
    occ = _next_occurrence_after(ev, after=start)
    assert occ is not None
    diff = abs((occ - (start + timedelta(days=1))).total_seconds())
    assert diff < 1


def test_recurring_weekly_next():
    start = dt_from_now(days=1)
    rrule = "FREQ=WEEKLY"
    ev = _FakeEvent(start, rrule=rrule)
    first = _next_occurrence_after(ev, after=None)
    assert first is not None
    assert _datetimes_equal(first, start)
    occ = _next_occurrence_after(ev, after=first)
    assert occ is not None
    diff = abs((occ - (start + timedelta(days=7))).total_seconds())
    assert diff < 1


def test_datetimes_equal_same():
    a = dt("2027-06-15T10:00:00")
    assert _datetimes_equal(a, a)


def test_datetimes_equal_small_diff():
    a = dt("2027-06-15T10:00:00")
    b = a + timedelta(milliseconds=500)
    assert _datetimes_equal(a, b)


def test_datetimes_not_equal():
    a = dt("2027-06-15T10:00:00")
    b = a + timedelta(seconds=2)
    assert not _datetimes_equal(a, b)
