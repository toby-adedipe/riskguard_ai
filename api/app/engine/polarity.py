"""KPI polarity rules for harmful-direction anomaly gating."""

from __future__ import annotations

from typing import Literal, cast

from app.core.schemas import SignalKpi


Polarity = Literal["higher_is_worse", "lower_is_worse"]


KPI_POLARITY: dict[SignalKpi, Polarity] = {
    "cell_availability_pct": "lower_is_worse",
    "dropped_call_rate_pct": "higher_is_worse",
    "congestion_rate_pct": "higher_is_worse",
    "site_availability_pct": "lower_is_worse",
    "bts_dropped_call_rate_pct": "higher_is_worse",
    "bts_congestion_rate_pct": "higher_is_worse",
    "failed_rating_events": "higher_is_worse",
    "invoice_mismatch_rate_pct": "higher_is_worse",
    "revenue_leakage_anomaly_score": "higher_is_worse",
    "activation_success_rate_pct": "lower_is_worse",
    "dealer_channel_availability_pct": "lower_is_worse",
    "b2b_order_failure_rate_pct": "higher_is_worse",
    "recharge_success_rate_pct": "lower_is_worse",
    "complaint_volume": "higher_is_worse",
    "complaint_rate_per_1k_subscribers": "higher_is_worse",
    "session_failure_rate_pct": "higher_is_worse",
    "attach_failure_rate_pct": "higher_is_worse",
    "social_posts_per_hr": "higher_is_worse",
    "negative_sentiment_score": "higher_is_worse",
}


def polarity_for(kpi: SignalKpi | str) -> Polarity:
    """Return the configured polarity or reject an unknown KPI explicitly."""

    try:
        return KPI_POLARITY[cast(SignalKpi, kpi)]
    except KeyError as exc:
        accepted = ", ".join(sorted(KPI_POLARITY))
        raise ValueError(f"Unknown KPI {kpi!r}; expected one of: {accepted}") from exc


def harmful_z_score(kpi: SignalKpi | str, z_score: float) -> float:
    """Return the non-negative harmful component of a signed z-score."""

    if polarity_for(kpi) == "higher_is_worse":
        return max(0.0, z_score)
    return max(0.0, -z_score)

