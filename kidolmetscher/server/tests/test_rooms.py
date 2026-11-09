import pytest

from app.config import Settings
from app.rooms import END, Room, RoomError, RoomFullError, RoomManager, TokenError
from conftest import FakeClock, make_settings


@pytest.fixture
def mgr(settings, clock):
    return RoomManager(settings, clock)


def test_raeume_haben_eindeutige_ids(mgr):
    ids = {mgr.create_room().id for _ in range(50)}
    assert len(ids) == 50 and all(len(i) >= 12 for i in ids)


def test_token_zufaellig_und_nur_als_hash_gespeichert(mgr):
    room = mgr.create_room()
    t1, _ = room.create_listener_token("uk")
    t2, _ = room.create_listener_token("uk")
    assert t1 != t2 and len(t1) >= 32
    assert t1 not in room._tokens and t1 not in str(room._tokens)   # kein Klartext


def test_token_gilt_bis_ablaufzeit(mgr, clock):
    room = mgr.create_room()
    token, exp = room.create_listener_token("en", ttl_s=100)
    assert exp == clock.t + 100
    clock.advance(99)
    assert room.has_token(token)
    clock.advance(1)                         # genau Ablaufzeitpunkt = abgelaufen
    assert not room.has_token(token)
    with pytest.raises(TokenError):
        room.attach_listener(token)


def test_token_unbekannt(mgr):
    room = mgr.create_room()
    with pytest.raises(TokenError):
        room.attach_listener("gibt-es-nicht")
    with pytest.raises(TokenError):
        mgr.attach_listener("gibt-es-nicht")


def test_ttl_grenzen_und_sprache(settings, clock):
    room = RoomManager(make_settings(min_listener_ttl_s=60, listener_ttl_s=120, max_listener_ttl_s=300), clock).create_room()
    with pytest.raises(RoomError):
        room.create_listener_token("uk", ttl_s=59)
    with pytest.raises(RoomError):
        room.create_listener_token("uk", ttl_s=301)
    with pytest.raises(RoomError):
        room.create_listener_token("fa")     # nicht in TARGET_LANGS
    with pytest.raises(RoomError):
        room.create_listener_token("xx")


def test_token_laeuft_nicht_laenger_als_raum(clock):
    m = RoomManager(make_settings(room_ttl_s=50), clock)
    room = m.create_room()
    _, exp = room.create_listener_token("uk", ttl_s=60)
    assert exp == clock.t + 50


def test_manager_findet_raum_ueber_token(mgr):
    r1, r2 = mgr.create_room(), mgr.create_room()
    t, _ = r2.create_listener_token("tr")
    room, lst = mgr.attach_listener(t)
    assert room is r2 and lst.lang == "tr"


def test_aktive_sprachen_nur_mit_zuhoerern(mgr):
    room = mgr.create_room()
    assert room.active_languages() == []
    a = room.attach_listener(room.create_listener_token("uk")[0])
    room.attach_listener(room.create_listener_token("ar")[0])
    assert room.active_languages() == ["ar", "uk"]
    room.detach_listener(a)
    assert room.active_languages() == ["ar"]


def test_publish_nur_an_passende_sprache(mgr):
    room = mgr.create_room()
    uk = room.attach_listener(room.create_listener_token("uk")[0])
    en = room.attach_listener(room.create_listener_token("en")[0])
    assert room.publish("uk", {"x": 1, "audio": b"a"}) == 1
    assert uk.queue.qsize() == 1 and en.queue.qsize() == 0


def test_ringpuffer_begrenzt_und_ohne_audio(mgr):
    room = mgr.create_room()     # ring_buffer_size=3
    for i in range(5):
        room.publish("uk", {"seq": i, "audio": "AAAA"})
    r = room.replay("uk")
    assert [m["seq"] for m in r] == [2, 3, 4]
    assert all(m["audio"] is None and m["replay"] for m in r)


def test_ringpuffer_aus(clock):
    room = RoomManager(make_settings(ring_buffer_size=0), clock).create_room()
    room.publish("uk", {"seq": 1})
    assert room.replay("uk") == []


def test_langsamer_client_verliert_alte_nachrichten(mgr):
    room = mgr.create_room()
    lst = room.attach_listener(room.create_listener_token("uk")[0])
    for i in range(80):
        room.publish("uk", {"seq": i})
    assert lst.queue.qsize() == 50 and lst.dropped == 30


def test_max_zuhoerer(clock):
    room = RoomManager(make_settings(max_listeners_per_room=2), clock).create_room()
    t, _ = room.create_listener_token("uk")
    room.attach_listener(t); room.attach_listener(t)
    with pytest.raises(RoomFullError):
        room.attach_listener(t)


def test_sitzungsende_loescht_alles(mgr):
    room = mgr.create_room()
    token, _ = room.create_listener_token("uk")
    lst = room.attach_listener(token)
    room.publish("uk", {"seq": 1})
    assert mgr.close_room(room.id)
    assert room.closed and room._tokens == {} and room._ring == {} and room._listeners == {}
    assert room.replay("uk") == [] and room.active_languages() == []
    # Zuhoerer bekommt Ende-Marker (nach evtl. noch offener Nachricht)
    items = [lst.queue.get_nowait() for _ in range(lst.queue.qsize())]
    assert items[-1] is END
    with pytest.raises(TokenError):
        room.attach_listener(token)
    with pytest.raises(RoomError):
        room.create_listener_token("uk")
    assert room.publish("uk", {"seq": 2}) == 0
    assert mgr.get(room.id) is None and not mgr.close_room(room.id)


def test_raum_laeuft_ab(clock):
    m = RoomManager(make_settings(room_ttl_s=100), clock)
    room = m.create_room()
    clock.advance(99)
    assert m.purge_expired() == 0 and m.get(room.id) is room
    clock.advance(1)
    assert m.purge_expired() == 1 and room.closed and len(m) == 0


def test_zaehler_ohne_inhalte(mgr):
    room = mgr.create_room()
    room.attach_listener(room.create_listener_token("uk")[0])
    room.publish("uk", {"text": "GEHEIM"})
    s = room.stats()
    assert s["counters"]["messages_out"] == 1 and "GEHEIM" not in str(s)


def test_sammel_token_und_sprachwahl(mgr):
    from app.rooms import LanguageError
    room = mgr.create_room()
    token, _ = room.create_listener_token()          # Sammel-Link
    lst = room.attach_listener(token)
    assert lst.lang is None and room.active_languages() == [] and room.listener_counts() == {}
    room.select_language(lst, "tr")
    assert room.active_languages() == ["tr"] and room.listener_counts() == {"tr": 1}
    room.select_language(lst, "uk")                  # Wechsel
    assert room.active_languages() == ["uk"]
    with pytest.raises(LanguageError):
        room.select_language(lst, "fa")              # nicht angeboten


def test_fester_link_laesst_keinen_wechsel_zu(mgr):
    from app.rooms import LanguageError
    room = mgr.create_room()
    lst = room.attach_listener(room.create_listener_token("uk")[0])
    room.select_language(lst, "uk")
    with pytest.raises(LanguageError):
        room.select_language(lst, "en")


def test_raum_mit_eigener_sprachliste(mgr):
    from app.rooms import LanguageError
    room = mgr.create_room(["en", "tr"])
    assert room.langs == ("en", "tr")
    with pytest.raises(RoomError):
        room.create_listener_token("uk")
    for bad in (["xx"], [], ["uk", "ru"]):           # unbekannt oder nicht in TARGET_LANGS
        with pytest.raises(LanguageError):
            mgr.create_room(bad)
