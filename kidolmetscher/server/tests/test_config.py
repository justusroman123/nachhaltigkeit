import pytest

from app.config import ConfigError, Settings


def env(**kw):
    return {"OPERATOR_KEY": "abcdefghij0123456789", **kw}


def test_defaults_aus_env():
    s = Settings.from_env(env())
    assert s.asr_backend == "mock" and s.target_langs == ("uk", "ar", "en", "tr", "fa")
    assert s.default_langs == ("uk", "ar", "en", "tr")           # Persisch optional, nicht vorab gewaehlt


def test_operator_key_pflicht():
    with pytest.raises(ConfigError):
        Settings.from_env({})
    with pytest.raises(ConfigError):
        Settings.from_env({"OPERATOR_KEY": "kurz"})
    Settings.from_env({}, require_operator_key=False)


def test_ungueltige_werte():
    for bad in ({"ASR_BACKEND": "gpu"}, {"TARGET_LANGS": "uk,xx"}, {"PORT": "abc"},
                {"LISTENER_TTL_S": "5"}, {"TARGET_LANGS": ""}):
        with pytest.raises(ConfigError):
            Settings.from_env(env(**bad))


def test_public_url():
    assert Settings.from_env(env(PUBLIC_URL="https://d.example.org/")).public_url == "https://d.example.org"
    assert Settings.from_env(env()).public_url == ""
    with pytest.raises(ConfigError):
        Settings.from_env(env(PUBLIC_URL="javascript:alert(1)"))


def test_demo_ohne_schluessel_nur_lokal():
    s = Settings.from_env({"ALLOW_NO_KEY": "true", "HOST": "127.0.0.1"})
    assert s.operator_key == "" and s.allow_no_key
    with pytest.raises(ConfigError, match="127.0.0.1"):
        Settings.from_env({"ALLOW_NO_KEY": "true", "HOST": "0.0.0.0"})
    with pytest.raises(ConfigError):                       # ohne Schalter bleibt der Schluessel Pflicht
        Settings.from_env({"HOST": "127.0.0.1"})
    # mit gesetztem Schluessel gilt er weiterhin, auch bei ALLOW_NO_KEY
    assert Settings.from_env({"ALLOW_NO_KEY": "true", "OPERATOR_KEY": "abcdefghij0123456789", "HOST": "0.0.0.0"}).operator_key


def test_persisch_optional():
    s = Settings.from_env(env(TARGET_LANGS="uk,fa"))
    assert "fa" in s.target_langs and s.default_langs == ("uk",)
    assert Settings.from_env(env(TARGET_LANGS="uk,fa", DEFAULT_LANGS="uk,fa")).default_langs == ("uk", "fa")
    with pytest.raises(ConfigError):
        Settings.from_env(env(TARGET_LANGS="uk,en", DEFAULT_LANGS="uk,tr"))


def test_env_example_ist_vollstaendig_und_ohne_geheimnisse():
    from pathlib import Path
    text = (Path(__file__).resolve().parents[2] / ".env.example").read_text()
    vals = dict(l.split("=", 1) for l in text.splitlines() if "=" in l and not l.startswith("#"))
    for secret in ("OPERATOR_KEY", "HF_TOKEN"):
        assert vals[secret] == ""
    # Beispieldatei muss mit gesetztem Schluessel ladbar sein
    Settings.from_env({**vals, "OPERATOR_KEY": "abcdefghij0123456789", "WEB_DIR": "../web"})


def test_neue_einstellungen_und_pruefung():
    s = Settings.from_env(env(SEGMENT_MAX_WORDS="8", LANG_QUEUE_MAX="4", TTS_SKIP_BACKLOG="1",
                              SERVER_HOURLY_EUR="1.19", BUDGET_EUR="50"))
    assert (s.segment_max_words, s.lang_queue_max, s.tts_skip_backlog) == (8, 4, 1)
    assert s.server_hourly_eur == 1.19 and s.budget_eur == 50
    for bad in ({"SEGMENT_MAX_WORDS": "0"}, {"LANG_QUEUE_MAX": "0"}, {"BUDGET_EUR": "-1"}):
        with pytest.raises(ConfigError):
            Settings.from_env(env(**bad))


