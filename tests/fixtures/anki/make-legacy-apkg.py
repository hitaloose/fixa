"""Builds tests/fixtures/anki/legacy.apkg: an Anki 2.1 "support older versions" export
(collection.anki2, schema 11, JSON media map). Run: python3 tests/fixtures/anki/make-legacy-apkg.py

Contents (asserted by the import tests):
- decks "Default" (empty), "Inglês", "Inglês::Animais" (preset "Intenso")
- note types "Basic" (Front/Back) and "Cloze" (Text/Back Extra)
- n1 Basic cat/gato + image, tags "animais Ingles", review card with 3 review-log entries
- n2 Basic dog/cão, new card (position 2)
- n3 Cloze, c1 learning, c2 suspended review, flag 1 on c1
- n4 Basic with a formula \\(\\frac{1}{2}\\), new card (position 1), deck "Inglês"
"""
import hashlib, json, os, re, sqlite3, tempfile, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
CRT = 1_700_000_000  # collection creation (seconds)
DAY = 86_400
TODAY = 1_000  # collection day the export was made (due/ivl are relative to CRT)
NOW = CRT + TODAY * DAY + 10 * 3600

BASIC, CLOZE = 1_600_000_000_001, 1_600_000_000_002
D_DEFAULT, D_INGLES, D_ANIMAIS = 1, 1_700_000_000_101, 1_700_000_000_102
C_DEFAULT, C_INTENSO = 1, 1_700_000_000_201

def strip(html):
    return re.sub(r"<[^>]*>", "", html)

def csum(text):
    return int(hashlib.sha1(strip(text).encode()).hexdigest()[:8], 16)

models = {
    str(BASIC): {
        "id": BASIC, "name": "Basic", "type": 0, "mod": CRT, "usn": -1, "sortf": 0, "did": D_DEFAULT,
        "flds": [{"name": "Front", "ord": 0, "sticky": False, "rtl": False, "font": "Arial", "size": 20},
                 {"name": "Back", "ord": 1, "sticky": False, "rtl": False, "font": "Arial", "size": 20}],
        "tmpls": [{"name": "Card 1", "ord": 0, "qfmt": "{{Front}}", "afmt": "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}", "did": None, "bqfmt": "", "bafmt": ""}],
        "css": ".card { font-family: arial; font-size: 20px; text-align: center; }",
        "latexPre": "", "latexPost": "", "req": [[0, "any", [0]]], "tags": [], "vers": [],
    },
    str(CLOZE): {
        "id": CLOZE, "name": "Cloze", "type": 1, "mod": CRT, "usn": -1, "sortf": 0, "did": D_DEFAULT,
        "flds": [{"name": "Text", "ord": 0, "sticky": False, "rtl": False, "font": "Arial", "size": 20},
                 {"name": "Back Extra", "ord": 1, "sticky": False, "rtl": False, "font": "Arial", "size": 20}],
        "tmpls": [{"name": "Cloze", "ord": 0, "qfmt": "{{cloze:Text}}", "afmt": "{{cloze:Text}}<br>\n{{Back Extra}}", "did": None, "bqfmt": "", "bafmt": ""}],
        "css": ".card { font-family: arial; } .cloze { font-weight: bold; color: blue; }",
        "latexPre": "", "latexPost": "", "tags": [], "vers": [],
    },
}
decks = {
    str(D_DEFAULT): {"id": D_DEFAULT, "name": "Default", "conf": C_DEFAULT, "dyn": 0, "collapsed": False, "desc": "", "mod": CRT, "usn": -1},
    str(D_INGLES): {"id": D_INGLES, "name": "Inglês", "conf": C_DEFAULT, "dyn": 0, "collapsed": False, "desc": "", "mod": CRT, "usn": -1},
    str(D_ANIMAIS): {"id": D_ANIMAIS, "name": "Inglês::Animais", "conf": C_INTENSO, "dyn": 0, "collapsed": True, "desc": "", "mod": CRT, "usn": -1},
}
dconf = {
    str(C_DEFAULT): {"id": C_DEFAULT, "name": "Default", "new": {"perDay": 20, "delays": [1, 10]},
                     "rev": {"perDay": 200, "maxIvl": 36500}, "lapse": {"delays": [10], "leechFails": 8, "leechAction": 1}},
    str(C_INTENSO): {"id": C_INTENSO, "name": "Intenso", "new": {"perDay": 50, "delays": [5, 30, 1440]},
                     "rev": {"perDay": 500, "maxIvl": 3650}, "lapse": {"delays": [15], "leechFails": 6, "leechAction": 0},
                     "desiredRetention": 0.85},
}

