"""Column mapping and record normalization for replay sources."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from app.core.schemas import SignalDimensions, SignalEvent
from app.modules.ingestion.source import ReplayValidationError


EVENT_FIELDS = frozenset(SignalEvent.model_fields)
DIMENSION_FIELDS = frozenset(SignalDimensions.model_fields)
REQUIRED_REPLAY_FIELDS = frozenset({"lga_id", "domain", "kpi", "value", "timestamp"})


class ReplayColumnMapping:
    """Resolve source column names to canonical event or dimension fields."""

    def __init__(
        self,
        overrides: Mapping[str, str] | None = None,
        *,
        source_name: str = "replay",
    ) -> None:
        self._source_name = source_name
        self._overrides: dict[str, str] = {}
        for source_field, target_field in (overrides or {}).items():
            if not isinstance(source_field, str) or not source_field.strip():
                raise ReplayValidationError(
                    "column mapping contains an empty source field",
                    source_name=source_name,
                )
            if not isinstance(target_field, str) or not target_field.strip():
                raise ReplayValidationError(
                    f"column mapping for {source_field!r} has an empty target",
                    source_name=source_name,
                )
            self._overrides[source_field] = self._canonical_target(target_field)

    def resolve(self, source_field: str, *, row_number: int) -> str:
        """Return the canonical target, applying identity mapping by default."""

        if source_field in self._overrides:
            return self._overrides[source_field]
        try:
            return self._canonical_target(source_field)
        except ReplayValidationError as exc:
            raise ReplayValidationError(
                f"unknown field {source_field!r}; add an explicit column mapping or remove it",
                row_number=row_number,
                source_name=self._source_name,
            ) from exc

    def _canonical_target(self, target_field: str) -> str:
        target = target_field.strip()
        if target in EVENT_FIELDS:
            return target
        if target in DIMENSION_FIELDS:
            return f"dimensions.{target}"
        if target.startswith("dimensions."):
            dimension_field = target.removeprefix("dimensions.")
            if dimension_field in DIMENSION_FIELDS:
                return target
        raise ReplayValidationError(
            f"unknown canonical field {target_field!r}",
            source_name=self._source_name,
        )


def normalize_record(
    record: Mapping[str, Any],
    column_mapping: ReplayColumnMapping,
    *,
    row_number: int,
    source_name: str,
) -> dict[str, Any]:
    """Map one source record to a Pydantic-ready ``SignalEvent`` payload."""

    event_payload: dict[str, Any] = {}
    dimensions: dict[str, Any] = {}

    for source_field, raw_value in record.items():
        if not isinstance(source_field, str) or not source_field.strip():
            raise ReplayValidationError(
                "record contains an empty or invalid field name",
                row_number=row_number,
                source_name=source_name,
            )

        target = column_mapping.resolve(source_field, row_number=row_number)
        value = _empty_string_to_none(raw_value)

        if target == "dimensions":
            _merge_dimensions(
                dimensions,
                value,
                row_number=row_number,
                source_name=source_name,
            )
        elif target.startswith("dimensions."):
            dimension_field = target.removeprefix("dimensions.")
            _put_unique(
                dimensions,
                dimension_field,
                value,
                target=target,
                row_number=row_number,
                source_name=source_name,
            )
        else:
            _put_unique(
                event_payload,
                target,
                value,
                target=target,
                row_number=row_number,
                source_name=source_name,
            )

    if dimensions:
        event_payload["dimensions"] = dimensions

    missing = sorted(
        field
        for field in REQUIRED_REPLAY_FIELDS
        if field not in event_payload or event_payload[field] is None
    )
    if missing:
        raise ReplayValidationError(
            f"missing required fields: {', '.join(missing)}",
            row_number=row_number,
            source_name=source_name,
        )

    return event_payload


def _merge_dimensions(
    destination: dict[str, Any],
    value: Any,
    *,
    row_number: int,
    source_name: str,
) -> None:
    if value is None:
        return
    if not isinstance(value, Mapping):
        raise ReplayValidationError(
            "dimensions must be a JSON object",
            row_number=row_number,
            source_name=source_name,
        )
    unknown = sorted(set(value) - DIMENSION_FIELDS)
    if unknown:
        raise ReplayValidationError(
            f"unknown dimension fields: {', '.join(unknown)}",
            row_number=row_number,
            source_name=source_name,
        )
    for dimension_field, dimension_value in value.items():
        _put_unique(
            destination,
            dimension_field,
            _empty_string_to_none(dimension_value),
            target=f"dimensions.{dimension_field}",
            row_number=row_number,
            source_name=source_name,
        )


def _put_unique(
    destination: dict[str, Any],
    key: str,
    value: Any,
    *,
    target: str,
    row_number: int,
    source_name: str,
) -> None:
    if key in destination:
        raise ReplayValidationError(
            f"multiple source fields map to {target!r}",
            row_number=row_number,
            source_name=source_name,
        )
    destination[key] = value


def _empty_string_to_none(value: Any) -> Any:
    if isinstance(value, str) and not value.strip():
        return None
    return value
