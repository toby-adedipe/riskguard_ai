from datetime import datetime, timedelta, timezone
import unittest

from app.core.schemas import SignalEvidence
from app.modules.evidence.db import EvidenceConflictError, EvidenceRepository


def make_evidence(
    evidence_id: str,
    *,
    lga_id: str = "ikeja",
    value: float = 71.0,
    minute: int = 0,
) -> SignalEvidence:
    return SignalEvidence(
        evidence_id=evidence_id,
        lga_id=lga_id,
        domain="network",
        kpi="cell_availability_pct",
        current_value=value,
        summary=f"availability is {value:g}",
        timestamp=datetime(2026, 7, 9, 10, 0, tzinfo=timezone.utc)
        + timedelta(minutes=minute),
    )


class EvidenceRepositoryContractTest(unittest.TestCase):
    def setUp(self) -> None:
        self.repo = EvidenceRepository()

    def test_add_is_idempotent_for_an_identical_stable_id(self) -> None:
        evidence = make_evidence("evd:one")

        self.repo.add(evidence)
        duplicate = self.repo.add(evidence.model_copy(deep=True))

        self.assertEqual(duplicate, evidence)
        self.assertEqual(self.repo.list_for_lga("ikeja"), [evidence])

    def test_add_rejects_a_conflicting_payload_for_the_same_id(self) -> None:
        self.repo.add(make_evidence("evd:one", value=71.0))

        with self.assertRaises(EvidenceConflictError):
            self.repo.add(make_evidence("evd:one", value=55.0))

        self.assertEqual(self.repo.get("evd:one").current_value, 71.0)  # type: ignore[union-attr]

    def test_upsert_is_explicit_replacement_and_lga_listing_is_stable(self) -> None:
        later = make_evidence("evd:later", minute=5)
        earlier = make_evidence("evd:earlier", minute=1)
        other_lga = make_evidence("evd:other", lga_id="surulere", minute=0)
        for evidence in (later, other_lga, earlier):
            self.repo.add(evidence)

        replacement = make_evidence("evd:earlier", value=65.0, minute=1)
        self.repo.upsert(replacement)

        self.assertEqual(
            [item.evidence_id for item in self.repo.list_for_lga("ikeja")],
            ["evd:earlier", "evd:later"],
        )
        self.assertEqual(self.repo.get("evd:earlier"), replacement)

    def test_add_many_preflights_existing_conflicts_before_any_write(self) -> None:
        original = make_evidence("evd:existing", value=71.0)
        self.repo.add(original)

        with self.assertRaises(EvidenceConflictError):
            self.repo.add_many(
                [
                    make_evidence("evd:new", value=60.0),
                    make_evidence("evd:existing", value=55.0),
                ]
            )

        self.assertIsNone(self.repo.get("evd:new"))
        self.assertEqual(self.repo.get("evd:existing"), original)


if __name__ == "__main__":
    unittest.main()
