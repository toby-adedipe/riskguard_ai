"""CSV and JSONL replay adapter for canonical signal events."""

from __future__ import annotations

import csv
import hashlib
import io
import json
from collections.abc import Iterator, Mapping
from dataclasses import dataclass
from typing import Any

from pydantic import ValidationError

from app.core.schemas import SignalEvent
from app.modules.ingestion.mapping import ReplayColumnMapping, normalize_record
from app.modules.ingestion.source import ReplayFormat, ReplayValidationError


@dataclass(frozen=True, slots=True)
class ReplaySource:
    """Parse an in-memory CSV or JSONL replay into canonical signal events."""

    content: str
    format: ReplayFormat
    column_mapping: dict[str, str] | None = None
    source_name: str = "replay"

    def stream(self) -> Iterator[SignalEvent]:
        """Yield validated events in file order without buffering the full replay."""

        if self.format not in {"csv", "jsonl"}:
            raise ReplayValidationError(
                f"unsupported replay format {self.format!r}; expected 'csv' or 'jsonl'",
                source_name=self.source_name,
            )

        mapping = ReplayColumnMapping(self.column_mapping, source_name=self.source_name)
        records = self._csv_records() if self.format == "csv" else self._jsonl_records()
        for row_number, record in records:
            payload = normalize_record(
                record,
                mapping,
                row_number=row_number,
                source_name=self.source_name,
            )
            yield self._to_event(payload, row_number=row_number)

    def _csv_records(self) -> Iterator[tuple[int, Mapping[str, Any]]]:
        reader = csv.DictReader(io.StringIO(self.content))
        if reader.fieldnames is None:
            raise ReplayValidationError(
                "CSV replay is missing a header row",
                row_number=1,
                source_name=self.source_name,
            )

        fieldnames = [field.strip() if field is not None else "" for field in reader.fieldnames]
        if any(not field for field in fieldnames):
            raise ReplayValidationError(
                "CSV header contains an empty field name",
                row_number=1,
                source_name=self.source_name,
            )
        duplicates = sorted({field for field in fieldnames if fieldnames.count(field) > 1})
        if duplicates:
            raise ReplayValidationError(
                f"CSV header contains duplicate fields: {', '.join(duplicates)}",
                row_number=1,
                source_name=self.source_name,
            )
        reader.fieldnames = fieldnames

        for row_number, record in enumerate(reader, start=2):
            if None in record:
                raise ReplayValidationError(
                    "CSV row contains more values than the header",
                    row_number=row_number,
                    source_name=self.source_name,
                )
            yield row_number, record

    def _jsonl_records(self) -> Iterator[tuple[int, Mapping[str, Any]]]:
        for row_number, line in enumerate(self.content.splitlines(), start=1):
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ReplayValidationError(
                    f"invalid JSON: {exc.msg}",
                    row_number=row_number,
                    source_name=self.source_name,
                ) from exc
            if not isinstance(record, Mapping):
                raise ReplayValidationError(
                    "JSONL row must be an object",
                    row_number=row_number,
                    source_name=self.source_name,
                )
            yield row_number, record

    def _to_event(self, payload: dict[str, Any], *, row_number: int) -> SignalEvent:
        supplied_event_id = payload.get("event_id")
        supplied_evidence_id = payload.get("evidence_id")
        validation_payload = {
            **payload,
            "event_id": supplied_event_id or "pending",
            "evidence_id": supplied_evidence_id or "pending",
            "source_system": payload.get("source_system") or self.source_name,
        }

        try:
            event = SignalEvent.model_validate(validation_payload)
        except ValidationError as exc:
            details = "; ".join(
                f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}"
                for error in exc.errors(include_url=False)
            )
            raise ReplayValidationError(
                details,
                row_number=row_number,
                source_name=self.source_name,
            ) from exc

        identity_payload = event.model_dump(
            mode="json",
            exclude={"event_id", "evidence_id"},
        )
        encoded = json.dumps(
            identity_payload,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        digest = hashlib.sha256(encoded).hexdigest()[:24]
        return event.model_copy(
            update={
                "event_id": supplied_event_id or f"evt:{digest}",
                "evidence_id": supplied_evidence_id or f"evd:{digest}",
            }
        )
