"""SQLAlchemy models — import all so Alembic can discover metadata."""

from app.models.activity import ActivityDaily, ActivitySession
from app.models.admin import AdminDashboardLayout
from app.models.auth import EmailToken, LoginEvent
from app.models.bugs import BugReport
from app.models.content import Lesson, Unit
from app.models.gamification import Badge, GameScore, LessonProgress, Streak, UserBadge, XpEvent
from app.models.messaging import Message
from app.models.settings import AppSetting
from app.models.user import User, UserSetting, UserTrack

__all__ = [
    "User",
    "UserSetting",
    "UserTrack",
    "EmailToken",
    "LoginEvent",
    "AppSetting",
    "Unit",
    "Lesson",
    "LessonProgress",
    "GameScore",
    "XpEvent",
    "Badge",
    "UserBadge",
    "Streak",
    "Message",
    "BugReport",
    "ActivitySession",
    "ActivityDaily",
    "AdminDashboardLayout",
]
