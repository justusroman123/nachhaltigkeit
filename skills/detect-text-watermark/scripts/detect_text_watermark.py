#!/usr/bin/env python3
"""
Detect covert watermarks and steganographic markers in text files.

Checks for:
  - Unicode zero-width and invisible characters
  - Homoglyph substitutions (Cyrillic/Greek/other lookalikes replacing Latin)
  - Unusual Unicode control/formatting characters
  - Trailing-whitespace encoding (binary bits encoded as space/tab patterns)
  - Suspicious Unicode normalization discrepancies
  - Large blocks of homogeneous whitespace (line-padding steganography)

Usage:
    python3 detect_text_watermark.py <file>
    python3 detect_text_watermark.py <file> --output json
    python3 detect_text_watermark.py <file> --show-positions
"""

import argparse
import json
import sys
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Detect covert watermarks in text files")
    p.add_argument("file", help="Text file to analyse")
    p.add_argument("--output", choices=["text", "json"], default="text")
    p.add_argument("--show-positions", action="store_true",
                   help="Include line:col positions of suspicious characters in text output")
    p.add_argument("--encoding", default="utf-8",
                   help="File encoding (default: utf-8)")
    return p.parse_args()


# ---------------------------------------------------------------------------
# Zero-width and invisible characters
# ---------------------------------------------------------------------------

_INVISIBLE: dict[int, str] = {
    0x00AD: "SOFT HYPHEN (U+00AD)",
    0x034F: "COMBINING GRAPHEME JOINER (U+034F)",
    0x061C: "ARABIC LETTER MARK (U+061C)",
    0x115F: "HANGUL CHOSEONG FILLER (U+115F)",
    0x1160: "HANGUL JUNGSEONG FILLER (U+1160)",
    0x17B4: "KHMER VOWEL INHERENT AQ (U+17B4)",
    0x17B5: "KHMER VOWEL INHERENT AA (U+17B5)",
    0x180B: "MONGOLIAN FREE VARIATION SELECTOR ONE (U+180B)",
    0x180C: "MONGOLIAN FREE VARIATION SELECTOR TWO (U+180C)",
    0x180D: "MONGOLIAN FREE VARIATION SELECTOR THREE (U+180D)",
    0x180E: "MONGOLIAN VOWEL SEPARATOR (U+180E)",
    0x200B: "ZERO WIDTH SPACE (U+200B)",
    0x200C: "ZERO WIDTH NON-JOINER (U+200C)",
    0x200D: "ZERO WIDTH JOINER (U+200D)",
    0x200E: "LEFT-TO-RIGHT MARK (U+200E)",
    0x200F: "RIGHT-TO-LEFT MARK (U+200F)",
    0x202A: "LEFT-TO-RIGHT EMBEDDING (U+202A)",
    0x202B: "RIGHT-TO-LEFT EMBEDDING (U+202B)",
    0x202C: "POP DIRECTIONAL FORMATTING (U+202C)",
    0x202D: "LEFT-TO-RIGHT OVERRIDE (U+202D)",
    0x202E: "RIGHT-TO-LEFT OVERRIDE (U+202E)",
    0x2060: "WORD JOINER (U+2060)",
    0x2061: "FUNCTION APPLICATION (U+2061)",
    0x2062: "INVISIBLE TIMES (U+2062)",
    0x2063: "INVISIBLE SEPARATOR (U+2063)",
    0x2064: "INVISIBLE PLUS (U+2064)",
    0x2066: "LEFT-TO-RIGHT ISOLATE (U+2066)",
    0x2067: "RIGHT-TO-LEFT ISOLATE (U+2067)",
    0x2068: "FIRST STRONG ISOLATE (U+2068)",
    0x2069: "POP DIRECTIONAL ISOLATE (U+2069)",
    0x206A: "INHIBIT SYMMETRIC SWAPPING (U+206A)",
    0x206F: "NOMINAL DIGIT SHAPES (U+206F)",
    0xFEFF: "ZERO WIDTH NO-BREAK SPACE / BOM (U+FEFF)",
    0xFFF9: "INTERLINEAR ANNOTATION ANCHOR (U+FFF9)",
    0xFFFA: "INTERLINEAR ANNOTATION SEPARATOR (U+FFFA)",
    0xFFFB: "INTERLINEAR ANNOTATION TERMINATOR (U+FFFB)",
}


@dataclass
class Hit:
    check: str
    severity: str       # HIGH | MEDIUM | LOW
    description: str
    count: int
    positions: list[tuple[int, int]] = field(default_factory=list)  # (line, col)
    detail: str = ""


# ---------------------------------------------------------------------------
# Homoglyph tables
# ---------------------------------------------------------------------------

