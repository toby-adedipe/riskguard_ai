"""Public contracts shared by signal-event ingestion adapters."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Literal, Protocol

from app.core.schemas import SignalEvent


ReplayFormat = Literal["csv", "jsonl"]


class ReplayValidationError(ValueError):
    """A replay record could not be normalized into a ``SignalEvent``.

    ``row_number`` is the one-based source line. CSV data begins on row two
    because row one is the header. Configuration errors may omit a row.
    """

    def __init__(
        self,
        message: str,
        *,
        row_number: int | None = None,
        source_name: str = "replay",
    ) -> None:
        self.message = message
        self.row_number = row_number
        self.source_name = source_name
        location = f" row {row_number}" if row_number is not None else ""
        super().__init__(f"{source_name}{location}: {message}")


class SignalEventSource(Protocol):
    """Minimal source boundary consumed by replay pipelines."""

    def stream(self) -> Iterator[SignalEvent]:
        """Yield canonical signal events in source order."""