def test_gleichfoermiger_schluessel_wird_abgelehnt():
    import pytest
    with pytest.raises(ConfigError):
        Settings.from_env({"OPERATOR_KEY": "a" * 24})                  # lang genug, aber nur ein Zeichen
    with pytest.raises(ConfigError):
        Settings.from_env({"OPERATOR_KEY": "abababababababababab"})    # nur 2 verschiedene Zeichen
    assert Settings.from_env({"OPERATOR_KEY": "k3y-Zufall-0123456789"}).operator_key


def test_env_example_entspricht_den_standardwerten_und_nennt_jede_einstellung():
    """Die Vorlage wird fuer den Docker-Weg eingelesen: alte Werte darin wuerden die Standardwerte still ueberschreiben (Gutachten: Satzgrenzen,
    Warteschlangen, Verlauf). Jeder aktive Eintrag muss dem Standardwert entsprechen; jede vom Programm gelesene Variable muss in der Datei stehen."""
    import dataclasses
    import re
    from pathlib import Path
    root = Path(__file__).resolve().parents[2]
    text = (root / ".env.example").read_text(encoding="utf-8")
    aktiv = dict(l.split("=", 1) for l in text.splitlines() if "=" in l and not l.lstrip().startswith("#"))
    erwartet = dataclasses.replace(Settings(), operator_key="abcdefghij0123456789", web_dir=Path("../web").resolve())
    geladen = Settings.from_env({**aktiv, "OPERATOR_KEY": "abcdefghij0123456789", "WEB_DIR": "../web"})
    abweichend = {f.name: (getattr(geladen, f.name), getattr(erwartet, f.name))
                  for f in dataclasses.fields(Settings) if getattr(geladen, f.name) != getattr(erwartet, f.name)}
    assert not abweichend, f".env.example weicht von den Standardwerten ab: {abweichend}"
    quelle = (root / "server" / "app" / "config.py").read_text(encoding="utf-8")
    gelesen = set(re.findall(r'get\("([A-Z][A-Z0-9_]+)"', quelle)) | {"HF_TOKEN"}
    genannt = set(re.findall(r"^#?\s*([A-Z][A-Z0-9_]+)=", text, flags=re.M))
    assert not (gelesen - genannt), f"nicht in .env.example erwaehnt: {sorted(gelesen - genannt)}"


def test_offline_voreinstellungen_nur_bei_lokalen_modellen(tmp_path):
    from app.config import apply_offline_defaults
    d = tmp_path / "modell"; d.mkdir()
    mit = Settings(asr_backend="real", mt_backend="real", asr_model=str(d), mt_model_id=str(d))
    e = {}
    assert set(apply_offline_defaults(mit, e)) == {"HF_HUB_DISABLE_TELEMETRY", "DO_NOT_TRACK", "HF_HUB_OFFLINE", "TRANSFORMERS_OFFLINE"}
    e = {"HF_HUB_OFFLINE": "0"}                                             # bewusst gesetzte Werte bleiben
    apply_offline_defaults(mit, e); assert e["HF_HUB_OFFLINE"] == "0"
    e = {}
    ohne = Settings(asr_backend="real", mt_backend="real", asr_model="large-v3", mt_model_id=str(d))   # Modellname statt Ordner: Download noetig
    assert set(apply_offline_defaults(ohne, e)) == {"HF_HUB_DISABLE_TELEMETRY", "DO_NOT_TRACK"}
    e = {}
    assert set(apply_offline_defaults(Settings(), e)) == {"HF_HUB_DISABLE_TELEMETRY", "DO_NOT_TRACK"}   # Attrappen: nichts erzwingen
