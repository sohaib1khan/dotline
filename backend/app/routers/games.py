"""Learner games catalog and score submission."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.schemas.games import GameScoreRequest, GameScoreResponse, GamesListResponse
from app.security.deps import get_current_user, require_csrf
from app.services import games as games_service

router = APIRouter(prefix="/api/games", tags=["games"])


@router.get("", response_model=GamesListResponse)
def list_games(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> GamesListResponse:
    return GamesListResponse(games=games_service.list_games(db, user))


@router.get("/{game_key}")
def get_game(
    game_key: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    return games_service.require_game(db, user, game_key)


@router.post(
    "/{game_key}/score",
    response_model=GameScoreResponse,
    dependencies=[Depends(require_csrf)],
)
def submit_score(
    game_key: str,
    payload: GameScoreRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> GameScoreResponse:
    result = games_service.submit_score(
        db,
        user,
        game_key=game_key,
        score=payload.score,
        accuracy=payload.accuracy,
        duration_s=payload.duration_s,
    )
    return GameScoreResponse(
        game_key=result.game_key,
        score=result.score,
        accuracy=result.accuracy,
        duration_s=result.duration_s,
        xp_awarded=result.xp_awarded,
        leveled_up=result.leveled_up,
        level=result.level,
        high_score=result.high_score,
        new_badges=[
            {
                "key": b.key,
                "title": b.title,
                "description": b.description,
                "icon": b.icon,
                "earned_at": b.earned_at.isoformat(),
            }
            for b in result.new_badges
        ],
    )
