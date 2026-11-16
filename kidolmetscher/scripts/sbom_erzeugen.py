#!/usr/bin/env python3
"""Erzeugt eine Abhängigkeits- und Lizenzliste (SBOM-Light) aus den INSTALLIERTEN Python-Paketen.

Nur Python-Standardbibliothek. Liest ausschließlich die Paket-Metadaten (importlib.metadata); nichts wird geraten:
fehlt eine Lizenzangabe in den Metadaten, steht "unbekannt". Auf dem Server mit dem Python der Anwendung ausführen:
  /root/kidolmetscher/.venv/bin/python scripts/sbom_erzeugen.py [--format md|csv|json] [> datei]
Gibt NICHT aus: Betriebssystempakete (dafür: dpkg-query -W), Modellgewichte (siehe docs/lizenzen-recherche.md), NVIDIA-Treiber.
Hinweis: Die Metadaten-Angabe ist die Selbstauskunft des Pakets, keine rechtliche Prüfung.
"""
import argparse, csv, importlib.metadata as md, json, re, sys


def lizenz(m):
    expr = (m.get("License-Expression") or "").strip()
    feld = re.sub(r"\s+", " ", (m.get("License") or "")).strip()
    cls = [c.split("::")[-1].strip() for c in (m.get_all("Classifier") or []) if c.startswith("License ::")]
    if expr:
        return expr, "License-Expression"
    if feld and len(feld) <= 120:
        return feld, "License"
    if cls:
        return ", ".join(cls), "Classifier"
    if feld:
        return feld[:117] + "...", "License (gekürzt)"
    return "unbekannt", "-"


def eintraege():
    out = []
    for d in md.distributions():
        m = d.metadata
        name = m.get("Name")
        if not name:
            continue
        lic, quelle = lizenz(m)
        home = m.get("Home-page") or ""
        if not home:
            for u in m.get_all("Project-URL") or []:
                if u.lower().startswith(("homepage", "source", "repository")):
                    home = u.split(",", 1)[-1].strip()
                    break
        out.append({"name": name, "version": d.version, "lizenz": lic, "lizenzquelle": quelle, "adresse": home})
    return sorted(out, key=lambda r: r["name"].lower())


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--format", choices=["md", "csv", "json"], default="md")
    a = ap.parse_args()
    rows = eintraege()
    if a.format == "json":
        json.dump(rows, sys.stdout, ensure_ascii=False, indent=1)
    elif a.format == "csv":
        w = csv.DictWriter(sys.stdout, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    else:
        print("| Paket | Version | Lizenz (Selbstauskunft) | Quelle der Angabe |\n| --- | --- | --- | --- |")
        for r in rows:
            print("| %s | %s | %s | %s |" % (r["name"], r["version"], r["lizenz"].replace("|", "/"), r["lizenzquelle"]))
        copyleft = [r["name"] for r in rows if re.search(r"GPL|AGPL|LGPL|MPL|EUPL|CC-BY-NC|Proprietary", r["lizenz"], re.I)]
        unb = [r["name"] for r in rows if r["lizenz"] == "unbekannt"]
        print("\n%d Pakete. Mit Copyleft-, Schwach-Copyleft- oder proprietärer Angabe (prüfen): %s." % (len(rows), ", ".join(copyleft) or "keine"))
        print("Ohne Lizenzangabe in den Metadaten: %s." % (", ".join(unb) or "keine"))


if __name__ == "__main__":
    main()
