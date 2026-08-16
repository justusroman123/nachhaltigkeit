#!/usr/bin/env python3
"""
Audit image metadata for privacy-sensitive fields.

Examines EXIF, XMP, and IPTC data to flag information that could reveal
the photographer's identity, location, device, or organisation.

Pillow is used when available for richer EXIF parsing; falls back to a
lightweight raw-bytes pass for GPS and XMP.

Usage:
    python3 audit_metadata.py <image>
    python3 audit_metadata.py <image> --output json
    python3 audit_metadata.py <image> --strip-plan   # show what would be stripped
"""

import argparse
import json
import re
import struct
import sys
from dataclasses import dataclass, field
from pathlib import Path


# ---------------------------------------------------------------------------
# Risk levels
# ---------------------------------------------------------------------------

HIGH = "HIGH"
MEDIUM = "MEDIUM"
LOW = "LOW"
INFO = "INFO"

_RISK_ORDER = {HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3}


@dataclass
class Finding:
    field: str
    value: str
    risk: str
    reason: str


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Audit image metadata for privacy risks")
    p.add_argument("image", help="Image file to audit")
    p.add_argument("--output", choices=["text", "json"], default="text")
    p.add_argument("--strip-plan", action="store_true",
                   help="List metadata fields that should be stripped for privacy")
    return p.parse_args()


# ---------------------------------------------------------------------------
# EXIF via Pillow
# ---------------------------------------------------------------------------

_SENSITIVE_EXIF: dict[str, tuple[str, str]] = {
    # tag name → (risk, reason)
    "GPSInfo":              (HIGH,   "GPS coordinates can reveal exact shooting location"),
    "MakerNote":            (MEDIUM, "Manufacturer-specific data may include serial/GPS/scene info"),
    "CameraSerialNumber":   (MEDIUM, "Links photos to a specific physical device"),
    "BodySerialNumber":     (MEDIUM, "Links photos to a specific physical device"),
    "LensSerialNumber":     (LOW,    "Links photos to a specific lens"),
    "Artist":               (MEDIUM, "Contains photographer name"),
    "Copyright":            (MEDIUM, "May contain author name or organisation"),
    "ImageDescription":     (LOW,    "Free-text description may include personal details"),
    "UserComment":          (LOW,    "Free-text field may include personal details"),
    "XPAuthor":             (MEDIUM, "Windows author tag contains name"),
    "XPComment":            (LOW,    "Free-text comment"),
    "XPKeywords":           (INFO,   "Keyword metadata"),
    "Software":             (LOW,    "Reveals editing software and version"),
    "HostComputer":         (MEDIUM, "Hostname of editing machine"),
    "DateTime":             (INFO,   "File modification timestamp"),
    "DateTimeOriginal":     (INFO,   "Capture timestamp"),
    "DateTimeDigitized":    (INFO,   "Digitisation timestamp"),
    "SubSecTimeOriginal":   (INFO,   "Sub-second capture time"),
    "FlashPixVersion":      (INFO,   "FlashPix version"),
    "InteroperabilityIndex":(INFO,   "Interoperability tag"),
    "RelatedSoundFile":     (LOW,    "Path to related sound file"),
    "ImageUniqueID":        (MEDIUM, "Unique image identifier can link images to a camera"),
}


def _exif_findings(path: str) -> list[Finding]:
    try:
        from PIL import Image
        from PIL.ExifTags import TAGS
    except ImportError:
        return []

    findings = []
    try:
        with Image.open(path) as img:
            exif_data = img._getexif()  # type: ignore[attr-defined]
            if not exif_data:
                return []
            for tag_id, value in exif_data.items():
                tag_name = TAGS.get(tag_id, str(tag_id))
                if tag_name in _SENSITIVE_EXIF:
                    risk, reason = _SENSITIVE_EXIF[tag_name]
                    display = str(value)[:300]
                    findings.append(Finding(
                        field=f"EXIF/{tag_name}",
                        value=display,
                        risk=risk,
                        reason=reason,
                    ))
    except Exception:
        pass
    return findings


# ---------------------------------------------------------------------------
# GPS from raw EXIF bytes (fallback for when Pillow can't decode GPS)
# ---------------------------------------------------------------------------

def _gps_from_raw(data: bytes) -> Finding | None:
    # Look for GPS IFD marker in raw EXIF – heuristic
    gps_patterns = [
        b"\x00\x88",  # GPS IFD tag 0x8825
        b"GPS",
    ]
    for pat in gps_patterns:
        if pat in data:
            return Finding(
                field="EXIF/GPS (raw)",
                value="GPS-related bytes found in raw EXIF data",
                risk=HIGH,
                reason="GPS coordinates can reveal exact shooting location",
            )
    return None


# ---------------------------------------------------------------------------
# XMP privacy fields
# ---------------------------------------------------------------------------

