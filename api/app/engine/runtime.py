from app.engine.resolver import EntityResolver
from app.engine.normalizer import EventNormalizer
from app.engine.features import FeatureEngine
from app.engine.scoring import RiskScoringEngine
from app.engine.repos import DictSignalEventRepo, DictRiskScoreRepo, DictIncidentRepo
from app.engine.generator import SyntheticEventGenerator
from app.engine.impact import IncidentImpactBuilder

# Initialize shared engine components (simple singletons for demo)
resolver = EntityResolver()
normalizer = EventNormalizer(resolver)
features = FeatureEngine()
sig_repo = DictSignalEventRepo()
score_repo = DictRiskScoreRepo()
inc_repo = DictIncidentRepo()
scoring = RiskScoringEngine(features, repo=score_repo)
generator = SyntheticEventGenerator(normalizer, sig_repo, score_repo, inc_repo)
impact_builder = IncidentImpactBuilder()
