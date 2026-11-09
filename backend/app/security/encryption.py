"""Fernet helpers for encrypting third-party API keys at rest."""

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings


def _fernet() -> Fernet:
    key = get_settings().app_encryption_key.encode("utf-8")
    return Fernet(key)


def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_secret(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Unable to decrypt secret") from exc


def mask_secret(value: str, *, prefix_len: int = 3, suffix_len: int = 4) -> str:
    if len(value) <= prefix_len + suffix_len:
        return "••••"
    return f"{value[:prefix_len]}••••{value[-suffix_len:]}"