_XMP_PRIVACY_PATTERNS: list[tuple[str, str, str, str]] = [
    # (xml tag, risk, reason, regex)
    ("dc:creator",             MEDIUM, "Author name embedded in XMP",
     r"<dc:creator[^>]*>.*?<rdf:li[^>]*>(.*?)</rdf:li>"),
    ("photoshop:AuthorsPosition", LOW, "Job title embedded",
     r"<photoshop:AuthorsPosition[^>]*>(.*?)</photoshop:AuthorsPosition>"),
    ("photoshop:Credit",       LOW,    "Credit line may contain name",
     r"<photoshop:Credit[^>]*>(.*?)</photoshop:Credit>"),
    ("photoshop:City",         MEDIUM, "City of capture embedded",
     r"<photoshop:City[^>]*>(.*?)</photoshop:City>"),
    ("photoshop:State",        LOW,    "State/province of capture",
     r"<photoshop:State[^>]*>(.*?)</photoshop:State>"),
    ("photoshop:Country",      LOW,    "Country of capture",
     r"<photoshop:Country[^>]*>(.*?)</photoshop:Country>"),
    ("Iptc4xmpCore:Location",  HIGH,   "Sub-location from IPTC Core",
     r"<Iptc4xmpCore:Location[^>]*>(.*?)</Iptc4xmpCore:Location>"),
    ("xmp:CreatorTool",        LOW,    "Editing software revealed",
     r"<xmp:CreatorTool[^>]*>(.*?)</xmp:CreatorTool>"),
    ("xmpRights:Owner",        MEDIUM, "Rights owner may contain real name",
     r"<xmpRights:Owner[^>]*>.*?<rdf:li[^>]*>(.*?)</rdf:li>"),
    ("xmp:CreateDate",         INFO,   "Original creation date",
     r"<xmp:CreateDate[^>]*>(.*?)</xmp:CreateDate>"),
    ("xmp:MetadataDate",       INFO,   "Metadata last-modified date",
     r"<xmp:MetadataDate[^>]*>(.*?)</xmp:MetadataDate>"),
]


def _xmp_findings(data: bytes) -> list[Finding]:
    xmp_start = data.find(b"<?xpacket begin=")
    if xmp_start == -1:
        return []
    xmp_end = data.find(b"?>", data.find(b"<?xpacket end=", xmp_start))
    xmp_raw = data[xmp_start : xmp_end + 2].decode("utf-8", errors="replace")

    findings = []
    for tag, risk, reason, pattern in _XMP_PRIVACY_PATTERNS:
        m = re.search(pattern, xmp_raw, re.DOTALL)
        if m:
            val = m.group(1).strip()[:200]
            if val:
                findings.append(Finding(field=f"XMP/{tag}", value=val, risk=risk, reason=reason))
    return findings


# ---------------------------------------------------------------------------
# Thumbnail check
# ---------------------------------------------------------------------------

def _thumbnail_findings(path: str) -> list[Finding]:
    try:
        from PIL import Image
    except ImportError:
        return []
    findings = []
    try:
        with Image.open(path) as img:
            if hasattr(img, "appdata"):
                pass
            # Pillow exposes thumbnail data via info dict in some cases
            if img.info.get("thumbnail"):
                findings.append(Finding(
                    field="EXIF/Thumbnail",
                    value="Embedded JPEG thumbnail present",
                    risk=MEDIUM,
                    reason=(
                        "Thumbnail may retain metadata or show content "
                        "cropped from the full image"
                    ),
                ))
    except Exception:
        pass
    return findings


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def _score(findings: list[Finding]) -> tuple[str, int]:
    counts = {HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0}
    for f in findings:
        counts[f.risk] = counts.get(f.risk, 0) + 1
    score = counts[HIGH] * 10 + counts[MEDIUM] * 3 + counts[LOW] * 1
    if counts[HIGH] > 0 or score >= 15:
        return "HIGH", score
    elif counts[MEDIUM] > 0 or score >= 5:
        return "MEDIUM", score
    elif counts[LOW] > 0 or score >= 1:
        return "LOW", score
    return "CLEAN", score


# ---------------------------------------------------------------------------
# Text report
# ---------------------------------------------------------------------------

_RISK_ICON = {HIGH: "[HIGH]  ", MEDIUM: "[MED]   ", LOW: "[LOW]   ", INFO: "[INFO]  "}


def _render_text(image: str, findings: list[Finding], strip_plan: bool) -> str:
    sep = "=" * 64
    lines = [sep, "METADATA PRIVACY AUDIT", sep, f"File: {image}", ""]

    if not findings:
        lines += ["No privacy-sensitive metadata detected.", "", sep]
        return "\n".join(lines)

    overall, score = _score(findings)
    lines.append(f"Overall risk : {overall}  (score {score})")
    lines.append(f"Findings     : {len(findings)}")
    lines.append("")

    by_risk = sorted(findings, key=lambda f: _RISK_ORDER.get(f.risk, 99))
    for f in by_risk:
        lines.append(f"  {_RISK_ICON[f.risk]}{f.field}")
        lines.append(f"           Value : {f.value[:120]}")
        lines.append(f"           Why   : {f.reason}")
        lines.append("")

    if strip_plan:
        lines.append("── Strip Plan ──────────────────────────────────────────")
        lines.append("Fields to remove before publishing:")
        for f in by_risk:
            if f.risk in (HIGH, MEDIUM):
                lines.append(f"  exiftool -overwrite_original -{f.field.split('/')[-1]}= <file>")
        lines.append("  exiftool -overwrite_original -all= <file>  # strip everything")
        lines.append("")

    lines.append(sep)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    args = parse_args()

    if not Path(args.image).is_file():
        print(f"ERROR: File not found: {args.image}", file=sys.stderr)
        sys.exit(1)

    data = Path(args.image).read_bytes()

    findings: list[Finding] = []
    findings += _exif_findings(args.image)
    findings += _xmp_findings(data)
    findings += _thumbnail_findings(args.image)

    # Raw GPS fallback when Pillow didn't produce a GPSInfo finding
    if not any(f.field == "EXIF/GPSInfo" for f in findings):
        gps = _gps_from_raw(data)
        if gps:
            findings.append(gps)

    overall, score = _score(findings)

    if args.output == "json":
        print(json.dumps({
            "file": args.image,
            "overall_risk": overall,
            "score": score,
            "findings": [
                {"field": f.field, "value": f.value, "risk": f.risk, "reason": f.reason}
                for f in findings
            ],
        }, indent=2))
    else:
        print(_render_text(args.image, findings, args.strip_plan))

    sys.exit(0 if overall == "CLEAN" else 1)


if __name__ == "__main__":
    main()
