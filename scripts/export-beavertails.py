#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(
        description="Export a BeaverTails split from Hugging Face datasets to JSONL."
    )
    parser.add_argument("--split", default="30k_test")
    parser.add_argument("--output", default="data/beavertails-30k-test.jsonl")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    try:
        from datasets import load_dataset
    except ImportError as exc:
        raise SystemExit(
            "Missing dependency: datasets. Install with: python3 -m pip install datasets"
        ) from exc

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    dataset = load_dataset("PKU-Alignment/BeaverTails", split=args.split)
    if args.limit is not None:
        dataset = dataset.select(range(min(args.limit, len(dataset))))

    with output_path.open("w", encoding="utf-8") as handle:
        for row in dataset:
            handle.write(
                json.dumps(
                    {
                        "prompt": row.get("prompt", ""),
                        "response": row.get("response", ""),
                        "is_safe": row.get("is_safe"),
                        "category": row.get("category", {}),
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )

    print(f"Exported {len(dataset)} rows to {output_path}")


if __name__ == "__main__":
    main()
