"""ML paths and frozen constants (LEAN §6, slice P3.1)."""
from pathlib import Path

SEED = 20260928

ROOT = Path(__file__).resolve().parent.parent.parent  # repo root
ML_DIR = ROOT / "ml"
DATA_DIR = ML_DIR / "data"
FER2013_DIR = DATA_DIR / "fer2013"
FEATURES_DIR = DATA_DIR / "features"
ARTIFACTS_DIR = ML_DIR / "artifacts"
REPORTS_DIR = ML_DIR / "reports"
TASK_PATH = ARTIFACTS_DIR / "face_landmarker.task"
MODEL_JSON = ARTIFACTS_DIR / "emotion_model.json"
FEATURE_SPEC = ROOT / "contracts" / "feature_spec.json"
CLASSIFIER_VECTORS = ROOT / "contracts" / "classifier_vectors.json"

# Frozen label map (LEAN §6.1): distress = angry, fear, sad; calm = happy, neutral;
# surprise/disgust excluded entirely.
LABEL_MAP = {
    "angry": "distress",
    "fear": "distress",
    "sad": "distress",
    "happy": "calm",
    "neutral": "calm",
}
EXCLUDED_LABELS = ("surprise", "disgust")
BINARY_LABELS = ("distress", "calm")
MAX_PER_CLASS = 6000

# Frozen preprocess grid (P3.3 pilot chooses the winner).
PAD_FRAC_GRID = (0.0, 0.25, 0.4)
SIZE_GRID = (256, 384)
