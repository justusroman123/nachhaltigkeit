#!/usr/bin/env python3
"""
Map C2PA provenance survival across image transformations.

For each derivative, runs c2patool to check whether C2PA manifests survived
the transformation, then generates an HTML report summarising survival status.

Derivative format: --derivative LABEL:TRANSFORM=PATH
  e.g. --derivative social-download:platform-roundtrip=downloaded.jpg

Usage:
    python3 map_survival.py \\
      --original original.png \\
      --derivatives-dir transformed-copies/ \\
      --derivative social-download:platform-roundtrip=downloaded.jpg \\
      --c2patool /path/to/c2patool \\
      --report survival-report.html
"""

import argparse
import html as html_mod
import json
import os
import struct
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Map C2PA provenance survival across image derivatives",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--original", required=True, metavar="FILE",
                   help="Original source image")
    p.add_argument("--derivatives-dir", metavar="DIR",
                   help="Directory of derivative files (all images scanned)")
    p.add_argument("--derivative", metavar="LABEL:TRANSFORM=PATH", action="append",
                   default=[], dest="derivatives",
                   help="Individual derivative with label and transform type")
    p.add_argument("--c2patool", required=True, metavar="PATH",
                   help="Path to the c2patool binary")
    p.add_argument("--report", default="survival-report.html", metavar="HTML",
                   help="Output HTML report path (default: survival-report.html)")
    p.add_argument("--output", choices=["html", "json", "text"], default="html")
    return p.parse_args()


# ---------------------------------------------------------------------------
# Derivative spec parsing
# ---------------------------------------------------------------------------

def _parse_derivative(spec: str) -> dict:
    """Parse 'label:transform=path' → {label, transform, path}."""
    if "=" not in spec:
        return {"label": spec, "transform": "unknown", "path": spec}
    meta, _, path = spec.rpartition("=")
    if ":" in meta:
        label, _, transform = meta.partition(":")
    else:
        label, transform = meta, "unknown"
    return {"label": label.strip(), "transform": transform.strip(), "path": path.strip()}


# ---------------------------------------------------------------------------
# C2PA probing
# ---------------------------------------------------------------------------

def _jumbf_present(path: str) -> bool:
    try:
        data = Path(path).read_bytes()
    except OSError:
        return False
    return b"jumb" in data


def _run_c2patool(binary: str, image: str) -> dict:
    try:
        r = subprocess.run([binary, image], capture_output=True, text=True, timeout=60)
        ms = None
        if r.stdout.strip():
            try:
                ms = json.loads(r.stdout)
            except json.JSONDecodeError:
                pass
        return {"returncode": r.returncode, "manifest_store": ms, "stderr": r.stderr.strip()}
    except subprocess.TimeoutExpired:
        return {"returncode": -1, "manifest_store": None, "stderr": "timeout"}
    except OSError as exc:
        return {"returncode": -1, "manifest_store": None, "stderr": str(exc)}


def _probe_file(binary: str, path: str, label: str, transform: str) -> dict:
    if not Path(path).is_file():
        return {
            "label": label, "transform": transform, "path": path,
            "exists": False, "survival": "FILE_MISSING",
            "manifest_count": 0, "active_manifest": None,
            "validation_failures": [], "raw_present": False,
        }

    raw = _jumbf_present(path)
    tool = _run_c2patool(binary, path)
    ms = tool.get("manifest_store") or {}
    manifests = ms.get("manifests", {})
    failures = [
        s.get("code", "")
        for m in manifests.values()
        for s in m.get("validation_status", [])
        if any(w in s.get("code", "").lower() for w in ("invalid", "error", "fail"))
    ]

    if not raw and not manifests:
        survival = "LOST"
    elif failures:
        survival = "DEGRADED"
    elif manifests:
        survival = "SURVIVED"
    else:
        survival = "PARTIAL"  # raw bytes present but tool couldn't parse

    return {
        "label": label,
        "transform": transform,
        "path": path,
        "exists": True,
        "survival": survival,
        "manifest_count": len(manifests),
        "active_manifest": ms.get("active_manifest"),
        "validation_failures": failures,
        "raw_present": raw,
        "file_size": Path(path).stat().st_size,
    }


