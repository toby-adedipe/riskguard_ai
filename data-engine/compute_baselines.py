"""
compute_baselines.py
Loads all 9 datasets once, computes baseline mean/std per domain per city,
writes output/calibration.py for import by api/app/engine/calibration.py.

Run after download_datasets.py.
Requires: pip install pandas pyarrow
"""

from pathlib import Path
import pandas as pd

DATA_DIR = Path(__file__).parent / "data"
OUT_FILE = Path(__file__).parent / "output" / "calibration.py"
OUT_FILE.parent.mkdir(exist_ok=True)

CITIES = [
    "Lagos", "Abuja", "Kano", "Port Harcourt", "Ibadan",
    "Ilorin", "Enugu", "Benin City", "Calabar", "Aba",
    "Kaduna", "Warri", "Abeokuta", "Onitsha", "Jos",
]

# Known schemas from HuggingFace API — used for column-safe access
# A: city, severity, event_type, packet_loss_percent, affected_users, tower_id, timestamp
# B: city, sla_met(bool), throughput_mbps, latency_ms, reliability_percent, resource_utilization_percent, tower_id, timestamp
# C: NO city — transaction_type, status, amount_ngn, timestamp
# D: NO city — created_at, issue_type, priority, resolution_time_hours, customer_satisfaction
# E: city, call_status(completed/failed/dropped), call_type, tower_id, timestamp
# F: city, health_status(normal/warning), equipment_type, power_draw_watts, voltage_v, temperature_celsius, humidity_percent, alert_triggered(bool), tower_id, timestamp
# G: city, uptime_percentage, downtime_minutes, outage_count, outage_reason, date (not timestamp!)
# H: city_mentioned, sentiment_score, timestamp, issue_category
# I: location (not city!), fraud_type, detected_at (not timestamp!), status, financial_loss_ngn


def _load_all() -> dict[str, pd.DataFrame | None]:
    datasets = {}
    names = [
        "A_network_event_logs",
        "B_network_slicing",
        "C_billing_recharge",
        "D_support_tickets",
        "E_cdr",
        "F_hardware_sensor",
        "G_bts_uptime",
        "H_sentiment",
        "I_fraud",
    ]
    print("=== Loading datasets ===")
    for name in names:
        path = DATA_DIR / f"{name}.parquet"
        if not path.exists():
            print(f"  MISSING {name}.parquet — skipping")
            datasets[name] = None
        else:
            df = pd.read_parquet(path)
            print(f"  LOADED  {name}: {len(df):,} rows")
            datasets[name] = df
    return datasets


def _stats(series: pd.Series) -> dict:
    clean = series.dropna()
    return {"mean": round(float(clean.mean()), 4), "std": round(float(clean.std()), 4)}


def _hourly_rate(df: pd.DataFrame, ts_col: str, city_col: str) -> pd.DataFrame:
    tmp = df.copy()
    tmp["_hour"] = pd.to_datetime(tmp[ts_col]).dt.floor("h")
    return tmp.groupby([city_col, "_hour"]).size().reset_index(name="_count")


def _city_slice(df: pd.DataFrame, city: str, city_col: str) -> pd.DataFrame:
    return df[df[city_col] == city]


