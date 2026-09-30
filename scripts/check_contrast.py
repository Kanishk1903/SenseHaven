#!/usr/bin/env python3
"""WCAG contrast checks over design/tokens.json (File 02 §2.5; part of gate-1).

Checks exactly the documented text/background pairs. Body-text pairs must reach 4.5:1;
large text and UI-component boundaries 3:1. On failure the token must be adjusted and the
change logged in GATES_CHANGELOG.md — the bar itself is never lowered.
"""
import json
import math
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

# (fg token, bg token, bar, use) — the pairs named in File 02 §2.5 / P1.3
PAIRS = [
    ("text", "bg", 4.5, "body text on app background"),
    ("text-muted", "bg", 4.5, "secondary text"),
    ("text-subtle", "bg", 4.5, "captions"),
    ("on-primary", "primary", 4.5, "labels on primary buttons/links"),
    ("calm-fg", "calm-soft", 4.5, "calm chip text on soft fill"),
    ("neutral-fg", "neutral-soft", 4.5, "neutral chip text on soft fill"),
    ("stress-fg", "stress-soft", 4.5, "stress chip text on soft fill"),
    ("primary", "bg", 4.5, "link text"),
]


def srgb_to_linear(channel: float) -> float:
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def luminance(hex_color: str) -> float:
    value = hex_color.lstrip("#")
    r, g, b = (int(value[i : i + 2], 16) / 255 for i in (0, 2, 4))
    return (
        0.2126 * srgb_to_linear(r) + 0.7152 * srgb_to_linear(g) + 0.0722 * srgb_to_linear(b)
    )


def contrast_ratio(fg: str, bg: str) -> float:
    lighter = max(luminance(fg), luminance(bg))
    darker = min(luminance(fg), luminance(bg))
    return (lighter + 0.05) / (darker + 0.05)


def main() -> int:
    colors = json.loads((ROOT / "design" / "tokens.json").read_text())["color"]
    failed = False
    print(f"{'pair':<34} {'ratio':>6}  bar   use")
    for fg, bg, bar, use in PAIRS:
        r = contrast_ratio(colors[fg], colors[bg])
        ok = r >= bar
        failed = failed or not ok
        print(f"{fg} on {bg:<22} {r:6.2f}  {bar:<4}  {'PASS' if ok else 'FAIL'}  {use}")
    if failed:
        print("check_contrast: FAIL — adjust the token, log in GATES_CHANGELOG.md, re-run")
        return 1
    print("check_contrast: all documented pairs pass")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
