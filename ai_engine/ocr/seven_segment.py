"""Decode a seven-segment display with classic computer vision (no machine learning).
Idea: find the lit segments (the minority colour), split the picture into digit columns, then for each
digit check which of the 7 segment positions are lit and look the pattern up in a table.
Works on: a straight, well-framed photo of the display (frame it so it fills the picture).
Fails on: heavy glare, strong tilt, italic/slanted digits, multi-line displays. Then returns None (UNREADABLE).
"""

import cv2
import numpy as np

PATTERNS = {
    "abcdef": "0", "bc": "1", "abged": "2", "abgcd": "3", "fgbc": "4",
    "afgcd": "5", "afgedc": "6", "abc": "7", "abcdefg": "8", "abcdfg": "9"
}
PATTERNS = {"".join(sorted(k)): v for k, v in PATTERNS.items()}

def foreground_mask(img_bgr: np.ndarray) -> np.ndarray:
    """255 where a segment is lit. We assume the lit/dark segments cover LESS area than the background."""
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    if np.count_nonzero(binary) > binary.size / 2:
        binary = cv2.bitwise_not(binary)
    # remove specks
    return cv2.morphologyEx(binary, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))

def _runs(profile: np.ndarray, min_gap: int) -> list[tuple[int, int]]:
    """Contiguous runs of non-zero columns, merging runs separated by less than min_gap."""
    on = np.flatnonzero(profile)
    if on.size == 0:
        return []
    runs, start, prev = [], on[0], on[0]
    for x in on[1:]:
        if x - prev > min_gap:
            runs.append((start, prev))
            start = x
        prev = x
    runs.append((start, prev))
    return runs

def _digit(box: np.ndarray) -> str | None:
    h, w = box.shape
    def lit(y0, y1, x0, x1):
        region = box[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)]
        return region.size > 0 and np.count_nonzero(region) / region.size > 0.45

    probes = {
        "a": (0.0, 0.16, 0.2, 0.8),
        "g": (0.42, 0.58, 0.2, 0.8),
        "d": (0.84, 1.0, 0.2, 0.8),
        "f": (0.12, 0.45, 0.0, 0.25),
        "b": (0.12, 0.45, 0.75, 1.0),
        "e": (0.55, 0.88, 0.0, 0.25),
        "c": (0.55, 0.88, 0.75, 1.0),
    }
    on = "".join(sorted(k for k, v in probes.items() if lit(*v)))
    return PATTERNS.get(on)

def decode(img_bgr: np.ndarray) -> str | None:
    mask = foreground_mask(img_bgr)
    ys, xs = np.nonzero(mask)
    if ys.size == 0:
        return None
    mask = mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1]  # crop to lit area
    H = mask.shape[0]
    runs = _runs((mask > 0).any(axis=0), min_gap=max(2, H // 25))
    if not runs:
        return None
    widths = [b - a + 1 for a, b in runs]
    digit_w = max(widths)
    out = []
    for (a, b), w in zip(runs, widths):
        col = mask[:, a:b + 1]
        rows = np.flatnonzero((col > 0).any(axis=1))
        if rows.size == 0:
            continue
        height = rows.max() - rows.min() + 1
        if height < 0.3 * H and rows.max() > 0.7 * H:  # short blob low down = decimal point
            out.append(".")
            continue
        if w < 0.5 * digit_w:  # a '1' is narrow: pad it to full width
            pad = np.zeros((H, digit_w), dtype=mask.dtype)
            pad[:, digit_w - w:] = col
            col = pad
        d = _digit(col)
        if d is None:
            return None  # one unreadable digit spoils the number
        out.append(d)
    text = "".join(out)
    return text if text.count(".") <= 1 and text.replace(".", "").isdigit() else None
