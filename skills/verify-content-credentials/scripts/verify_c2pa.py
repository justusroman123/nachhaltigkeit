#!/usr/bin/env python3
"""
Verify C2PA Content Credentials embedded in an image file.

Attempts verification in two ways:
  1. If c2patool is on PATH (or passed via --c2patool), delegates to it for
     full cryptographic signature verification.
  2. Falls back to structural inspection of the raw JUMBF/manifest bytes to
     confirm presence and report claim metadata without signature verification.

Usage:
    python3 verify_c2pa.py <image>
    python3 verify_c2pa.py <image> --c2patool /path/to/c2patool
    python3 verify_c2pa.py <image> --output json
"""

import argparse
import json
import shutil
import struct
import subprocess
import sys
from pathlib import Path


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Verify C2PA Content Credentials in an image")
    p.add_argument("image", help="Image file to verify")
    p.add_argument("--c2patool", metavar="PATH",
                   help="Path to c2patool binary (auto-detected from PATH if omitted)")
    p.add_argument("--trust-anchors", metavar="PEM",
                   help="PEM file with trusted root CAs")
    p.add_argument("--output", choices=["text", "json"], default="text")
    return p.parse_args()


# ---------------------------------------------------------------------------
# c2patool integration
# ---------------------------------------------------------------------------

def _find_c2patool(hint: str | None) -> str | None:
    if hint:
        return hint if Path(hint).is_file() else None
    return shutil.which("c2patool")


def _run_c2patool(binary: str, image: str, trust_anchors: str | None) -> dict:
    cmd = [binary, image]
    if trust_anchors:
        cmd += ["--trust_anchors", trust_anchors]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        manifest_store = None
        if r.stdout.strip():
            try:
                manifest_store = json.loads(r.stdout)
            except json.JSONDecodeError:
                pass
        return {
            "method": "c2patool",
            "returncode": r.returncode,
            "manifest_store": manifest_store,
            "stderr": r.stderr.strip(),
        }
    except subprocess.TimeoutExpired:
        return {"method": "c2patool", "returncode": -1, "manifest_store": None,
                "stderr": "timed out"}
    except OSError as exc:
        return {"method": "c2patool", "returncode": -1, "manifest_store": None,
                "stderr": str(exc)}


# ---------------------------------------------------------------------------
# Structural / raw detection (fallback)
# ---------------------------------------------------------------------------

_JUMBF_TYPE = b"jumb"
_JUMD_TYPE = b"jumd"


def _jumbf_boxes(data: bytes) -> list[dict]:
    boxes = []
    offset = 0
    while offset < len(data) - 8:
        pos = data.find(_JUMBF_TYPE, offset)
        if pos < 4:
            break
        start = pos - 4
        length = struct.unpack(">I", data[start : start + 4])[0]
        if length < 8 or start + length > len(data):
            offset = pos + 4
            continue
        payload = data[start + 8 : start + length]
        label = ""
        if len(payload) >= 24 and payload[4:8] == _JUMD_TYPE:
            end = payload.find(b"\x00", 24)
            if end != -1:
                label = payload[24:end].decode("ascii", errors="replace")
        boxes.append({"offset": start, "length": length, "label": label})
        offset = pos + 4
    return boxes


def _jpeg_app11_offsets(data: bytes) -> list[int]:
    if not data[:2] == b"\xff\xd8":
        return []
    offsets, i = [], 2
    while i < len(data) - 4:
        if data[i] != 0xFF:
            break
        if data[i + 1] == 0xEB:
            offsets.append(i)
        seg_len = struct.unpack(">H", data[i + 2 : i + 4])[0]
        i += 2 + seg_len
    return offsets


def _structural_check(image: str) -> dict:
    data = Path(image).read_bytes()
    boxes = _jumbf_boxes(data)
    app11 = _jpeg_app11_offsets(data)
    c2pa_labels = [b for b in boxes if "c2pa" in b["label"].lower() or b["label"] == ""]
    return {
        "method": "structural",
        "jumbf_boxes": boxes,
        "c2pa_boxes": c2pa_labels,
        "jpeg_app11_segments": app11,
        "has_c2pa": bool(boxes) or bool(app11),
    }


# ---------------------------------------------------------------------------
# Verdict helpers
# ---------------------------------------------------------------------------

