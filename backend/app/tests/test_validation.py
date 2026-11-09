"""Unit tests for signup field validation."""

import pytest
from fastapi import HTTPException

from app.services.validation import validate_password, validate_person_name, validate_username


def test_rejects_junk_names() -> None:
    with pytest.raises(HTTPException) as exc:
        validate_person_name("asdf", field="first_name")
    assert "first_name" in exc.value.detail


def test_rejects_repeated_chars() -> None:
    with pytest.raises(HTTPException):
        validate_person_name("Aaaaron", field="first_name")


def test_accepts_accented_name() -> None:
    assert validate_person_name("José", field="first_name") == "José"


def test_username_rules() -> None:
    assert validate_username("learner_1") == "learner_1"
    with pytest.raises(HTTPException):
        validate_username("ab")


def test_common_password_rejected() -> None:
    with pytest.raises(HTTPException):
        validate_password("password1234")
