# Real-World Scale Photography Testing Guide

This guide establishes the standardized testing protocol for digital weighing scale photographs captured in jewellery workshops and retail counters.

---

## 1. Core Operating Philosophy: Witness, Not Oracle

- **The Scale Photo is Evidence, Not Sole Authority**: The photograph provides transparent visual witness of what the weighing scale display read at transaction time. Both jeweller and karigar can view this photograph.
- **Strict Abstention Over Fabrication**: If a photo is blurry, tilted, corrupted by glare, or partially occluded, the OCR engine **must return `UNREADABLE` (`None`)**. It must **never** guess or hallucinate digits.
- **Deterministic Decimal Precision**: Scale weights are represented exclusively with Python's `Decimal` type to avoid IEEE 754 floating-point rounding errors. Comparison status is either `MATCH` ($\le \pm 0.01\,\text{g}$ tolerance), `MISMATCH`, or `UNREADABLE`.

---

## 2. Workshop Photography Protocol

To maximize OCR read rate while operating under real workshop lighting conditions:

| Parameter | Recommended Standard | Why it Matters |
| :--- | :--- | :--- |
| **Distance** | 15 cm to 30 cm | Ensures the 7-segment display fills at least 40% of the frame width. |
| **Angle** | Direct perpendicular ($0^\circ$) to slight tilt ($< 10^\circ$) | Extreme angles ($> 20^\circ$) distort segment geometry. |
| **Flash** | **Turn OFF camera flash** | Smartphone flash causes intense specular glare blobs on glass/acrylic scale shields. |
| **Ambient Light** | Diffuse overhead lighting | Eliminates harsh shadows across individual LED/LCD segment segments. |
| **Display Cleanliness** | Wipe glass of dust/oil | Fine gold polishing dust or finger grease can merge adjacent digits. |

---

## 3. Testing Real Photographs with the CLI Tool

We provide a dedicated CLI verification tool: `scripts/test_scale_image.py`.

### Basic Reading
To test OCR extraction on a scale image:
```bash
python scripts/test_scale_image.py path/to/scale_photo.jpg
```

### Verification Against Expected/Entered Weight
To test comparison against the gold weight entered in the ledger:
```bash
python scripts/test_scale_image.py path/to/scale_photo.jpg --expected 50.00 --tolerance 0.01
```

### Output Interpretation
- **`MATCH`**: The OCR reading matches the entered weight within the specified tolerance. Mutual verification is expedited.
- **`MISMATCH`**: The scale display shows a different reading than entered. The system automatically prompts for mutual review before commitment.
- **`UNREADABLE`**: The photograph does not pass confidence or clarity thresholds. The photo is preserved in the audit log, but human parties must manually confirm the weight.

---

## 4. Benchmark Test Matrix & Synthetic Suite

The automated test suite evaluates:
1. **Clean LED Displays**: Bright green or red 7-segment displays on dark backgrounds.
2. **Reflective LCD Displays**: Dark charcoal segments on light grey reflective backgrounds.
3. **Severe Glare Invariance**: Overexposed specular reflection blocks the display $\rightarrow$ **100% abstention rate** (0 false positives).
4. **Resolution Range**: Evaluated from $300\times120$ up to $4000\times3000$ (automatically normalized).

Run the automated evaluation benchmark anytime:
```bash
python -c "from ai_engine.evaluation.ocr_eval import run_ocr_eval; import pprint; pprint.pprint(run_ocr_eval())"
```
