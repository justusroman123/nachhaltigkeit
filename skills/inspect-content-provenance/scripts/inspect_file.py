#!/usr/bin/env python3
"""
Inspect content provenance embedded in an image file.

Reads EXIF, XMP, IPTC, ICC colour profile, and detects C2PA JUMBF markers.
No external binaries required; Pillow is used when available for richer EXIF.

Usage:
    python3 inspect_file.py <image>
    python3 inspect_file.py <image> --output json
"""

import argparse
import json
import re
import struct
import sys
from pathlib import Path


# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Inspect content provenance of an image file")
    p.add_argument("image", help="Image file to inspect")
    p.add_argument("--output", choices=["text", "json"], default="text")
    return p.parse_args()


# ---------------------------------------------------------------------------
# Low-level helpers
# ---------------------------------------------------------------------------

def _read_bytes(path: str) -> bytes:
    return Path(path).read_bytes()


def _detect_format(data: bytes) -> str:
    signatures = {
        b"\xff\xd8\xff": "JPEG",
        b"\x89PNG\r\n\x1a\n": "PNG",
        b"RIFF": "WEBP",
        b"II*\x00": "TIFF (little-endian)",
        b"MM\x00*": "TIFF (big-endian)",
        b"ftyp": "HEIF/HEIC (MP4-based)",
        b"\x00\x00\x00\x0cftyp": "HEIF/HEIC",
        b"GIF87a": "GIF87",
        b"GIF89a": "GIF89",
        b"%PDF": "PDF",
    }
    for sig, fmt in signatures.items():
        if data[: len(sig)] == sig or (fmt.startswith("HEIF") and sig in data[:16]):
            return fmt
    return "Unknown"


# ---------------------------------------------------------------------------
# XMP
# ---------------------------------------------------------------------------

_XMP_START = b"<?xpacket begin="
_XMP_END = b"<?xpacket end="


def _extract_xmp(data: bytes) -> str | None:
    start = data.find(_XMP_START)
    if start == -1:
        return None
    end = data.find(b"?>", data.find(_XMP_END, start))
    if end == -1:
        return data[start : start + 65536].decode("utf-8", errors="replace")
    return data[start : end + 2].decode("utf-8", errors="replace")


def _parse_xmp_fields(xmp: str) -> dict:
    fields: dict = {}
    for tag in (
        "dc:creator", "dc:rights", "dc:title", "dc:description",
        "xmp:CreateDate", "xmp:ModifyDate", "xmp:CreatorTool",
        "photoshop:Credit", "photoshop:Source",
        "Iptc4xmpCore:CreatorContactInfo",
        "c2pa:claim_generator", "c2pa:manifest",
    ):
        ns, _, local = tag.partition(":")
        patterns = [
            rf"<{re.escape(tag)}>([^<]+)</{re.escape(tag)}>",
            rf'{re.escape(tag)}="([^"]+)"',
        ]
        for pat in patterns:
            m = re.search(pat, xmp)
            if m:
                fields[tag] = m.group(1).strip()
                break
    return fields


# ---------------------------------------------------------------------------
# C2PA / JUMBF detection
# ---------------------------------------------------------------------------

_JUMBF_BOX_TYPE = b"jumb"
_JUMD_BOX_TYPE = b"jumd"
_C2PA_UUID = bytes.fromhex("d8fec3d61b0e4e17910d2fa8264dab30")  # C2PA manifest store UUID


def _find_jumbf(data: bytes) -> list[dict]:
    results = []
    offset = 0
    while offset < len(data) - 8:
        pos = data.find(_JUMBF_BOX_TYPE, offset)
        if pos < 4:
            break
        box_start = pos - 4
        box_len = struct.unpack(">I", data[box_start : box_start + 4])[0]
        if box_len < 8 or box_start + box_len > len(data):
            offset = pos + 4
            continue
        payload = data[box_start + 8 : box_start + box_len]
        label = ""
        if len(payload) >= 20 and payload[:4] == _JUMD_BOX_TYPE[:-1] + b"d":
            label_end = payload.find(b"\x00", 24)
            if label_end != -1:
                label = payload[24:label_end].decode("ascii", errors="replace")
        results.append({"offset": box_start, "length": box_len, "label": label})
        offset = pos + 4
    return results


def _detect_c2pa_app11(data: bytes) -> list[int]:
    """Return offsets of JPEG APP11 (0xFFEB) segments, which carry JUMBF in C2PA."""
    offsets = []
    if not data.startswith(b"\xff\xd8"):
        return offsets
    i = 2
    while i < len(data) - 4:
        if data[i] != 0xFF:
            break
        marker = data[i + 1]
        if marker == 0xEB:
            offsets.append(i)
        seg_len = struct.unpack(">H", data[i + 2 : i + 4])[0]
        i += 2 + seg_len
    return offsets


# ---------------------------------------------------------------------------
# EXIF (Pillow-based with stdlib fallback)
# ---------------------------------------------------------------------------