# ---------------------------------------------------------------------------
# Collect derivatives
# ---------------------------------------------------------------------------

_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".tiff", ".tif", ".heic", ".heif", ".avif"}


def _collect_derivatives(args: argparse.Namespace) -> list[dict]:
    items: list[dict] = []

    for spec in args.derivatives:
        d = _parse_derivative(spec)
        items.append(d)

    if args.derivatives_dir:
        dir_path = Path(args.derivatives_dir)
        if dir_path.is_dir():
            for f in sorted(dir_path.iterdir()):
                if f.suffix.lower() in _IMAGE_SUFFIXES and f.is_file():
                    items.append({"label": f.stem, "transform": "dir-scan", "path": str(f)})

    return items


# ---------------------------------------------------------------------------
# HTML report
# ---------------------------------------------------------------------------

_SURVIVAL_COLOUR = {
    "SURVIVED": "#22c55e",
    "DEGRADED": "#f59e0b",
    "PARTIAL": "#a855f7",
    "LOST": "#ef4444",
    "FILE_MISSING": "#6b7280",
}

_CSS = """
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  margin:0;padding:2rem;background:#0f172a;color:#e2e8f0;line-height:1.6}
h1{font-size:1.5rem;margin-bottom:.25rem;color:#f8fafc}
.meta{color:#94a3b8;font-size:.875rem;margin-bottom:2rem}
table{width:100%;border-collapse:collapse;font-size:.9rem}
th{background:#1e293b;text-align:left;padding:.6rem 1rem;
   border-bottom:2px solid #334155;color:#94a3b8;font-weight:600;
   text-transform:uppercase;font-size:.75rem;letter-spacing:.05em}
td{padding:.6rem 1rem;border-bottom:1px solid #1e293b;vertical-align:top}
tr:hover td{background:#1e293b}
.badge{display:inline-block;border-radius:9999px;padding:.15rem .7rem;
  font-size:.75rem;font-weight:700;color:#fff}
.path{font-family:'SF Mono',Menlo,monospace;font-size:.8rem;color:#94a3b8}
.fail{color:#fca5a5;font-size:.8rem}
.summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));
  gap:1rem;margin-bottom:2rem}
.stat{background:#1e293b;border-radius:.5rem;padding:1rem;text-align:center}
.stat .n{font-size:2rem;font-weight:700;line-height:1}
.stat .l{font-size:.8rem;color:#94a3b8;margin-top:.25rem}
.original-row{background:#1e293b}
"""


def _badge(survival: str) -> str:
    color = _SURVIVAL_COLOUR.get(survival, "#6b7280")
    text = html_mod.escape(survival.replace("_", " "))
    return f'<span class="badge" style="background:{color}">{text}</span>'


def _build_html(original_result: dict, derivative_results: list[dict]) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    counts = {s: 0 for s in _SURVIVAL_COLOUR}
    for d in derivative_results:
        counts[d["survival"]] = counts.get(d["survival"], 0) + 1

    stat_tiles = "".join(
        f'<div class="stat"><div class="n" style="color:{_SURVIVAL_COLOUR[k]}">{counts[k]}</div>'
        f'<div class="l">{k.replace("_", " ")}</div></div>'
        for k in ("SURVIVED", "DEGRADED", "PARTIAL", "LOST", "FILE_MISSING")
    )

    def _row(r: dict, is_original: bool = False) -> str:
        label = html_mod.escape(r.get("label", ""))
        transform = html_mod.escape(r.get("transform", ""))
        path = html_mod.escape(r.get("path", ""))
        size = f"{r['file_size']:,} B" if r.get("file_size") else "—"
        manifests = str(r.get("manifest_count", "—")) if r.get("exists") else "—"
        active = html_mod.escape(r.get("active_manifest") or "—")
        failures = r.get("validation_failures", [])
        fail_html = (
            "".join(f'<div class="fail">⚠ {html_mod.escape(f)}</div>' for f in failures)
            or "—"
        )
        survival_html = (
            _badge(r["survival"]) if not is_original
            else (_badge("SURVIVED") if r.get("manifest_count", 0) > 0 else _badge("LOST"))
        )
        cls = ' class="original-row"' if is_original else ""
        return (
            f"<tr{cls}>"
            f"<td>{'<strong>ORIGINAL</strong><br>' if is_original else ''}{label}</td>"
            f"<td>{transform}</td>"
            f'<td class="path">{path}</td>'
            f"<td>{size}</td>"
            f"<td>{manifests}</td>"
            f"<td>{active}</td>"
            f"<td>{survival_html}</td>"
            f"<td>{fail_html}</td>"
            "</tr>"
        )

    rows = _row(original_result, is_original=True)
    for d in derivative_results:
        rows += _row(d)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>C2PA Provenance Survival Report</title>