def _manifest_verdict(manifest_store: dict | None) -> str:
    if not manifest_store:
        return "NO_MANIFEST"
    manifests = manifest_store.get("manifests", {})
    if not manifests:
        return "EMPTY_MANIFEST_STORE"
    failures = [
        s
        for m in manifests.values()
        for s in m.get("validation_status", [])
        if any(w in s.get("code", "").lower() for w in ("invalid", "error", "fail"))
    ]
    return "VALIDATION_FAILED" if failures else "VERIFIED"


# ---------------------------------------------------------------------------
# Text report
# ---------------------------------------------------------------------------

def _render_text(image: str, result: dict) -> str:
    sep = "=" * 62
    lines = [sep, "C2PA CONTENT CREDENTIALS VERIFICATION", sep, f"File: {image}", ""]

    method = result.get("method")

    if method == "c2patool":
        rc = result["returncode"]
        ms = result["manifest_store"]
        verdict = _manifest_verdict(ms)
        lines.append(f"Method  : c2patool (full cryptographic verification)")
        lines.append(f"Verdict : {verdict}")
        lines.append("")

        if rc != 0:
            lines.append(f"c2patool exited {rc}: {result['stderr']}")
        elif ms is None:
            lines.append("No C2PA manifest data returned.")
        else:
            active = ms.get("active_manifest")
            manifests = ms.get("manifests", {})
            lines.append(f"Active manifest : {active or 'N/A'}")
            lines.append(f"Total manifests : {len(manifests)}")
            for label, m in manifests.items():
                is_active = label == active
                lines.append("")
                lines.append(f"  {'[ACTIVE] ' if is_active else ''}Manifest: {label}")
                for field in ("title", "claim_generator", "format"):
                    val = m.get(field, "")
                    if val:
                        lines.append(f"    {field:<20}: {val}")
                sig = m.get("signature_info", {})
                if sig:
                    lines.append("    Signature:")
                    for k, label_ in (
                        ("issuer", "Issuer"),
                        ("cert_serial_number", "Serial"),
                        ("time", "Time"),
                        ("alg", "Algorithm"),
                    ):
                        if sig.get(k):
                            lines.append(f"      {label_:<12}: {sig[k]}")
                for s in m.get("validation_status", []):
                    code = s.get("code", "")
                    tag = "FAIL" if any(w in code.lower() for w in ("invalid", "error", "fail")) else "PASS"
                    lines.append(f"    [{tag}] {code}")
                    if s.get("explanation"):
                        lines.append(f"           {s['explanation']}")
    else:
        # Structural only
        struct_result = result
        lines.append("Method  : structural (no c2patool — signature NOT verified)")
        has = struct_result.get("has_c2pa", False)
        lines.append(f"Verdict : {'C2PA_STRUCTURE_PRESENT' if has else 'NO_C2PA_DETECTED'}")
        lines.append("")
        lines.append(f"  JUMBF boxes      : {len(struct_result.get('jumbf_boxes', []))}")
        lines.append(f"  C2PA boxes       : {len(struct_result.get('c2pa_boxes', []))}")
        lines.append(f"  JPEG APP11 segs  : {len(struct_result.get('jpeg_app11_segments', []))}")
        if not has:
            lines.append("")
            lines.append("  No C2PA markers found. The file may lack Content Credentials.")

    lines += ["", sep]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    args = parse_args()

    if not Path(args.image).is_file():
        print(f"ERROR: File not found: {args.image}", file=sys.stderr)
        sys.exit(1)

    binary = _find_c2patool(args.c2patool)

    if binary:
        print(f"Using c2patool: {binary}", file=sys.stderr)
        result = _run_c2patool(binary, args.image, args.trust_anchors)
    else:
        print("c2patool not found — falling back to structural inspection.", file=sys.stderr)
        result = _structural_check(args.image)

    if args.output == "json":
        print(json.dumps(result, indent=2))
    else:
        print(_render_text(args.image, result))

    # Exit codes: 0=verified, 1=error/no manifest, 2=validation failed
    method = result.get("method")
    if method == "c2patool":
        verdict = _manifest_verdict(result.get("manifest_store"))
        if verdict == "VERIFIED":
            sys.exit(0)
        elif verdict == "VALIDATION_FAILED":
            sys.exit(2)
        else:
            sys.exit(1)
    else:
        sys.exit(0 if result.get("has_c2pa") else 1)


if __name__ == "__main__":
    main()