def compute_network(stats: dict, ds: dict) -> None:
    # A — packet loss and affected users at baseline (severity=low)
    df = ds["A_network_event_logs"]
    if df is not None:
        normal = df[df["severity"] == "low"]
        for city in CITIES:
            c = _city_slice(normal, city, "city")
            if c.empty:
                continue
            s = stats[city]["network"]
            s["packet_loss_pct"] = _stats(c["packet_loss_percent"])
            s["affected_users"]  = _stats(c["affected_users"])

    # B — throughput, latency, reliability at baseline (sla_met=True)
    df = ds["B_network_slicing"]
    if df is not None:
        normal = df[df["sla_met"].astype(bool)]
        city_col = "city" if "city" in normal.columns else None
        for city in CITIES:
            c = _city_slice(normal, city, city_col) if city_col else normal
            if c.empty:
                continue
            s = stats[city]["network"]
            for col, key in [
                ("throughput_mbps",             "throughput_mbps"),
                ("latency_ms",                  "latency_ms"),
                ("reliability_percent",         "reliability_pct"),
                ("resource_utilization_percent","resource_utilization_pct"),
            ]:
                if col in c.columns:
                    s[key] = _stats(c[col])

    # E — call drop rate and hourly CDR volume
    df = ds["E_cdr"]
    if df is not None:
        for city in CITIES:
            c = _city_slice(df, city, "city")
            if c.empty:
                continue
            total = len(c)
            s = stats[city]["network"]
            s["call_drop_rate"]  = {"mean": round((c["call_status"] == "dropped").sum() / total, 4), "std": 0.02}
            s["call_fail_rate"]  = {"mean": round((c["call_status"] == "failed").sum()  / total, 4), "std": 0.02}
            hourly = _hourly_rate(c, "timestamp", "city")
            city_hr = hourly[hourly["city"] == city]["_count"]
            if not city_hr.empty:
                s["cdr_volume_per_hr"] = _stats(city_hr)


def compute_bts(stats: dict, ds: dict) -> None:
    # F — physical sensor readings at health_status=normal
    df = ds["F_hardware_sensor"]
    if df is not None:
        normal = df[df["health_status"] == "normal"]
        for city in CITIES:
            c = _city_slice(normal, city, "city")
            if c.empty:
                continue
            s = stats[city]["bts"]
            for col, key in [
                ("power_draw_watts",   "power_draw_watts"),
                ("voltage_v",          "voltage_v"),
                ("temperature_celsius","temperature_celsius"),
                ("humidity_percent",   "humidity_pct"),
            ]:
                if col in c.columns:
                    s[key] = _stats(c[col])
            s["alert_rate_normal"] = {"mean": round(float(c["alert_triggered"].mean()), 4), "std": 0.01}

    # G — uptime stats (uses `date` col, no timestamp)
    df = ds["G_bts_uptime"]
    if df is not None:
        for city in CITIES:
            c = _city_slice(df, city, "city")
            if c.empty:
                continue
            s = stats[city]["bts"]
            s["uptime_pct"]          = _stats(c["uptime_percentage"])
            s["downtime_minutes"]    = _stats(c["downtime_minutes"])
            s["outage_count_per_day"]= _stats(c["outage_count"])


def compute_billing(stats: dict, ds: dict) -> None:
    # C — bill_payment rows (no city col → national aggregate applied to all cities)
    df = ds["C_billing_recharge"]
    if df is None:
        return
    bill = df[df["transaction_type"] == "bill_payment"]
    has_city = "city" in bill.columns
    national_fail_rate = (bill["status"] == "failed").sum() / max(len(bill), 1)
    national_amount    = _stats(bill["amount_ngn"]) if "amount_ngn" in bill.columns else None

    for city in CITIES:
        c = _city_slice(bill, city, "city") if has_city else bill
        if has_city and c.empty:
            c = bill  # fall back to national
        s = stats[city]["billing"]
        fail_rate = (c["status"] == "failed").sum() / max(len(c), 1)
        s["failed_charging_pct"] = {"mean": round(fail_rate, 4), "std": 0.01}
        if national_amount:
            s["bill_amount_ngn"] = national_amount


def compute_complaints(stats: dict, ds: dict) -> None:
    # D — support ticket volume (no city col → national aggregate)
    df = ds["D_support_tickets"]
    if df is not None:
        has_city = "city" in df.columns
        ts_col   = "created_at" if "created_at" in df.columns else "timestamp"
        national_hourly = _hourly_rate(df, ts_col, "operator") if not has_city else None

        for city in CITIES:
            c = _city_slice(df, city, "city") if has_city else df
            if has_city and c.empty:
                c = df
            s = stats[city]["complaints"]
            if has_city:
                hourly = _hourly_rate(c, ts_col, "city")
                ch = hourly[hourly["city"] == city]["_count"]
                if not ch.empty:
                    s["ticket_volume_per_hr"] = _stats(ch)
            else:
                # National: use total tickets/hr across all operators as baseline
                s["ticket_volume_per_hr"] = _stats(national_hourly["_count"])
            if "resolution_time_hours" in c.columns:
                s["resolution_time_hrs"] = _stats(c["resolution_time_hours"])

    # H — sentiment score and post volume per city (city_mentioned col)
    df = ds["H_sentiment"]
    if df is not None:
        city_col = "city_mentioned"
        for city in CITIES:
            c = _city_slice(df, city, city_col)
            if c.empty:
                continue
            s = stats[city]["complaints"]
            s["sentiment_score"] = _stats(c["sentiment_score"])
            hourly = _hourly_rate(c, "timestamp", city_col)
            ch = hourly[hourly[city_col] == city]["_count"]
            if not ch.empty:
                s["posts_per_hr"] = _stats(ch)