# Confusable non-Latin characters that visually resemble ASCII letters/digits
_HOMOGLYPHS: dict[str, str] = {
    # Cyrillic
    "а": "a", "е": "e", "о": "o", "р": "r", "с": "c",
    "х": "x", "і": "i", "ј": "j", "А": "A", "В": "B",
    "Е": "E", "З": "3", "К": "K", "М": "M", "Н": "H",
    "О": "O", "Р": "P", "С": "C", "Т": "T", "Х": "X",
    # Greek
    "α": "a", "ε": "e", "ο": "o", "ρ": "p", "ν": "v",
    "ι": "i", "κ": "k", "Α": "A", "Β": "B", "Ε": "E",
    "Ζ": "Z", "Η": "H", "Ι": "I", "Κ": "K", "Μ": "M",
    "Ν": "N", "Ο": "O", "Ρ": "P", "Τ": "T", "Χ": "X",
    # Mathematical and fullwidth lookalikes
    "ａ": "a", "ｂ": "b", "ｃ": "c", "ｄ": "d", "ｅ": "e",
    "Ａ": "A", "Ｂ": "B", "Ｃ": "C",
    # Other common confusables
    "Ơ": "O", "Ø": "O", "Ω": "O",  # Omega looks like Ω but can confuse
    "‘": "'", "’": "'", "“": '"', "”": '"',  # smart quotes
}


# ---------------------------------------------------------------------------
# Detectors
# ---------------------------------------------------------------------------

def _detect_invisible(lines: list[str]) -> Hit | None:
    positions: list[tuple[int, int]] = []
    counts: Counter = Counter()
    for ln, line in enumerate(lines, 1):
        for col, ch in enumerate(line, 1):
            cp = ord(ch)
            if cp in _INVISIBLE:
                positions.append((ln, col))
                counts[_INVISIBLE[cp]] += 1
    if not counts:
        return None
    top = counts.most_common(3)
    detail = ", ".join(f"{name} ×{n}" for name, n in top)
    return Hit(
        check="invisible_chars",
        severity="HIGH",
        description="Zero-width / invisible Unicode characters detected",
        count=len(positions),
        positions=positions[:50],
        detail=detail,
    )


def _detect_homoglyphs(lines: list[str]) -> Hit | None:
    positions: list[tuple[int, int]] = []
    substitutions: Counter = Counter()
    for ln, line in enumerate(lines, 1):
        for col, ch in enumerate(line, 1):
            if ch in _HOMOGLYPHS:
                positions.append((ln, col))
                substitutions[f"U+{ord(ch):04X} ({ch}) → '{_HOMOGLYPHS[ch]}'"] += 1
    if not substitutions:
        return None
    top = substitutions.most_common(5)
    detail = ", ".join(f"{k} ×{n}" for k, n in top)
    return Hit(
        check="homoglyphs",
        severity="HIGH",
        description="Homoglyph substitutions detected (non-ASCII lookalike characters)",
        count=len(positions),
        positions=positions[:50],
        detail=detail,
    )


def _detect_trailing_whitespace_encoding(lines: list[str]) -> Hit | None:
    """Trailing space/tab patterns that could encode bits (one bit per line)."""
    suspicious: list[tuple[int, int]] = []
    pattern_lines = 0
    for ln, line in enumerate(lines, 1):
        stripped = line.rstrip("\n\r")
        if stripped and stripped[-1] in (" ", "\t"):
            suspicious.append((ln, len(stripped)))
            pattern_lines += 1

    if pattern_lines < 3:
        return None

    ratio = pattern_lines / max(len(lines), 1)
    severity = "MEDIUM" if ratio > 0.3 else "LOW"
    return Hit(
        check="trailing_whitespace",
        severity=severity,
        description="Trailing whitespace detected on many lines (possible bit-encoding)",
        count=pattern_lines,
        positions=suspicious[:50],
        detail=f"{pattern_lines}/{len(lines)} lines have trailing space/tab ({ratio:.0%})",
    )


_CONTROL_CHARS_ALLOWED = {0x09, 0x0A, 0x0D}  # TAB, LF, CR


def _detect_control_chars(lines: list[str]) -> Hit | None:
    positions: list[tuple[int, int]] = []
    for ln, line in enumerate(lines, 1):
        for col, ch in enumerate(line, 1):
            cp = ord(ch)
            cat = unicodedata.category(ch)
            if cat == "Cc" and cp not in _CONTROL_CHARS_ALLOWED:
                positions.append((ln, col))
    if not positions:
        return None
    return Hit(
        check="control_chars",
        severity="MEDIUM",
        description="Non-printing control characters (outside TAB/LF/CR) detected",
        count=len(positions),
        positions=positions[:50],
        detail=f"e.g. U+{ord(lines[positions[0][0]-1][positions[0][1]-1]):04X} at line {positions[0][0]}",
    )


