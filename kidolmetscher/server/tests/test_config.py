import pytest

from app.config import ConfigError, Settings


def env(**kw):
    return {"OPERATOR_KEY": "x" * 20, **kw}


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
    Settings.from_env({**vals, "OPERATOR_KEY": "y" * 20, "WEB_DIR": "../web"})
