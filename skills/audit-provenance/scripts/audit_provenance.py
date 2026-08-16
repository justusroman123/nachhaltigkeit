#!/usr/bin/env python3
"""
Audit image provenance using C2PA (Coalition for Content Provenance and Authenticity).

Wraps c2patool to extract and display provenance manifests, validate signatures,
and apply trust-anchor verification against a supplied PEM file.

Usage:
    python3 audit_provenance.py <image> --c2patool <path> [--trust-anchors <pem>]
    python3 audit_provenance.py <image> --c2patool <path> --output json
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit image provenance using C2PA tooling",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  %(prog)s image.png --c2patool ./c2patool --trust-anchors policy.pem\n"
            "  %(prog)s photo.jpg --c2patool /usr/local/bin/c2patool --output json\n"
        ),
    )
    parser.add_argument("image", help="Image file to audit")
    parser.add_argument(
        "--c2patool",
        required=True,
        metavar="PATH",
        help="Path to the c2patool binary",
    )
    parser.add_argument(
        "--trust-anchors",
        metavar="PEM",
        help="PEM file containing trusted root CA certificates for signature verification",
    )
    parser.add_argument(
        "--output",
        choices=["text", "json"],
        default="text",
        help="Output format (default: text)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Include full assertion data in text output",
    )
    return parser.parse_args()


def validate_inputs(args: argparse.Namespace) -> list[str]:
    errors = []
    if not Path(args.image).is_file():
        errors.append(f"Image file not found: {args.image}")
    if not Path(args.c2patool).is_file():
        errors.append(f"c2patool binary not found: {args.c2patool}")
    elif not os.access(args.c2patool, os.X_OK):
        errors.append(f"c2patool is not executable: {args.c2patool}")
    if args.trust_anchors and not Path(args.trust_anchors).is_file():
        errors.append(f"Trust anchors file not found: {args.trust_anchors}")
    return errors


def run_c2patool(
    c2patool: str,
    image: str,
    trust_anchors: str | None,
) -> tuple[int, str, str]:
    cmd = [c2patool, image]
    if trust_anchors:
        cmd += ["--trust_anchors", trust_anchors]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60,
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "c2patool timed out after 60 seconds"
    except OSError as exc:
        return -1, "", f"Failed to execute c2patool: {exc}"


def _is_validation_failure(code: str) -> bool:
    lower = code.lower()
    return "invalid" in lower or "error" in lower or "fail" in lower


def format_text_report(
    image: str,
    manifest_store: dict | None,
    returncode: int,
    stderr: str,
    verbose: bool,
) -> str:
    sep = "=" * 62
    lines = [sep, "C2PA PROVENANCE AUDIT REPORT", sep, f"File: {image}", ""]

    if returncode != 0 or manifest_store is None:
        lines += ["STATUS: ERROR", f"c2patool exited with code {returncode}."]
        if stderr.strip():
            lines.append(stderr.strip())
        lines.append(sep)
        return "\n".join(lines)

    manifests: dict = manifest_store.get("manifests", {})
    if not manifests:
        lines += [
            "STATUS: NO PROVENANCE DATA",
            "No C2PA manifest found in this image.",
            sep,
        ]
        return "\n".join(lines)

    active_label: str | None = manifest_store.get("active_manifest")
    lines += [
        f"Manifests found : {len(manifests)}",
        f"Active manifest : {active_label or 'N/A'}",
        "",
    ]

    any_failure = False

    for label, manifest in manifests.items():
        is_active = label == active_label
        prefix = "[ACTIVE] " if is_active else ""
        lines.append(f"{prefix}Manifest: {label}")
        lines.append("-" * 50)

        for key, display in (
            ("title", "Title"),
            ("claim_generator", "Generator"),
            ("format", "Format"),
        ):
            val = manifest.get(key, "")
            if val:
                lines.append(f"  {display:<12}: {val}")

        sig = manifest.get("signature_info", {})
        if sig:
            lines.append("  Signature:")
            for key, display in (
                ("issuer", "Issuer"),
                ("cert_serial_number", "Serial"),
                ("time", "Time"),
                ("alg", "Algorithm"),
            ):
                val = sig.get(key, "")
                if val:
                    lines.append(f"    {display:<12}: {val}")

        statuses: list[dict] = manifest.get("validation_status", [])
        if statuses:
            lines.append("  Validation:")
            for status in statuses:
                code = status.get("code", "")
                explanation = status.get("explanation", "")
                if _is_validation_failure(code):
                    any_failure = True
                    tag = "FAIL"
                else:
                    tag = "PASS"
                lines.append(f"    [{tag}] {code}")
                if explanation:
                    lines.append(f"           {explanation}")

        assertions: list[dict] = manifest.get("assertions", [])
        if assertions:
            lines.append(f"  Assertions ({len(assertions)}):")
            for assertion in assertions:
                alabel = assertion.get("label", "unknown")
                data = assertion.get("data", {})
                lines.append(f"    - {alabel}")
                if verbose and data:
                    for dl in json.dumps(data, indent=6).splitlines():
                        lines.append(f"      {dl}")

        ingredients: list[dict] = manifest.get("ingredients", [])
        if ingredients:
            lines.append(f"  Ingredients ({len(ingredients)}):")
            for ing in ingredients:
                title = ing.get("title", "unknown")
                fmt = ing.get("format", "")
                rel = ing.get("relationship", "")
                lines.append(f"    - {title}  {fmt}  [{rel}]")

        lines.append("")

    lines.append(sep)
    if any_failure:
        lines.append("VERDICT: PROVENANCE PRESENT — VALIDATION ISSUES DETECTED")
    elif active_label:
        lines.append("VERDICT: PROVENANCE VERIFIED")
    else:
        lines.append("VERDICT: PROVENANCE PRESENT (no active manifest designated)")
    lines.append(sep)

    return "\n".join(lines)


def main() -> None:
    args = parse_args()

    errors = validate_inputs(args)
    if errors:
        for err in errors:
            print(f"ERROR: {err}", file=sys.stderr)
        sys.exit(1)

    print(f"Auditing: {args.image}", file=sys.stderr)

    returncode, stdout, stderr = run_c2patool(
        args.c2patool,
        args.image,
        args.trust_anchors,
    )

    manifest_store: dict | None = None
    if stdout.strip():
        try:
            manifest_store = json.loads(stdout)
        except json.JSONDecodeError:
            pass

    if args.output == "json":
        if manifest_store is not None:
            print(json.dumps(manifest_store, indent=2))
        else:
            print(
                json.dumps(
                    {"error": stderr.strip() or "No output from c2patool", "returncode": returncode}
                )
            )
    else:
        print(format_text_report(args.image, manifest_store, returncode, stderr, args.verbose))

    # Exit codes:
    #   0  – provenance found and all validations pass
    #   1  – tool error or no manifest found
    #   2  – manifest found but validation issues detected
    if returncode != 0 or manifest_store is None:
        sys.exit(1)

    manifests: dict = manifest_store.get("manifests", {})
    any_failure = any(
        _is_validation_failure(s.get("code", ""))
        for m in manifests.values()
        for s in m.get("validation_status", [])
    )
    sys.exit(2 if any_failure else 0)


if __name__ == "__main__":
    main()
