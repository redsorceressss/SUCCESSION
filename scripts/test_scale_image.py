"""CLI utility for evaluating real-world scale photographs against entered weights."""

import argparse
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ai_engine.ocr.read_display import read_display
from ai_engine.ocr.compare import compare_weights
from ai_engine.ocr.preprocess import detect_glare

def main():
    parser = argparse.ArgumentParser(description="Test real-world scale photo OCR reading and comparison.")
    parser.add_argument("image_path", help="Path to scale photo file (.jpg, .jpeg, .png, .webp)")
    parser.add_argument("--expected", "-e", required=False, help="Expected/entered gold weight in grams (e.g. 50.00)")
    parser.add_argument("--tolerance", "-t", default="0.01", help="Acceptable tolerance band in grams (default: 0.01)")

    args = parser.parse_args()
    img_path = Path(args.image_path)
    if not img_path.exists():
        print(f"Error: Image file not found: {img_path}", file=sys.stderr)
        sys.exit(1)

    print("==================================================")
    print(" SCALE PHOTO WITNESS OCR VERIFICATION BENCHMARK   ")
    print("==================================================")
    print(f"Target Image:      {img_path.name}")
    print(f"Absolute Path:     {img_path.resolve()}")

    reading = read_display(str(img_path))

    print("\n--- OCR Reading Results ---")
    print(f"Status:            {reading.status}")
    print(f"Detected Weight:   {reading.value if reading.value is not None else 'None (UNREADABLE)'}")
    print(f"Raw Extracted:     '{reading.raw}'")
    print(f"Confidence Score:  {reading.confidence}")
    print(f"Extraction Method: {reading.method}")

    if args.expected:
        try:
            expected_wt = Decimal(args.expected)
            tol = Decimal(args.tolerance)
            match_status = compare_weights(reading.value, expected_wt, tolerance=tol)
            print("\n--- Comparison Against Witnessed Weight ---")
            print(f"Entered Weight:    {expected_wt} g")
            print(f"Tolerance Band:    +/- {tol} g")
            print(f"Comparison Result: {match_status}")
            if match_status == "MISMATCH" and reading.value is not None:
                delta = abs(reading.value - expected_wt)
                print(f"Discrepancy Delta: {delta} g (Triggers dispute/clarification review)")
            elif match_status == "UNREADABLE":
                print("Advice: Photo quality insufficient. Fall back to manual scale photo confirmation.")
        except InvalidOperation:
            print(f"Error: Invalid Decimal representation for expected weight '{args.expected}'", file=sys.stderr)

    print("==================================================")

if __name__ == "__main__":
    main()
