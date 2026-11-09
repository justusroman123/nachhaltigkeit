"""MT-Attrappe: stellt das Sprachkuerzel voran, z. B. "[uk] Text"."""
from __future__ import annotations

import asyncio


class MockMt:
    def __init__(self, delay_ms: int = 0):
        self._delay_ms = delay_ms

    async def load(self) -> None:
        return None

    async def translate(self, text: str, src: str, tgt: str) -> str:
        if self._delay_ms:
            await asyncio.sleep(self._delay_ms / 1000)
        return f"[{tgt}] {text}"
