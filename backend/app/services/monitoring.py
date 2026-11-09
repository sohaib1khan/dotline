"""Admin monitoring widgets and login-event search."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any, Literal

from sqlalchemy import and_, cast, Date, func, or_, select
from sqlalchemy.orm import Session

from app.models.activity import ActivityDaily
from app.models.admin import AdminDashboardLayout
from app.models.auth import LoginEvent
from app.models.bugs import BugReport
from app.models.content import Lesson
from app.models.gamification import LessonProgress
from app.models.user import User, UserRole
from app.services import activity as activity_service
from app.services import bugs as bugs_service

DEFAULT_LAYOUT: list[dict[str, Any]] = [
    {"i": "active_now", "x": 0, "y": 0, "w": 3, "h": 2},
    {"i": "dau", "x": 3, "y": 0, "w": 5, "h": 3},
    {"i": "active_time", "x": 8, "y": 0, "w": 4, "h": 3},
    {"i": "by_track", "x": 0, "y": 2, "w": 3, "h": 2},
    {"i": "top_learners", "x": 0, "y": 4, "w": 4, "h": 4},
    {"i": "signups", "x": 4, "y": 3, "w": 4, "h": 3},
    {"i": "lessons_completed", "x": 8, "y": 3, "w": 4, "h": 3},
    {"i": "hardest_lessons", "x": 4, "y": 6, "w": 4, "h": 4},
    {"i": "recent_logins", "x": 8, "y": 6, "w": 4, "h": 4},
    {"i": "failed_spikes", "x": 0, "y": 8, "w": 4, "h": 3},
    {"i": "open_bugs", "x": 4, "y": 10, "w": 4, "h": 3},
]


def _day_range(days: int) -> list[date]:
    today = datetime.now(UTC).date()
    return [today - timedelta(days=offset) for offset in range(days - 1, -1, -1)]


def active_users_now(db: Session) -> dict[str, Any]:
    ids = activity_service.active_user_ids(db, within_seconds=120)
    return {"count": len(ids), "user_ids": [str(uid) for uid in ids]}


def daily_active_users(db: Session, *, days: int = 30) -> list[dict[str, Any]]:
    start = datetime.now(UTC).date() - timedelta(days=days - 1)
    rows = db.execute(
        select(ActivityDaily.date, func.count(func.distinct(ActivityDaily.user_id)))
        .where(ActivityDaily.date >= start)
        .group_by(ActivityDaily.date)
        .order_by(ActivityDaily.date.asc())
    ).all()
    by_day = {day: int(count) for day, count in rows}
    return [{"date": day.isoformat(), "count": by_day.get(day, 0)} for day in _day_range(days)]


def active_time_by_day(db: Session, *, days: int = 30) -> list[dict[str, Any]]:
    start = datetime.now(UTC).date() - timedelta(days=days - 1)
    rows = db.execute(
        select(ActivityDaily.date, func.coalesce(func.sum(ActivityDaily.active_seconds), 0))
        .where(ActivityDaily.date >= start)
        .group_by(ActivityDaily.date)
        .order_by(ActivityDaily.date.asc())
    ).all()
    by_day = {day: int(total) for day, total in rows}
    return [
        {"date": day.isoformat(), "active_seconds": by_day.get(day, 0)} for day in _day_range(days)
    ]


def active_time_by_track(db: Session, *, days: int = 30) -> list[dict[str, Any]]:
    start = datetime.now(UTC).date() - timedelta(days=days - 1)
    rows = db.execute(
        select(ActivityDaily.track, func.coalesce(func.sum(ActivityDaily.active_seconds), 0))
        .where(ActivityDaily.date >= start, ActivityDaily.track.in_(["braille", "cursive"]))
        .group_by(ActivityDaily.track)
    ).all()
    by_track = {track: int(total) for track, total in rows}
    return [
        {"track": "braille", "active_seconds": by_track.get("braille", 0)},
        {"track": "cursive", "active_seconds": by_track.get("cursive", 0)},
    ]


def top_learners(db: Session, *, days: int = 7, limit: int = 10) -> list[dict[str, Any]]:
    start = datetime.now(UTC).date() - timedelta(days=days - 1)
    rows = db.execute(
        select(
            User.id,
            User.username,
            User.first_name,
            User.last_name,
            func.coalesce(func.sum(ActivityDaily.active_seconds), 0).label("seconds"),
        )
        .join(ActivityDaily, ActivityDaily.user_id == User.id)
        .where(ActivityDaily.date >= start, User.role == UserRole.LEARNER.value)
        .group_by(User.id)
        .order_by(func.sum(ActivityDaily.active_seconds).desc())
        .limit(limit)
    ).all()
    return [
        {
            "user_id": str(row.id),
            "username": row.username,
            "name": f"{row.first_name} {row.last_name}",
            "active_seconds": int(row.seconds),
        }
        for row in rows
    ]


def signups_over_time(db: Session, *, days: int = 30) -> list[dict[str, Any]]:
    start = datetime.now(UTC).date() - timedelta(days=days - 1)
    rows = db.execute(
        select(cast(User.created_at, Date).label("day"), func.count())
        .where(
            User.role == UserRole.LEARNER.value,
            cast(User.created_at, Date) >= start,
        )
        .group_by("day")
        .order_by("day")
    ).all()
    by_day = {day: int(count) for day, count in rows}
    return [{"date": day.isoformat(), "count": by_day.get(day, 0)} for day in _day_range(days)]


def lessons_completed_per_day(db: Session, *, days: int = 30) -> list[dict[str, Any]]:
    start = datetime.now(UTC).date() - timedelta(days=days - 1)
    rows = db.execute(
        select(cast(LessonProgress.completed_at, Date).label("day"), func.count())
        .where(
            LessonProgress.completed_at.is_not(None),
            cast(LessonProgress.completed_at, Date) >= start,
        )
        .group_by("day")
        .order_by("day")
    ).all()
    by_day = {day: int(count) for day, count in rows}
    return [{"date": day.isoformat(), "count": by_day.get(day, 0)} for day in _day_range(days)]


def hardest_lessons(db: Session, *, limit: int = 8) -> list[dict[str, Any]]:
    rows = db.execute(
        select(
            Lesson.id,
            Lesson.title,
            func.avg(LessonProgress.best_score).label("avg_score"),
            func.avg(LessonProgress.attempts).label("avg_attempts"),
            func.count().label("learners"),
        )
        .join(LessonProgress, LessonProgress.lesson_id == Lesson.id)
        .where(LessonProgress.attempts > 0)
        .group_by(Lesson.id)
        .having(func.count() >= 1)
        .order_by(
            func.avg(LessonProgress.best_score).asc().nullsfirst(),
            func.avg(LessonProgress.attempts).desc(),
        )
        .limit(limit)
    ).all()
    return [
        {
            "lesson_id": row.id,
            "title": row.title,
            "avg_score": round(float(row.avg_score), 1) if row.avg_score is not None else None,
            "avg_attempts": round(float(row.avg_attempts), 1),
            "learners": int(row.learners),
        }
        for row in rows
    ]


def recent_logins(db: Session, *, limit: int = 15) -> list[dict[str, Any]]:
    rows = db.scalars(select(LoginEvent).order_by(LoginEvent.created_at.desc()).limit(limit)).all()
    return [_login_public(row) for row in rows]


def failed_login_spikes(db: Session, *, hours: int = 24) -> list[dict[str, Any]]:
    since = datetime.now(UTC) - timedelta(hours=hours)
    # Bucket by hour.
    rows = db.execute(
        select(
            func.date_trunc("hour", LoginEvent.created_at).label("hour"),
            func.count().label("failed"),
        )
        .where(LoginEvent.success.is_(False), LoginEvent.created_at >= since)
        .group_by("hour")
        .order_by("hour")
    ).all()
    return [
        {"hour": row.hour.isoformat() if row.hour else None, "failed": int(row.failed)}
        for row in rows
    ]


def open_bugs_by_category(db: Session) -> list[dict[str, Any]]:
    rows = db.execute(
        select(BugReport.category, func.count())
        .where(BugReport.status.in_(["open", "in_progress"]))
        .group_by(BugReport.category)
        .order_by(func.count().desc())
    ).all()
    return [
        {
            "category": category,
            "label": bugs_service.CATEGORY_LABELS.get(category, category),
            "count": int(count),
        }
        for category, count in rows
    ]


def build_dashboard(
    db: Session,
    *,
    top_range_days: int = 7,
) -> dict[str, Any]:
    return {
        "active_now": active_users_now(db),
        "dau": daily_active_users(db),
        "active_time": active_time_by_day(db),
        "by_track": active_time_by_track(db),
        "top_learners": top_learners(db, days=top_range_days),
        "top_range_days": top_range_days,
        "signups": signups_over_time(db),
        "lessons_completed": lessons_completed_per_day(db),
        "hardest_lessons": hardest_lessons(db),
        "recent_logins": recent_logins(db),
        "failed_spikes": failed_login_spikes(db),
        "open_bugs": open_bugs_by_category(db),
        "generated_at": datetime.now(UTC).isoformat(),
    }


def get_layout(db: Session, user_id: uuid.UUID) -> list[dict[str, Any]]:
    row = db.get(AdminDashboardLayout, user_id)
    if row is None or not row.layout:
        return list(DEFAULT_LAYOUT)
    if isinstance(row.layout, list):
        return row.layout
    return list(DEFAULT_LAYOUT)


def save_layout(db: Session, user_id: uuid.UUID, layout: list[dict[str, Any]]) -> list[dict[str, Any]]:
    row = db.get(AdminDashboardLayout, user_id)
    if row is None:
        row = AdminDashboardLayout(user_id=user_id, layout=layout)
        db.add(row)
    else:
        row.layout = layout
    db.commit()
    return layout


def reset_layout(db: Session, user_id: uuid.UUID) -> list[dict[str, Any]]:
    return save_layout(db, user_id, list(DEFAULT_LAYOUT))


def _login_public(row: LoginEvent) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "user_id": str(row.user_id) if row.user_id else None,
        "email_attempted": row.email_attempted,
        "success": row.success,
        "ip": row.ip,
        "device_summary": row.device_summary,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def search_login_events(
    db: Session,
    *,
    q: str | None = None,
    success: Literal["all", "success", "fail"] = "all",
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = 1,
    page_size: int = 25,
) -> dict[str, Any]:
    page = max(1, page)
    page_size = min(max(page_size, 1), 100)
    stmt = select(LoginEvent)
    count_stmt = select(func.count()).select_from(LoginEvent)

    filters = []
    if q:
        term = f"%{q.strip().lower()}%"
        filters.append(
            or_(
                func.lower(LoginEvent.email_attempted).like(term),
                func.lower(func.coalesce(LoginEvent.ip, "")).like(term),
                func.lower(func.coalesce(LoginEvent.device_summary, "")).like(term),
            )
        )
    if success == "success":
        filters.append(LoginEvent.success.is_(True))
    elif success == "fail":
        filters.append(LoginEvent.success.is_(False))
    if date_from is not None:
        filters.append(LoginEvent.created_at >= datetime.combine(date_from, datetime.min.time(), tzinfo=UTC))
    if date_to is not None:
        filters.append(
            LoginEvent.created_at
            < datetime.combine(date_to + timedelta(days=1), datetime.min.time(), tzinfo=UTC)
        )

    if filters:
        clause = and_(*filters)
        stmt = stmt.where(clause)
        count_stmt = count_stmt.where(clause)

    total = int(db.scalar(count_stmt) or 0)
    rows = db.scalars(
        stmt.order_by(LoginEvent.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "items": [_login_public(row) for row in rows],
        "page": page,
        "page_size": page_size,
        "total": total,
        "pages": max(1, (total + page_size - 1) // page_size),
    }
