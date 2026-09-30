# GATE 3 — emotion model (LEAN §6.8). Data-dependent checks are BLOCKED_ON_H3 until FER2013
# exists (human step H3 = licence acceptance); the code and data-independent proofs run now.

check "ml tests" "cd ml && .venv/bin/pytest -q"
check "task hash" "bash scripts/fetch_models.sh"
check "model card" "python3 -c \"import pathlib; text = pathlib.Path('ml/MODEL_CARD.md').read_text(); sections = ['## Intended use','## Out of scope','## Data','## Method','## Results','## Limitations','## Privacy','## Ethics','## Reproduction commands','## Versions and hashes']; missing = [s for s in sections if s not in text]; assert not missing, f'missing sections: {missing}'; print('model card sections ok')\""
check "git hygiene" "test -z \"\$(git ls-files ml/data 'ml/artifacts/*.task')\" && echo 'no dataset or .task tracked by git'"
check "ruff" "cd ml && .venv/bin/ruff check ."
check "placeholders" "bash scripts/no_placeholders.sh"

if [ -d ml/data/fer2013 ] || compgen -G "ml/data/*.csv" > /dev/null; then
  check "dataset" "cd ml && .venv/bin/python -c \"from src.dataset_index import build_index, write_report; entries, report = build_index(); write_report(report); total = report['after_dedupe']['total']; assert total >= 10000, f'only {total} images after dedupe'; print('dataset ok:', total, 'images')\""
  check "features" "test -f ml/data/features/test.npz || make ml-features; python3 -c \"import json; d = json.load(open('ml/reports/detection.json')); rate = d['overall_rate']; assert rate >= 0.50, f'detection rate {rate} < 0.50'; print('detection ok:', rate)\""
  check "model bars" "make ml-train ml-eval && cd ml && .venv/bin/python -m src.check_bars"
  check "model json" "make ml-export && python3 -c \"import json, pathlib; raw = pathlib.Path('ml/artifacts/emotion_model.json').read_bytes(); model = json.loads(raw); assert len(model['feature_names']) == len(model['weights']) == len(model['mean']) == len(model['std']); assert len(raw) <= 20 * 1024, f'model json {len(raw)} bytes > 20 KB'; print('model json valid,', len(raw), 'bytes')\""
  check "vectors" "make ml-vectors"
else
  blocked "H3" "dataset" "FER2013 not present — complete H3 (see SETUP_REQUIRED.md), then: make ml-data ml-features"
  blocked "H3" "features" "needs the dataset (detection rate >= 0.50 bar)"
  blocked "H3" "model bars" "needs extraction + training (ROC-AUC >= 0.75, balanced accuracy >= 0.68, recall >= 0.60, false-alarm <= 0.35)"
  blocked "H3" "model json" "produced by make ml-export after training (<= 20 KB, validator-clean)"
  blocked "H3" "vectors" "generated from the trained model; Kotlin parity depends on them"
fi

check "regression: previous gate" "bash scripts/gate.sh 2"