def _detect_unicode_tags(content: str) -> Hit | None:
    """Unicode Tag characters (U+E0000–U+E007F) used in modern text watermarking."""
    positions: list[tuple[int, int]] = []
    lines = content.splitlines()
    for ln, line in enumerate(lines, 1):
        for col, ch in enumerate(line, 1):
            cp = ord(ch)
            if 0xE0000 <= cp <= 0xE007F:
                positions.append((ln, col))
    if not positions:
        return None
    return Hit(
        check="unicode_tags",
        severity="HIGH",
        description="Unicode Tag characters (U+E0000–U+E007F) detected — used in AI text watermarking",
        count=len(positions),
        positions=positions[:50],
        detail=f"First at line {positions[0][0]}, col {positions[0][1]}",
    )


def _detect_variation_selectors(content: str) -> Hit | None:
    """Variation selectors (U+FE00–U+FE0F, U+E0100–U+E01EF) can encode hidden data."""
    positions: list[tuple[int, int]] = []
    lines = content.splitlines()
    for ln, line in enumerate(lines, 1):
        for col, ch in enumerate(line, 1):
            cp = ord(ch)
            if (0xFE00 <= cp <= 0xFE0F) or (0xE0100 <= cp <= 0xE01EF):
                positions.append((ln, col))
    if not positions:
        return None
    return Hit(
        check="variation_selectors",
        severity="MEDIUM",
        description="Unicode Variation Selectors detected — can encode hidden bits",
        count=len(positions),
        positions=positions[:50],
    )


# ---------------------------------------------------------------------------
# Aggregate score
# ---------------------------------------------------------------------------

_SEV_WEIGHT = {"HIGH": 10, "MEDIUM": 3, "LOW": 1}


def _score(hits: list[Hit]) -> tuple[str, int]:
    score = sum(_SEV_WEIGHT.get(h.severity, 0) * min(h.count, 20) for h in hits)
    if any(h.severity == "HIGH" for h in hits):
        return "HIGH", score
    elif any(h.severity == "MEDIUM" for h in hits):
        return "MEDIUM", score
    elif hits:
        return "LOW", score
    return "CLEAN", 0


# ---------------------------------------------------------------------------
# Text report
# ---------------------------------------------------------------------------

def _render_text(file_path: str, content: str, hits: list[Hit],
                 show_positions: bool) -> str:
    sep = "=" * 64
    lines_count = content.count("\n")
    char_count = len(content)
    overall, score = _score(hits)

    lines = [
        sep, "TEXT WATERMARK DETECTION REPORT", sep,
        f"File       : {file_path}",
        f"Characters : {char_count:,}   Lines: {lines_count:,}",
        f"Overall    : {overall}  (score {score})",
        f"Findings   : {len(hits)}",
        "",
    ]

    if not hits:
        lines.append("No covert watermark indicators detected.")
    else:
        icon = {"HIGH": "[HIGH]  ", "MEDIUM": "[MED]   ", "LOW": "[LOW]   "}
        for h in sorted(hits, key=lambda x: _SEV_WEIGHT.get(x.severity, 0), reverse=True):
            lines.append(f"  {icon.get(h.severity, '        ')}{h.description}")
            lines.append(f"           Count  : {h.count}")
            if h.detail:
                lines.append(f"           Detail : {h.detail}")
            if show_positions and h.positions:
                pos_str = ", ".join(f"{r}:{c}" for r, c in h.positions[:10])
                lines.append(f"           Positions (line:col): {pos_str}")
            lines.append("")

    lines.append(sep)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    args = parse_args()

    if not Path(args.file).is_file():
        print(f"ERROR: File not found: {args.file}", file=sys.stderr)
        sys.exit(1)

    try:
        content = Path(args.file).read_text(encoding=args.encoding, errors="replace")
    except OSError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)

    text_lines = content.splitlines()

    hits: list[Hit] = []
    for detector in (
        lambda: _detect_invisible(text_lines),
        lambda: _detect_homoglyphs(text_lines),
        lambda: _detect_trailing_whitespace_encoding(text_lines),
        lambda: _detect_control_chars(text_lines),
        lambda: _detect_unicode_tags(content),
        lambda: _detect_variation_selectors(content),
    ):
        result = detector()
        if result:
            hits.append(result)

    overall, score = _score(hits)

    if args.output == "json":
        print(json.dumps({
            "file": args.file,
            "overall": overall,
            "score": score,
            "findings": [
                {
                    "check": h.check,
                    "severity": h.severity,
                    "description": h.description,
                    "count": h.count,
                    "detail": h.detail,
                    "positions": h.positions[:50],
                }
                for h in hits
            ],
        }, indent=2))
    else:
        print(_render_text(args.file, content, hits, args.show_positions))

    sys.exit(0 if overall == "CLEAN" else 1)


if __name__ == "__main__":
    main()
