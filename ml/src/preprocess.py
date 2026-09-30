"""Preprocessing (P3.3): grayscale→3ch, constant border pad, INTER_CUBIC resize to S×S."""
from __future__ import annotations

import cv2
import numpy as np


def prepare(img: np.ndarray, pad_frac: float = 0.25, size: int = 256) -> np.ndarray:
    """Return an RGB uint8 (size, size, 3) image.

    `img` may be grayscale (H, W), grayscale-with-channels (H, W, 1) or BGR/RGB (H, W, 3).
    A constant black border of pad_frac*size pixels is added before the upscale so faces
    hugging the frame edge still centre-detect.
    """
    if img.ndim == 3 and img.shape[2] == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    elif img.ndim == 3 and img.shape[2] == 1:
        gray = img[:, :, 0]
    else:
        gray = img
    pad = round(pad_frac * size)
    padded = cv2.copyMakeBorder(gray, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0)
    resized = cv2.resize(padded, (size, size), interpolation=cv2.INTER_CUBIC)
    return cv2.cvtColor(resized, cv2.COLOR_GRAY2RGB)
