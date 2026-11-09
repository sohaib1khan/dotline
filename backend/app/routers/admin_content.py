"""Admin content CMS routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.schemas.admin_content import (
    ImportResult,
    LessonAdmin,
    LessonCreateRequest,
    LessonUpdateRequest,
    MoveRequest,
    ReseedRequest,
    UnitAdmin,
    UnitUpdateRequest,
)
from app.schemas.auth import MessageResponse
from app.security.deps import require_admin, require_csrf
from app.services import admin_content as content_service
from app.services import content_pack

router = APIRouter(prefix="/api/admin/content", tags=["admin-content"])


@router.get("/units", response_model=list[UnitAdmin])
def list_units(
    track: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> list[UnitAdmin]:
    return [UnitAdmin(**row) for row in content_service.list_units(db, track)]


@router.get("/lessons/{lesson_id}", response_model=LessonAdmin)
def get_lesson(
    lesson_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> LessonAdmin:
    return LessonAdmin(**content_service.lesson_public(content_service.get_lesson(db, lesson_id)))


@router.put("/units/{unit_id}", response_model=UnitAdmin, dependencies=[Depends(require_csrf)])
def update_unit(
    unit_id: int,
    payload: UnitUpdateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> UnitAdmin:
    return UnitAdmin(
        **content_service.update_unit(
            db,
            unit_id,
            title=payload.title,
            description=payload.description,
            is_published=payload.is_published,
            order=payload.order,
        )
    )


@router.post(
    "/units/{unit_id}/move",
    response_model=UnitAdmin,
    dependencies=[Depends(require_csrf)],
)
def move_unit(
    unit_id: int,
    payload: MoveRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> UnitAdmin:
    return UnitAdmin(**content_service.move_unit(db, unit_id, direction=payload.direction))


@router.post(
    "/units/{unit_id}/lessons",
    response_model=LessonAdmin,
    dependencies=[Depends(require_csrf)],
)
def create_lesson(
    unit_id: int,
    payload: LessonCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> LessonAdmin:
    return LessonAdmin(
        **content_service.create_lesson(
            db,
            unit_id=unit_id,
            title=payload.title,
            type_value=payload.type,
            content=payload.content,
            xp_reward=payload.xp_reward,
            is_published=payload.is_published,
        )
    )


@router.put("/lessons/{lesson_id}", response_model=LessonAdmin, dependencies=[Depends(require_csrf)])
def update_lesson(
    lesson_id: int,
    payload: LessonUpdateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> LessonAdmin:
    return LessonAdmin(
        **content_service.update_lesson(
            db,
            lesson_id,
            title=payload.title,
            type_value=payload.type,
            content=payload.content,
            xp_reward=payload.xp_reward,
            is_published=payload.is_published,
            order=payload.order,
        )
    )


@router.post(
    "/lessons/{lesson_id}/move",
    response_model=LessonAdmin,
    dependencies=[Depends(require_csrf)],
)
def move_lesson(
    lesson_id: int,
    payload: MoveRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> LessonAdmin:
    return LessonAdmin(**content_service.move_lesson(db, lesson_id, direction=payload.direction))


@router.delete(
    "/lessons/{lesson_id}",
    response_model=MessageResponse,
    dependencies=[Depends(require_csrf)],
)
def delete_lesson(
    lesson_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> MessageResponse:
    result = content_service.delete_lesson(db, lesson_id)
    return MessageResponse(message=result["message"])


@router.post("/reseed", response_model=MessageResponse, dependencies=[Depends(require_csrf)])
def reseed(
    payload: ReseedRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> MessageResponse:
    if payload.confirm.strip().upper() != "RESEED":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"confirm": "Type RESEED to confirm."},
        )
    track = None if payload.track == "all" else payload.track
    result = content_service.reseed_from_yaml(db, track)
    return MessageResponse(
        message=f"Re-seeded {result['track']}: {result['units']} units, {result['lessons']} lessons."
    )


@router.get("/libraries/cursive-strokes")
def cursive_strokes(_: User = Depends(require_admin)) -> dict:
    return content_service.stroke_library_keys()


@router.get("/libraries/braille-alphabet")
def braille_alphabet(_: User = Depends(require_admin)) -> dict:
    return content_service.braille_alphabet()


@router.get("/export")
def export_course_pack(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> Response:
    payload = content_pack.export_course_zip(db)
    return Response(
        content=payload,
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="dotline-course.zip"',
        },
    )


@router.post(
    "/import",
    response_model=ImportResult,
    dependencies=[Depends(require_csrf)],
)
async def import_course_pack(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
    confirm: str = Form(...),
    pack: UploadFile = File(...),
) -> ImportResult:
    if confirm.strip().upper() != "IMPORT":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"confirm": "Type IMPORT to confirm replacing course content."},
        )
    raw = await pack.read()
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Upload a Dotline course ZIP (units + alphabet + strokes).",
        )
    result = content_pack.import_course_zip(db, raw)
    return ImportResult(
        message=(
            "Course pack imported. "
            f"Braille {result['braille_units']} units / {result['braille_lessons']} lessons · "
            f"Cursive {result['cursive_units']} units / {result['cursive_lessons']} lessons."
        ),
        braille_units=result["braille_units"],
        braille_lessons=result["braille_lessons"],
        cursive_units=result["cursive_units"],
        cursive_lessons=result["cursive_lessons"],
        files_written=result["files_written"],
    )
