"""
download_datasets.py
Downloads all 9 electricsheepafrica datasets from HuggingFace as parquet files
into data-engine/data/.

Run once before compute_baselines.py.
Requires: pip install huggingface-hub
"""

from pathlib import Path
from huggingface_hub import hf_hub_download

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

DATASETS = {
    "A_network_event_logs": {
        "repo": "electricsheepafrica/africa-synth-telecom-network-event-logs-nigeria",
        "file": "network_event_logs.parquet",
    },
    "B_network_slicing": {
        "repo": "electricsheepafrica/africa-synth-telecom-fifth-generation-network-slicing-nigeria",
        "file": "fifth_generation_network_slicing_datasets.parquet",
    },
    "C_billing_recharge": {
        "repo": "electricsheepafrica/africa-synth-telecom-billing-and-recharge-history-nigeria",
        "file": "billing_and_recharge_history.parquet",
    },
    "D_support_tickets": {
        "repo": "electricsheepafrica/africa-synth-telecom-customer-support-ticket-records-nigeria",
        "file": "customer_support_ticket_records.parquet",
    },
    "E_cdr": {
        "repo": "electricsheepafrica/africa-synth-telecom-call-detail-records-nigeria",
        "file": "call_detail_records.parquet",
    },
    "F_hardware_sensor": {
        "repo": "electricsheepafrica/africa-synth-telecom-hardware-sensor-data-nigeria",
        "file": "hardware_sensor_data.parquet",
    },
    "G_bts_uptime": {
        "repo": "electricsheepafrica/africa-synth-telecom-base-station-uptime-logs-nigeria",
        "file": "base_station_uptime_logs.parquet",
    },
    "H_sentiment": {
        "repo": "electricsheepafrica/africa-synth-telecom-social-media-sentiment-datasets-nigeria",
        "file": "social_media_sentiment_datasets.parquet",
    },
    "I_fraud": {
        "repo": "electricsheepafrica/africa-synth-telecom-fraudulent-activity-datasets-nigeria",
        "file": "fraudulent_activity_datasets.parquet",
    },
}


def download_all() -> None:
    for name, cfg in DATASETS.items():
        dest = DATA_DIR / f"{name}.parquet"
        if dest.exists():
            print(f"  SKIP  {name} (already downloaded)")
            continue
        print(f"  GET   {name} ...")
        try:
            path = Path(hf_hub_download(
                repo_id=cfg["repo"],
                filename=cfg["file"],
                repo_type="dataset",
                local_dir=DATA_DIR,
            ))
            if path.resolve() != dest.resolve():
                path.rename(dest)
            print(f"  OK    {name} → {dest.name}")
        except Exception as e:
            print(f"  FAIL  {name}: {e}")
            print(f"        Try: https://huggingface.co/datasets/{cfg['repo']}")


if __name__ == "__main__":
    print(f"Downloading {len(DATASETS)} datasets to {DATA_DIR}\n")
    download_all()
    print("\nDone. Run compute_baselines.py next.")
