"""P3.2 — dataset index: label mapping, exclusions, cross-split dedupe, per-class cap."""
import hashlib

import pytest

from src.config import MAX_PER_CLASS
from src.dataset_index import build_index, write_report


def make_png(tmp_path, name: str, payload: bytes) -> str:
    path = tmp_path / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    return str(path)


def seed_dataset(tmp_path):
    dup = b"same-image-bytes"
    files = {
        "train/angry/a1.png": b"angry-1",
        "train/angry/a2.png": b"angry-2",
        "train/happy/h1.png": b"happy-1",
        "train/happy/h_dup.png": dup,
        "train/sad/s1.png": b"sad-1",
        "train/fear/f1.png": b"fear-1",
        "train/disgust/d1.png": b"disgust-1",  # excluded label
        "train/surprise/sp1.png": b"surprise-1",  # excluded label
        "test/happy/h2.png": b"happy-2",
        "test/happy/h_dup.png": dup,  # same md5 as train — must stay in train only
        "test/angry/a3.png": b"angry-3",
    }
    for name, payload in files.items():
        make_png(tmp_path, name, payload)
    return files, dup


def test_index_maps_dedupes_and_excludes(tmp_path):
    _files, dup = seed_dataset(tmp_path)
    entries, report = build_index(tmp_path)

    labels = {(e.source_split, e.binary) for e in entries}
    assert ("train", "distress") in labels and ("test", "calm") in labels
    assert all(e.binary != "excluded" for e in entries), "surprise/disgust must be dropped"

    dup_hashes = [e for e in entries if e.md5 == hashlib.md5(dup).hexdigest()]
    assert len(dup_hashes) == 1 and dup_hashes[0].source_split == "train"

    assert report["after_dedupe"]["train_distress"] == 4  # angry×2, sad, fear
    assert report["after_dedupe"]["test_calm"] == 1
    assert report["excluded_before_dedupe"] == 2
    assert report["after_sampling"]["total"] == len(entries)


def test_per_class_cap_is_seeded(tmp_path):
    for i in range(MAX_PER_CLASS + 50):
        make_png(tmp_path, f"train/angry/a{i}.png", f"angry-bytes-{i}".encode())
    make_png(tmp_path, "train/happy/h0.png", b"happy")
    entries, report = build_index(tmp_path)
    train_distress = [e for e in entries if e.source_split == "train" and e.binary == "distress"]
    assert len(train_distress) == MAX_PER_CLASS
    assert report["after_sampling"]["train_distress"] == MAX_PER_CLASS


def test_missing_dataset_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        build_index(tmp_path)


def test_report_is_writable(tmp_path):
    seed_dataset(tmp_path)
    _entries, report = build_index(tmp_path)
    out = write_report(report)
    assert out.exists() and "after_sampling" in out.read_text()