def _exif_via_pillow(path: str) -> dict:
    try:
        from PIL import Image
        from PIL.ExifTags import TAGS
    except ImportError:
        return {}

    try:
        with Image.open(path) as img:
            exif_data = img._getexif()  # type: ignore[attr-defined]
            if not exif_data:
                return {}
            return {TAGS.get(k, str(k)): str(v)[:200] for k, v in exif_data.items()}
    except Exception:
        return {}


def _image_info_via_pillow(path: str) -> dict:
    try:
        from PIL import Image
    except ImportError:
        return {}
    try:
        with Image.open(path) as img:
            return {
                "mode": img.mode,
                "size": f"{img.width}×{img.height}",
                "format": img.format or "?",
            }
    except Exception:
        return {}


# ---------------------------------------------------------------------------
# ICC colour profile
# ---------------------------------------------------------------------------

_ICC_MARKER = b"ICC_PROFILE\x00"


def _detect_icc(data: bytes) -> str | None:
    pos = data.find(_ICC_MARKER)
    if pos == -1:
        return None
    # Profile description tag starts at a known offset in ICC data
    icc_start = pos + len(_ICC_MARKER) + 2  # skip chunk index bytes in JPEG
    # Try to read description from ICC profile header
    if icc_start + 132 < len(data):
        desc_raw = data[icc_start + 128 : icc_start + 132]
        return f"ICC profile detected at offset {pos}"
    return "ICC profile detected"


# ---------------------------------------------------------------------------
# Report rendering
# ---------------------------------------------------------------------------

def _sep(n: int = 62) -> str:
    return "=" * n


def render_text(info: dict) -> str:
    lines = [_sep(), "CONTENT PROVENANCE INSPECTION REPORT", _sep()]
    lines.append(f"File   : {info['file']}")
    lines.append(f"Size   : {info['size_bytes']:,} bytes")
    lines.append(f"Format : {info['format']}")
    if info.get("image_info"):
        ii = info["image_info"]
        lines.append(f"Image  : {ii.get('size', '?')}  mode={ii.get('mode', '?')}")
    lines.append("")

    # C2PA
    c2pa = info.get("c2pa", {})
    lines.append("── C2PA / JUMBF ──────────────────────────────────────")
    if c2pa.get("app11_segments"):
        lines.append(f"  JPEG APP11 segments : {len(c2pa['app11_segments'])} (C2PA carrier)")
    if c2pa.get("jumbf_boxes"):
        for box in c2pa["jumbf_boxes"]:
            lines.append(f"  JUMBF box @ {box['offset']}  len={box['length']}  label={box['label'] or '(none)'}")
    if not c2pa.get("app11_segments") and not c2pa.get("jumbf_boxes"):
        lines.append("  No C2PA / JUMBF data detected")

    # XMP
    lines.append("")
    lines.append("── XMP ───────────────────────────────────────────────")
    xmp_fields = info.get("xmp_fields", {})
    if xmp_fields:
        for k, v in xmp_fields.items():
            lines.append(f"  {k:<35} {v}")
    elif info.get("xmp_present"):
        lines.append("  XMP packet present but no recognised fields extracted")
    else:
        lines.append("  No XMP packet found")

    # EXIF
    lines.append("")
    lines.append("── EXIF ──────────────────────────────────────────────")
    exif = info.get("exif", {})
    if exif:
        priority = [
            "Make", "Model", "Software", "DateTime", "DateTimeOriginal",
            "Artist", "Copyright", "GPSInfo", "ImageDescription",
        ]
        shown = set()
        for key in priority:
            if key in exif:
                lines.append(f"  {key:<30} {exif[key]}")
                shown.add(key)
        remaining = {k: v for k, v in exif.items() if k not in shown}
        if remaining:
            lines.append(f"  … {len(remaining)} additional EXIF tags")
    else:
        lines.append("  No EXIF data found (or Pillow not installed)")

    # ICC
    lines.append("")
    lines.append("── ICC Colour Profile ────────────────────────────────")
    lines.append(f"  {info.get('icc') or 'Not detected'}")

    lines += ["", _sep()]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    args = parse_args()
    path = args.image

    if not Path(path).is_file():
        print(f"ERROR: File not found: {path}", file=sys.stderr)
        sys.exit(1)

    data = _read_bytes(path)
    fmt = _detect_format(data)
    xmp_raw = _extract_xmp(data)

    info: dict = {
        "file": path,
        "size_bytes": len(data),
        "format": fmt,
        "image_info": _image_info_via_pillow(path),
        "c2pa": {
            "app11_segments": _detect_c2pa_app11(data),
            "jumbf_boxes": _find_jumbf(data),
        },
        "xmp_present": xmp_raw is not None,
        "xmp_fields": _parse_xmp_fields(xmp_raw) if xmp_raw else {},
        "exif": _exif_via_pillow(path),
        "icc": _detect_icc(data),
    }

    if args.output == "json":
        print(json.dumps(info, indent=2))
    else:
        print(render_text(info))


if __name__ == "__main__":
    main()
