from app.core import schemas as core_schemas

# Re-export core Pydantic models for engine compatibility
SignalEvent = core_schemas.SignalEvent
RiskScore = core_schemas.RiskScore
Incident = core_schemas.Incident
