import contextlib
import dataclasses

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

KEY = "test-operator-key-0123456789"


class FakeClock:
    def __init__(self, t: float = 1_000.0):
        self.t = t

    def __call__(self) -> float:
        return self.t

    def advance(self, s: float) -> None:
        self.t += s


@pytest.fixture
def settings():
    return Settings(operator_key=KEY, mock_asr_segment_s=0.2, min_listener_ttl_s=1,
                    listener_ttl_s=60, ring_buffer_size=3).validate()


@pytest.fixture
def clock():
    return FakeClock()


def make_settings(**kw) -> Settings:
    return dataclasses.replace(
        Settings(operator_key=KEY, mock_asr_segment_s=0.2, min_listener_ttl_s=1,
                 listener_ttl_s=60, ring_buffer_size=3), **kw).validate()


@contextlib.contextmanager
def app_client(settings, clock=None):
    """TestClient, der alle geoeffneten WebSockets vor dem Beenden schliesst."""
    kw = {"clock": clock} if clock else {}
    with TestClient(create_app(settings, **kw)) as c:
        c.stack = contextlib.ExitStack()
        try:
            yield c
        finally:
            c.stack.close()


@pytest.fixture
def client(settings):
    with app_client(settings) as c:
        yield c


def hdr():
    return {"X-Operator-Key": KEY}


def chunk(ms: int = 100, rate: int = 16000) -> bytes:
    return b"\x00\x00" * (rate * ms // 1000)