def compute_recharge(stats: dict, ds: dict) -> None:
    # C — recharge rows (no city col → national aggregate)
    df = ds["C_billing_recharge"]
    if df is None:
        return
    recharge = df[df["transaction_type"] == "recharge"]
    has_city = "city" in recharge.columns

    for city in CITIES:
        c = _city_slice(recharge, city, "city") if has_city else recharge
        if has_city and c.empty:
            c = recharge
        s = stats[city]["recharge"]
        fail_rate = (c["status"] == "failed").sum() / max(len(c), 1)
        s["failed_topup_pct"] = {"mean": round(fail_rate, 4), "std": 0.01}
        if "amount_ngn" in c.columns:
            s["recharge_amount_ngn"] = _stats(c["amount_ngn"])
        if has_city:
            hourly = _hourly_rate(c, "timestamp", "city")
            ch = hourly[hourly["city"] == city]["_count"]
            if not ch.empty:
                s["volume_per_hr"] = _stats(ch)


def compute_device_sessions(stats: dict, ds: dict) -> None:
    # A — authentication_failure rate
    df = ds["A_network_event_logs"]
    if df is not None:
        for city in CITIES:
            c = _city_slice(df, city, "city")
            if c.empty:
                continue
            total = len(c)
            rate  = (c["event_type"] == "authentication_failure").sum() / total
            stats[city]["device_sessions"]["auth_failure_rate"] = {"mean": round(rate, 4), "std": 0.005}

    # E — session failure rate (call_status=failed)
    df = ds["E_cdr"]
    if df is not None:
        for city in CITIES:
            c = _city_slice(df, city, "city")
            if c.empty:
                continue
            rate = (c["call_status"] == "failed").sum() / max(len(c), 1)
            stats[city]["device_sessions"]["session_failure_pct"] = {"mean": round(rate, 4), "std": 0.01}

    # I — SIM swap rate (uses `location` col and `detected_at` timestamp)
    df = ds["I_fraud"]
    if df is not None:
        city_col  = "location"
        sim_swaps = df[df["fraud_type"] == "sim_swap"]
        for city in CITIES:
            total_city = len(_city_slice(df, city, city_col))
            swap_count = len(_city_slice(sim_swaps, city, city_col))
            rate = swap_count / total_city if total_city else 0.0
            stats[city]["device_sessions"]["sim_anomaly_rate"] = {"mean": round(rate, 5), "std": 0.001}


def _default_stats() -> dict:
    return {
        city: {domain: {} for domain in ["network", "bts", "billing", "complaints", "recharge", "device_sessions"]}
        for city in CITIES
    }


def main() -> None:
    ds    = _load_all()
    stats = _default_stats()

    print("\n=== Computing baselines ===")
    compute_network(stats, ds)
    compute_bts(stats, ds)
    compute_billing(stats, ds)
    compute_complaints(stats, ds)
    compute_recharge(stats, ds)
    compute_device_sessions(stats, ds)

    lines = [
        "# AUTO-GENERATED by data-engine/compute_baselines.py — do not edit manually",
        "# Copy to api/app/engine/calibration.py",
        "",
        "BASELINE_STATS: dict = " + repr(stats),
        "",
    ]
    OUT_FILE.write_text("\n".join(lines))
    print(f"\nWritten: {OUT_FILE}")

    print("\n=== Coverage summary ===")
    for city in CITIES:
        filled = {domain: len(stats[city][domain]) for domain in stats[city]}
        print(f"  {city:<20} {filled}")


if __name__ == "__main__":
    main()
