#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


LABEL_TO_RULE = {
    "child sexual exploitation": "R1",
    "human trafficking or exploitation": "R6",
    "self harm or suicide": "R5",
    "bullying or harassment": "R4",
    "privacy or personal data risk": "R9",
    "weapons or severe physical harm": "R13",
    "hate or discrimination": "R8",
    "age inappropriate sexual or graphic content": "R7",
}

LABELS = ["safe benign request", *LABEL_TO_RULE.keys()]


def main():
    parser = argparse.ArgumentParser(
        description="Extract local Hugging Face zero-shot signals for Safe Haven hybrid evaluation."
    )
    parser.add_argument("--input", default="data/beavertails-30k-test.jsonl")
    parser.add_argument("--output", default="reports/beavertails-hf-signals.jsonl")
    parser.add_argument("--sample", type=int, default=200)
    parser.add_argument(
        "--model",
        default="MoritzLaurer/deberta-v3-base-zeroshot-v1.1-all-33",
    )
    parser.add_argument("--threshold", type=float, default=0.45)
    parser.add_argument("--max-signals", type=int, default=3)
    parser.add_argument(
        "--text",
        choices=["prompt", "prompt_response"],
        default="prompt",
    )
    args = parser.parse_args()

    try:
        from transformers import pipeline
    except ImportError as exc:
        raise SystemExit(
            "Missing dependency: transformers. Install local deps with: "
            "python3 -m pip install transformers torch"
        ) from exc

    rows = read_jsonl(Path(args.input))[: args.sample]
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    classifier = pipeline("zero-shot-classification", model=args.model)

    with output_path.open("w", encoding="utf-8") as handle:
        for index, row in enumerate(rows):
            text = build_text(row, args.text)
            result = classifier(text, LABELS, multi_label=True)
            signals = []

            for label, score in zip(result["labels"], result["scores"]):
                if label == "safe benign request" or score < args.threshold:
                    continue

                rule_id = LABEL_TO_RULE[label]
                signals.append(
                    {
                        "ruleId": rule_id,
                        "label": label,
                        "confidence": float(score),
                        "evidence": text[:180],
                        "rationale": f"Local Hugging Face zero-shot classifier mapped the prompt to {label}.",
                    }
                )

                if len(signals) >= args.max_signals:
                    break

            handle.write(json.dumps({"index": index, "signals": signals}) + "\n")

    print(f"Wrote local HF signals for {len(rows)} rows to {output_path}")


def read_jsonl(path):
    with path.open("r", encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def build_text(row, mode):
    if mode == "prompt_response":
        return f"{row.get('prompt', '')}\n\nResponse:\n{row.get('response', '')}".strip()
    return row.get("prompt", "")


if __name__ == "__main__":
    main()