<style>{_CSS}</style>
</head>
<body>
<h1>C2PA Provenance Survival Report</h1>
<div class="meta">Generated {now} &nbsp;·&nbsp; Original: {html_mod.escape(original_result['path'])}</div>
<div class="summary-grid">{stat_tiles}</div>
<table>
<thead><tr>
<th>Label</th><th>Transform</th><th>Path</th>
<th>Size</th><th>Manifests</th><th>Active Manifest</th>
<th>Survival</th><th>Issues</th>
</tr></thead>
<tbody>{rows}</tbody>
</table>
</body>
</html>"""


# ---------------------------------------------------------------------------
# Text / JSON output
# ---------------------------------------------------------------------------

def _render_text(original_result: dict, derivative_results: list[dict]) -> str:
    sep = "=" * 70
    lines = [sep, "C2PA PROVENANCE SURVIVAL MAP", sep,
             f"Original: {original_result['path']}",
             f"Manifests in original: {original_result.get('manifest_count', 0)}", ""]
    lines.append(f"{'Label':<25} {'Transform':<20} {'Survival':<15} {'Manifests'}")
    lines.append("-" * 70)
    for d in derivative_results:
        lines.append(
            f"{d['label']:<25} {d['transform']:<20} {d['survival']:<15} {d.get('manifest_count', 0)}"
        )
        if d.get("validation_failures"):
            for f in d["validation_failures"]:
                lines.append(f"  {'':25} {'':20} ISSUE: {f}")
    lines += ["", sep]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    args = parse_args()

    if not Path(args.original).is_file():
        print(f"ERROR: Original file not found: {args.original}", file=sys.stderr)
        sys.exit(1)
    if not Path(args.c2patool).is_file():
        print(f"ERROR: c2patool not found: {args.c2patool}", file=sys.stderr)
        sys.exit(1)

    print(f"Probing original: {args.original}", file=sys.stderr)
    original_result = _probe_file(args.c2patool, args.original, "original", "source")

    derivative_specs = _collect_derivatives(args)
    if not derivative_specs:
        print("WARNING: No derivatives specified.", file=sys.stderr)

    derivative_results = []
    for spec in derivative_specs:
        print(f"Probing {spec['label']}: {spec['path']}", file=sys.stderr)
        derivative_results.append(
            _probe_file(args.c2patool, spec["path"], spec["label"], spec["transform"])
        )

    if args.output == "json":
        print(json.dumps({"original": original_result, "derivatives": derivative_results}, indent=2))
    elif args.output == "text":
        print(_render_text(original_result, derivative_results))
    else:
        report_html = _build_html(original_result, derivative_results)
        Path(args.report).write_text(report_html, encoding="utf-8")
        print(f"Report written: {args.report}", file=sys.stderr)
        print(args.report)

    lost = sum(1 for d in derivative_results if d["survival"] in ("LOST", "FILE_MISSING"))
    sys.exit(0 if lost == 0 else 1)


if __name__ == "__main__":
    main()
