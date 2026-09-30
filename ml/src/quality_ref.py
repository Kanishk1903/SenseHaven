"""Quality score (LEAN §6.6): quality = min(size_score, light_score) with hard boundaries."""
from __future__ import annotations


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def size_score(face_bbox_area: float, frame_area: float) -> float:
    """0 at ratio <= 0.04, 1 at ratio >= 0.12, linear in between (exact at the boundaries)."""
    if frame_area <= 0:
        return 0.0
    ratio = face_bbox_area / frame_area
    if ratio <= 0.04:
        return 0.0
    if ratio >= 0.12:
        return 1.0
    return _clamp01((ratio - 0.04) / 0.08)


def light_score(mean_luma: float) -> float:
    """1.0 inside [40, 220], 0.3 outside (too dark or blown out)."""
    return 1.0 if 40 <= mean_luma <= 220 else 0.3


def quality(face_bbox_area: float, frame_area: float, mean_luma: float) -> float:
    return min(size_score(face_bbox_area, frame_area), light_score(mean_luma))
