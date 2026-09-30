"""Dataset index, dedupe and split (P3.2). Supports image-folder and fer2013.csv layouts."""
from __future__ import annotations

import csv
import hashlib
import json
import random
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from src.config import (
    BINARY_LABELS,
    FER2013_DIR,
    LABEL_MAP,
    MAX_PER_CLASS,
    REPORTS_DIR,
    SEED,
)

# Kaggle fer2013.csv encodes the 7 classes as integers in this order.
CSV_LABELS = {0: "angry", 1: "disgust", 2: "fear", 3: "happy", 4: "sad", 5: "surprise", 6: "neutral"}


@dataclass
class Entry:
    path_or_row: str
    label7: str
    binary: str
    source_split: str  # train | test
    md5: str


def _md5_bytes(data: bytes) -> str:
    return hashlib.md5(data).hexdigest()


def _index_image_folder(data_dir: Path) -> list[Entry]:
    entries: list[Entry] = []
    for split in ("train", "test"):
        split_dir = data_dir / split
        if not split_dir.is_dir():
            continue
        for emotion_dir in sorted(p for p in split_dir.iterdir() if p.is_dir()):
            label7 = emotion_dir.name.lower()
            for image in sorted(emotion_dir.glob("*")):
                if image.suffix.lower() not in (".jpg", ".jpeg", ".png"):
                    continue
                data = image.read_bytes()
                entries.append(Entry(str(image), label7, LABEL_MAP.get(label7, "excluded"),
                                     split, _md5_bytes(data)))
    return entries


def _index_csv(data_dir: Path) -> list[Entry]:
    csv_path = next((p for p in data_dir.glob("*.csv")), None)
    if csv_path is None:
        return []
    entries: list[Entry] = []
    with csv_path.open(newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            label7 = CSV_LABELS[int(row["emotion"])]
            split = "train" if "rain" in row.get("Usage", "Training") else "test"
            entries.append(Entry(f"{csv_path.name}#row{reader.line_num}", label7,
                                 LABEL_MAP.get(label7, "excluded"), split,
                                 _md5_bytes(row["pixels"].encode())))
    return entries


def build_index(data_dir: Path = FER2013_DIR) -> tuple[list[Entry], dict]:
    """Index → map labels → dedupe (cross-split md5 stays in train) → cap per class."""
    if (data_dir / "fer2013.csv").exists() or list(data_dir.glob("*.csv")):
        raw = _index_csv(data_dir)
    else:
        raw = _index_image_folder(data_dir)
    if not raw:
        raise FileNotFoundError(f"no FER2013 images or CSV found under {data_dir}")

    kept: dict[str, Entry] = {}
    for entry in raw:
        if entry.binary == "excluded":
            continue
        key = entry.md5
        if key in kept and kept[key].source_split == "test" and entry.source_split == "train":
            kept[key] = entry  # a hash present in two splits stays in train only
        elif key not in kept:
            kept[key] = entry
    deduped = list(kept.values())

    rng = random.Random(SEED)
    train_by_class: dict[str, list[Entry]] = {}
    for entry in deduped:
        if entry.source_split == "train":
            train_by_class.setdefault(entry.binary, []).append(entry)
    sampled_train: set[str] = set()
    for binary in BINARY_LABELS:
        pool = train_by_class.get(binary, [])
        if len(pool) > MAX_PER_CLASS:
            pool = rng.sample(pool, MAX_PER_CLASS)
        sampled_train.update(id(entry) for entry in pool)

    final = [e for e in deduped
             if e.source_split != "train" or id(e) in sampled_train]

    def counts(items: list[Entry]) -> dict:
        return {"total": len(items),
                **{f"{split}_{binary}": sum(1 for e in items if e.source_split == split and e.binary == binary)
                   for split in ("train", "test") for binary in BINARY_LABELS}}

    report = {
        "before_dedupe": counts(raw),
        "after_dedupe": counts(deduped),
        "after_sampling": counts(final),
        "excluded_before_dedupe": sum(1 for e in raw if e.binary == "excluded"),
    }
    return final, report


def write_report(report: dict) -> Path:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    out = REPORTS_DIR / "dataset_index.json"
    out.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    return out


def class_distribution(entries: list[Entry]) -> Counter:
    return Counter((e.source_split, e.binary) for e in entries)
