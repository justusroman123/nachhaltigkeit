#!/usr/bin/env python3
"""
Check an AI transparency record JSON file for completeness and schema conformance.

Validates that the record contains expected fields describing the AI model,
training data, inference context, and usage rights, then reports any gaps
or anomalies.

Usage:
    python3 check_transparency.py <record.json>
    python3 check_transparency.py <record.json> --output json
    python3 check_transparency.py <record.json> --schema custom-schema.json
"""

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path


# ---------------------------------------------------------------------------
# Schema definition
# ---------------------------------------------------------------------------

@dataclass
class FieldSpec:
    path: str               # dot-notation key path, e.g. "model.name"
    required: bool
    type_: type | None      # expected Python type, None = any
    description: str
    example: str = ""


# Default schema for an AI transparency record
_DEFAULT_SCHEMA: list[FieldSpec] = [
    # Identity
    FieldSpec("model.name",          True,  str,  "AI model name", "DALL-E 3"),
    FieldSpec("model.version",        True,  str,  "Model version or checkpoint", "3.0"),
    FieldSpec("model.provider",       True,  str,  "Organisation that trained the model", "OpenAI"),
    FieldSpec("model.type",           True,  str,  "Model architecture type", "diffusion"),
    FieldSpec("model.modalities",     False, list, "Supported I/O modalities", '["text","image"]'),
    FieldSpec("model.documentation_url", False, str, "Link to model card / docs", "https://..."),

    # Training
    FieldSpec("training.dataset",     True,  str,  "Name of training dataset(s)", "LAION-5B"),
    FieldSpec("training.cutoff_date", True,  str,  "Knowledge/training data cutoff (ISO 8601)", "2023-04-01"),
    FieldSpec("training.license",     False, str,  "Training data license", "CC-BY 4.0"),
    FieldSpec("training.filtered",    False, bool, "Whether harmful content was filtered"),
    FieldSpec("training.data_sources_url", False, str, "Link to data sources description"),

    # Inference / generation event
    FieldSpec("inference.date",       True,  str,  "ISO 8601 date/time of generation", "2024-06-01T12:00:00Z"),
    FieldSpec("inference.prompt_hash",False, str,  "Hash of the prompt used (for auditability)"),
    FieldSpec("inference.temperature",False, (int, float), "Sampling temperature if applicable"),
    FieldSpec("inference.seed",       False, (int, str), "Reproducibility seed"),
    FieldSpec("inference.service_url",False, str,  "API endpoint used"),

    # Output
    FieldSpec("output.type",          True,  str,  "Output type: image/text/audio/video", "image"),
    FieldSpec("output.format",        False, str,  "MIME type or file format", "image/png"),
    FieldSpec("output.description",   False, str,  "Human-readable description of output"),

    # Usage rights
    FieldSpec("rights.usage_allowed", True,  bool, "Whether output is cleared for use"),
    FieldSpec("rights.restrictions",  False, list, "List of applicable restrictions"),
    FieldSpec("rights.attribution_required", False, bool, "Whether attribution must be given"),
    FieldSpec("rights.license",       False, str,  "License governing output", "CC0"),
    FieldSpec("rights.jurisdiction",  False, str,  "Applicable jurisdiction(s)"),

    # Human review
    FieldSpec("review.human_reviewed",True,  bool, "Whether a human reviewed the output"),
    FieldSpec("review.reviewer_role", False, str,  "Role of the human reviewer"),
    FieldSpec("review.review_date",   False, str,  "ISO 8601 review date"),
    FieldSpec("review.approved",      False, bool, "Final approval status"),

    # Disclosure
    FieldSpec("disclosure.ai_generated_label", True, bool,
              "Whether the output is labelled as AI-generated"),
    FieldSpec("disclosure.watermarked", False, bool, "Whether the output carries a watermark"),
    FieldSpec("disclosure.c2pa_manifest", False, bool, "Whether a C2PA manifest is attached"),
]


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Check an AI transparency record for completeness")
    p.add_argument("record", help="Path to the transparency record JSON file")
    p.add_argument("--output", choices=["text", "json"], default="text")
    p.add_argument("--schema", metavar="JSON",
                   help="Custom schema file (list of FieldSpec dicts)")
    return p.parse_args()


# ---------------------------------------------------------------------------
# Key-path helpers
# ---------------------------------------------------------------------------

def _get(doc: dict, path: str):
    """Traverse dot-notation path; return (value, found)."""
    keys = path.split(".")
    cur = doc
    for k in keys:
        if not isinstance(cur, dict) or k not in cur:
            return None, False
        cur = cur[k]
    return cur, True


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

