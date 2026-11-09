"""Helpers for inspecting FastAPI routes across framework versions."""

from __future__ import annotations

from collections.abc import Iterator

from fastapi import FastAPI
from fastapi.routing import APIRoute


def iter_api_routes(app: FastAPI) -> Iterator[APIRoute]:
    """Yield APIRoute objects, including those nested under FastAPI 0.162+ includes."""

    def walk(routes: list) -> Iterator[APIRoute]:
        for route in routes:
            if isinstance(route, APIRoute):
                yield route
                continue
            nested = getattr(route, "routes", None)
            if nested is not None:
                yield from walk(list(nested))
                continue
            original = getattr(route, "original_router", None)
            if original is not None:
                yield from walk(list(getattr(original, "routes", [])))

    yield from walk(list(app.routes))


def api_paths(app: FastAPI) -> set[str]:
    return {route.path for route in iter_api_routes(app)}