notes = [
    # id, guid, mid, tags, fields
    (1_700_000_001_001, "Gk8&cat", BASIC, " animais Ingles ", ["cat", 'gato <img src="gato.png">']),
    (1_700_000_001_002, "Gk8&dog", BASIC, "", ["dog", "cão"]),
    (1_700_000_001_003, "Gk8&brz", CLOZE, "geo", ["{{c1::Brasília}} é a capital do {{c2::Brasil}}", ""]),
    (1_700_000_001_004, "Gk8&hlf", BASIC, "", ["\\(\\frac{1}{2}\\)", "metade"]),
]
cards = [
    # id, nid, did, ord, type, queue, due, ivl, factor, reps, lapses, left, flags
    (1_700_000_002_001, notes[0][0], D_ANIMAIS, 0, 2, 2, TODAY + 3, 10, 2500, 5, 1, 0, 0),
    (1_700_000_002_002, notes[1][0], D_ANIMAIS, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0),
    (1_700_000_002_003, notes[2][0], D_INGLES, 0, 1, 1, NOW + 600, 0, 2500, 1, 0, 1001, 1),
    (1_700_000_002_004, notes[2][0], D_INGLES, 1, 2, -1, TODAY - 5, 20, 2300, 7, 2, 0, 0),
    (1_700_000_002_005, notes[3][0], D_INGLES, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0),
]
revlog = [
    # id (ms), cid, ease, ivl, lastIvl, factor, time (ms), type
    ((CRT + (TODAY - 30) * DAY) * 1000, cards[0][0], 3, -600, 0, 2500, 8000, 0),
    ((CRT + (TODAY - 29) * DAY) * 1000, cards[0][0], 3, 4, -600, 2500, 6000, 0),
    ((CRT + (TODAY - 7) * DAY) * 1000, cards[0][0], 4, 10, 4, 2650, 4000, 1),
    ((CRT + TODAY * DAY) * 1000 + 1, cards[2][0], 3, -600, 0, 2500, 5000, 0),
]

SCHEMA = """
CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null,
  ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null,
  models text not null, decks text not null, dconf text not null, tags text not null);
CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null,
  usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null,
  flags integer not null, data text not null);
CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null,
  mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null,
  ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null,
  odue integer not null, odid integer not null, flags integer not null, data text not null);
CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null,
  ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null);
CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
"""

with tempfile.TemporaryDirectory() as tmp:
    path = os.path.join(tmp, "collection.anki2")
    db = sqlite3.connect(path)
    db.executescript(SCHEMA)
    db.execute("INSERT INTO col VALUES (1,?,?,?,11,0,0,0,?,?,?,?,?)",
               (CRT, NOW * 1000, NOW * 1000, json.dumps({"nextPos": 3}), json.dumps(models),
                json.dumps(decks), json.dumps(dconf), "{}"))
    for nid, guid, mid, tags, flds in notes:
        db.execute("INSERT INTO notes VALUES (?,?,?,?,-1,?,?,?,?,0,'')",
                   (nid, guid, mid, NOW, tags, "\x1f".join(flds), strip(flds[0]), csum(flds[0])))
    for cid, nid, did, ord_, type_, queue, due, ivl, factor, reps, lapses, left, flags in cards:
        db.execute("INSERT INTO cards VALUES (?,?,?,?,?,-1,?,?,?,?,?,?,?,?,0,0,?,'')",
                   (cid, nid, did, ord_, NOW, type_, queue, due, ivl, factor, reps, lapses, left, flags))
    for rid, cid, ease, ivl, last, factor, time, type_ in revlog:
        db.execute("INSERT INTO revlog VALUES (?,?,-1,?,?,?,?,?,?)", (rid, cid, ease, ivl, last, factor, time, type_))
    db.commit()
    db.close()
    png = bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010806000000"
                        "1f15c4890000000d49444154789c63f8cfc0f01f0005000201a0f2c7a20000000049454e44ae426082")
    out = os.path.join(HERE, "legacy.apkg")
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(path, "collection.anki2")
        z.writestr("media", json.dumps({"0": "gato.png"}))
        z.writestr("0", png)
    print("wrote", out)