@dataclass
class Issue:
    path: str
    severity: str   # ERROR | WARNING | INFO
    message: str


def _validate(doc: dict, schema: list[FieldSpec]) -> list[Issue]:
    issues: list[Issue] = []

    for spec in schema:
        value, found = _get(doc, spec.path)

        if not found:
            sev = "ERROR" if spec.required else "WARNING"
            issues.append(Issue(spec.path, sev, f"Missing field ({spec.description})"))
            continue

        if value is None:
            issues.append(Issue(spec.path, "WARNING", "Field present but value is null"))
            continue

        # Type check
        if spec.type_ is not None:
            expected = spec.type_ if isinstance(spec.type_, tuple) else (spec.type_,)
            if not isinstance(value, expected):
                issues.append(Issue(
                    spec.path, "WARNING",
                    f"Expected {' or '.join(t.__name__ for t in expected)}, "
                    f"got {type(value).__name__}",
                ))

        # Date format check
        if "date" in spec.path.lower() and isinstance(value, str):
            try:
                datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                issues.append(Issue(spec.path, "WARNING",
                                    f"Value '{value}' does not look like ISO 8601"))

        # Non-empty string check
        if isinstance(value, str) and not value.strip():
            issues.append(Issue(spec.path, "WARNING", "Field is an empty string"))

    return issues


def _load_custom_schema(path: str) -> list[FieldSpec]:
    raw = json.loads(Path(path).read_text())
    specs = []
    for item in raw:
        specs.append(FieldSpec(
            path=item["path"],
            required=item.get("required", False),
            type_=None,
            description=item.get("description", ""),
            example=item.get("example", ""),
        ))
    return specs


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def _score(issues: list[Issue], schema: list[FieldSpec]) -> dict:
    errors = [i for i in issues if i.severity == "ERROR"]
    warnings = [i for i in issues if i.severity == "WARNING"]
    total = len(schema)
    present = total - len(errors)
    completeness = round(100 * present / total) if total else 100
    return {
        "errors": len(errors),
        "warnings": len(warnings),
        "total_fields": total,
        "completeness_pct": completeness,
        "grade": "PASS" if not errors else "FAIL",
    }


# ---------------------------------------------------------------------------
# Text report
# ---------------------------------------------------------------------------

def _render_text(record_path: str, doc: dict, issues: list[Issue], scoring: dict) -> str:
    sep = "=" * 64
    lines = [sep, "AI TRANSPARENCY RECORD CHECK", sep, f"File     : {record_path}"]

    # Top-level summary from record
    model_name = _get(doc, "model.name")[0] or "?"
    provider = _get(doc, "model.provider")[0] or "?"
    inf_date = _get(doc, "inference.date")[0] or "?"
    lines += [
        f"Model    : {model_name}  ({provider})",
        f"Generated: {inf_date}",
        "",
        f"Grade         : {scoring['grade']}",
        f"Completeness  : {scoring['completeness_pct']}%  "
        f"({scoring['total_fields'] - scoring['errors']}/{scoring['total_fields']} fields)",
        f"Errors        : {scoring['errors']}",
        f"Warnings      : {scoring['warnings']}",
        "",
    ]

    if not issues:
        lines.append("All required fields present and correctly typed.")
    else:
        icon = {"ERROR": "✗", "WARNING": "△", "INFO": "·"}
        for sev in ("ERROR", "WARNING", "INFO"):

            group = [i for i in issues if i.severity == sev]
            if group:
                lines.append(f"── {sev}S ({'─' * (52 - len(sev))})")
                for iss in group:
                    lines.append(f"  {icon[sev]} {iss.path}")
                    lines.append(f"      {iss.message}")
                lines.append("")

    lines.append(sep)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    args = parse_args()

    if not Path(args.record).is_file():
        print(f"ERROR: File not found: {args.record}", file=sys.stderr)
        sys.exit(1)

    try:
        doc = json.loads(Path(args.record).read_text())
    except json.JSONDecodeError as exc:
        print(f"ERROR: Invalid JSON — {exc}", file=sys.stderr)
        sys.exit(1)

    schema = _load_custom_schema(args.schema) if args.schema else _DEFAULT_SCHEMA

    issues = _validate(doc, schema)
    scoring = _score(issues, schema)

    if args.output == "json":
        print(json.dumps({
            "file": args.record,
            "scoring": scoring,
            "issues": [{"path": i.path, "severity": i.severity, "message": i.message}
                       for i in issues],
        }, indent=2))
    else:
        print(_render_text(args.record, doc, issues, scoring))

    sys.exit(0 if scoring["grade"] == "PASS" else 1)


if __name__ == "__main__":
    main()
