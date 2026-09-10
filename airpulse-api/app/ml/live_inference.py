"""Strict, registry-selected inference. No training or heuristic fallback."""
import hashlib
import warnings
from pathlib import Path

from app.config import settings
from app.services.live_store import rows


class InferenceUnavailable(ValueError):
    def __init__(self, reason, detail):
        self.reason = reason
        super().__init__(f'{reason}: {detail}')


async def active_record(db, kind):
    records = await rows(db, 'SELECT to_jsonb(m) AS record FROM model_registry m ORDER BY created_at DESC')
    for item in records:
        record = item['record']
        status = record.get('status', 'ACTIVE' if record.get('active') else 'RETIRED')
        identity = f"{record.get('model_name','')} {record.get('model_type','')}".lower()
        if kind in identity and status.upper() == 'ACTIVE' and record.get('active', True):
            return record
    raise InferenceUnavailable('MODEL_UNAVAILABLE', f'No ACTIVE {kind} model in registry')


def artifact_path(record):
    root = Path(__file__).resolve().parents[2]
    directory = Path(settings.MODEL_DIR)
    if not directory.is_absolute():
        directory = root / directory
    stored = record.get('artifact_storage_path') or record.get('artifact_path')
    if not stored:
        raise InferenceUnavailable('MODEL_ARTIFACT_MISSING', 'Registry has no artifact path')
    # Registry artifacts were originally registered on Windows; Docker is Linux.
    normalized = Path(str(stored).replace('\\', '/'))
    candidates = [directory / normalized.name, normalized if normalized.is_absolute() else root / normalized]
    for candidate in candidates:
        if candidate.is_file():
            return candidate.resolve()
    raise InferenceUnavailable('MODEL_ARTIFACT_MISSING', f'{normalized.name} is not accessible under MODEL_DIR or its registered path')


_cache = {}


def load_active(record, kind):
    import joblib
    import numpy as np
    from sklearn.utils.validation import check_is_fitted
    from sklearn.exceptions import InconsistentVersionWarning
    from app.ml.fareguard import FareGuardModel
    from app.ml.priceguard import PriceGuardDetector
    from xgboost import XGBRegressor
    from sklearn.ensemble import IsolationForest
    path = artifact_path(record)
    schema = record.get('feature_schema') or {}
    features = schema.get('features') if isinstance(schema, dict) else schema
    if not isinstance(features, list) or not features:
        raise InferenceUnavailable('FEATURE_SCHEMA_MISMATCH', 'Registry feature list is missing')
    key = (kind, record['version'], str(path), path.stat().st_mtime_ns, tuple(features), record.get('checksum'))
    if key in _cache:
        return _cache[key]
    try:
        if record.get('checksum') and hashlib.sha256(path.read_bytes()).hexdigest() != record['checksum']:
            raise InferenceUnavailable('MODEL_LOAD_ERROR', 'Artifact checksum does not match registry')
        with warnings.catch_warnings():
            warnings.simplefilter('error', InconsistentVersionWarning)
            data = joblib.load(path)
        expected = FareGuardModel.FEATURE_COLS if kind == 'fareguard' else PriceGuardDetector.ANOMALY_FEATURE_COLS
        if data.get('features') != features or set(features) != set(expected):
            raise InferenceUnavailable('FEATURE_SCHEMA_MISMATCH', 'Artifact and ACTIVE registry feature schemas disagree')
        if data.get('version') != record['version']:
            raise InferenceUnavailable('MODEL_LOAD_ERROR', 'Artifact version does not match ACTIVE registry')
        estimator = data['model']
        if not isinstance(estimator, XGBRegressor if kind == 'fareguard' else IsolationForest):
            raise InferenceUnavailable('MODEL_LOAD_ERROR', 'Unexpected estimator type')
        check_is_fitted(estimator)
        if getattr(estimator, 'n_features_in_', None) != len(features):
            raise InferenceUnavailable('FEATURE_SCHEMA_MISMATCH', 'Fitted estimator feature count differs from registry')
        learned = getattr(estimator, 'feature_names_in_', None)
        if learned is not None and list(learned) != features:
            raise InferenceUnavailable('FEATURE_SCHEMA_MISMATCH', 'Fitted estimator feature order differs from registry')
        estimator.set_params(n_jobs=1)
        model = FareGuardModel(record['version']) if kind == 'fareguard' else PriceGuardDetector(record['version'])
        model.model, model.is_trained = estimator, True
        if kind == 'fareguard':
            model.FEATURE_COLS = features
        else:
            model.ANOMALY_FEATURE_COLS = features
            calibration = np.asarray(data.get('training_scores'), dtype=float)
            if calibration.ndim != 1 or not calibration.size or not np.isfinite(calibration).all():
                raise InferenceUnavailable('MODEL_LOAD_ERROR', 'Isolation Forest calibration is missing or invalid')
            model.training_scores = calibration
        # Cache only successfully loaded ACTIVE artifacts; activation changes the key.
        for old in list(_cache):
            if old[0] == kind:
                del _cache[old]
        _cache[key] = model
        return model
    except InferenceUnavailable:
        raise
    except Exception as exc:
        raise InferenceUnavailable('MODEL_LOAD_ERROR', f'{type(exc).__name__} while loading {kind}') from exc


async def get_active_model(db, kind):
    import asyncio
    record = await active_record(db, kind)
    return await asyncio.to_thread(load_active, record, kind)


def validate_features(model, frame, kind):
    import numpy as np
    from sklearn.utils import get_tags
    features = model.FEATURE_COLS if kind == 'fareguard' else model.ANOMALY_FEATURE_COLS
    if any(column not in frame for column in features):
        raise InferenceUnavailable('FEATURE_SCHEMA_MISMATCH', 'Required feature columns are missing')
    core = ['distance_km','booking_window_days','day_of_week','is_weekend','month'] if kind == 'fareguard' else ['actual_fare','predicted_fare','residual','residual_pct','booking_window_days']
    try:
        matrix = frame[features].astype(float)
        if not np.isfinite(matrix[core].to_numpy()).all() or np.isinf(matrix.to_numpy()).any():
            raise InferenceUnavailable('INSUFFICIENT_FEATURES', 'Essential features are missing or non-finite')
        if kind == 'priceguard' and (matrix['predicted_fare'] <= 0).any():
            raise InferenceUnavailable('PREDICTION_UNAVAILABLE', 'PriceGuard requires a positive FareGuard prediction')
        if matrix.isna().any().any() and not get_tags(model.model).input_tags.allow_nan:
            raise InferenceUnavailable('INSUFFICIENT_FEATURES', 'This fitted estimator does not support optional missing values')
    except (TypeError, ValueError) as exc:
        if isinstance(exc, InferenceUnavailable):
            raise
        raise InferenceUnavailable('FEATURE_SCHEMA_MISMATCH', 'Numeric training features have incompatible values') from exc
    return matrix
