"""Backend API tests for MapForge (Iteration 2): auth + maps + new fields (lines, texts, polygon labels)."""
import os
import uuid
import pytest
import requests

_env_url = os.environ.get("REACT_APP_BACKEND_URL")
if not _env_url:
    # Fallback to frontend/.env for test context
    try:
        from pathlib import Path
        for ln in Path("/app/frontend/.env").read_text().splitlines():
            if ln.startswith("REACT_APP_BACKEND_URL="):
                _env_url = ln.split("=", 1)[1].strip()
                break
    except Exception:
        pass
assert _env_url, "REACT_APP_BACKEND_URL must be set"
// Пример для React (используя process.env)
const BASE_URL = (process.env.REACT_APP_API_URL || 'http://localhost:10000').rstrip("/");
const API = `${BASE_URL}/api`;


def _unique_email() -> str:
    return f"TEST_{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture(scope="module")
def user_ctx():
    s = requests.Session()
    email = _unique_email()
    password = "test1234"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": password, "name": "Tester"})
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in s.cookies.get_dict()
    return {"session": s, "token": data["token"], "user": data["user"], "email": email, "password": password}


# ---------------- AUTH (regression) ----------------
class TestAuth:
    def test_register_duplicate(self, user_ctx):
        r = requests.post(f"{API}/auth/register", json={
            "email": user_ctx["email"], "password": "test1234", "name": "Dup"
        })
        assert r.status_code == 400

    def test_login_wrong_password(self, user_ctx):
        r = requests.post(f"{API}/auth/login", json={"email": user_ctx["email"], "password": "wrong"})
        assert r.status_code == 401

    def test_me_with_bearer(self, user_ctx):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {user_ctx['token']}"})
        assert r.status_code == 200
        assert r.json()["email"] == user_ctx["email"].lower()

    def test_me_no_auth(self):
        assert requests.get(f"{API}/auth/me").status_code == 401


# ---------------- MAPS - new schema ----------------
@pytest.fixture(scope="module")
def created_map(user_ctx):
    s = user_ctx["session"]
    r = s.post(f"{API}/maps", json={"title": "TEST Map I2", "description": "iter2"})
    assert r.status_code == 200, r.text
    return r.json()


class TestMapCreateNewSchema:
    """POST /api/maps must return new arrays lines: [], texts: [] and no background_image."""

    def test_create_returns_lines_and_texts_arrays(self, created_map):
        assert "lines" in created_map, "lines field missing from POST /api/maps response"
        assert created_map["lines"] == []
        assert "texts" in created_map, "texts field missing from POST /api/maps response"
        assert created_map["texts"] == []

    def test_create_no_background_image(self, created_map):
        assert "background_image" not in created_map, \
            f"background_image must be removed from responses, got: {created_map.keys()}"

    def test_create_default_structure(self, created_map, user_ctx):
        assert created_map["owner_id"] == user_ctx["user"]["id"]
        assert created_map["polygons"] == []
        assert created_map["markers"] == []
        assert len(created_map["layers"]) == 1
        assert created_map["is_public"] is False
        assert "_id" not in created_map


class TestPolygonLabels:
    """PUT must accept label_x, label_y, label_size on polygon. GET round-trips them."""

    def test_polygon_with_label_fields(self, user_ctx, created_map):
        s = user_ctx["session"]
        layer_id = created_map["layers"][0]["id"]
        poly_id = str(uuid.uuid4())
        polygons = [{
            "id": poly_id, "layer_id": layer_id,
            "points": [[0, 0], [100, 0], [100, 100], [0, 100]],
            "name": "ЗонаА", "fill": "#FF0000", "stroke": "#FFFFFF",
            "opacity": 0.5,
            "label_x": 42.5, "label_y": 63.25, "label_size": 22
        }]
        r = s.put(f"{API}/maps/{created_map['id']}", json={"polygons": polygons})
        assert r.status_code == 200, r.text
        m = r.json()
        assert len(m["polygons"]) == 1
        p = m["polygons"][0]
        assert p["label_x"] == 42.5
        assert p["label_y"] == 63.25
        assert p["label_size"] == 22
        assert p["name"] == "ЗонаА"

        # GET round-trip
        g = s.get(f"{API}/maps/{created_map['id']}")
        assert g.status_code == 200
        p2 = g.json()["polygons"][0]
        assert p2["label_x"] == 42.5 and p2["label_y"] == 63.25 and p2["label_size"] == 22

    def test_polygon_label_defaults(self, user_ctx, created_map):
        """When label_x/y omitted, label_size defaults to 14, label_x/y are None."""
        s = user_ctx["session"]
        layer_id = created_map["layers"][0]["id"]
        polygons = [{
            "id": str(uuid.uuid4()), "layer_id": layer_id,
            "points": [[1, 1], [2, 2], [3, 1]],
            "name": "NoLabel"
        }]
        r = s.put(f"{API}/maps/{created_map['id']}", json={"polygons": polygons})
        assert r.status_code == 200, r.text
        p = r.json()["polygons"][0]
        assert p.get("label_x") is None
        assert p.get("label_y") is None
        assert p.get("label_size") == 14


class TestLines:
    """PUT must accept lines:[{id, layer_id, points, name, color, width}] and GET returns them."""

    def test_create_and_persist_lines(self, user_ctx, created_map):
        s = user_ctx["session"]
        layer_id = created_map["layers"][0]["id"]
        line_id = str(uuid.uuid4())
        lines = [{
            "id": line_id, "layer_id": layer_id,
            "points": [[0, 0], [50, 50], [100, 0]],
            "name": "Линия1", "color": "#00FF00", "width": 3.5
        }]
        r = s.put(f"{API}/maps/{created_map['id']}", json={"lines": lines})
        assert r.status_code == 200, r.text
        m = r.json()
        assert len(m["lines"]) == 1
        l = m["lines"][0]
        assert l["id"] == line_id
        assert l["name"] == "Линия1"
        assert l["color"] == "#00FF00"
        assert l["width"] == 3.5
        assert l["points"] == [[0, 0], [50, 50], [100, 0]]

        # GET round-trip
        g = s.get(f"{API}/maps/{created_map['id']}").json()
        assert g["lines"][0]["id"] == line_id
        assert g["lines"][0]["width"] == 3.5

    def test_line_defaults(self, user_ctx, created_map):
        s = user_ctx["session"]
        layer_id = created_map["layers"][0]["id"]
        lines = [{
            "id": str(uuid.uuid4()), "layer_id": layer_id,
            "points": [[0, 0], [1, 1]]
        }]
        r = s.put(f"{API}/maps/{created_map['id']}", json={"lines": lines})
        assert r.status_code == 200, r.text
        l = r.json()["lines"][0]
        assert l["color"] == "#F59E0B"
        assert l["width"] == 2
        assert l["name"] == ""


class TestTexts:
    """PUT must accept texts:[{id, layer_id, x, y, text, size, color}] and GET returns them."""

    def test_create_and_persist_texts(self, user_ctx, created_map):
        s = user_ctx["session"]
        layer_id = created_map["layers"][0]["id"]
        text_id = str(uuid.uuid4())
        texts = [{
            "id": text_id, "layer_id": layer_id,
            "x": 12.5, "y": 34.75,
            "text": "Привет, мир", "size": 24, "color": "#FF00FF"
        }]
        r = s.put(f"{API}/maps/{created_map['id']}", json={"texts": texts})
        assert r.status_code == 200, r.text
        m = r.json()
        assert len(m["texts"]) == 1
        t = m["texts"][0]
        assert t["id"] == text_id
        assert t["text"] == "Привет, мир"
        assert t["x"] == 12.5 and t["y"] == 34.75
        assert t["size"] == 24
        assert t["color"] == "#FF00FF"

        # GET round-trip
        g = s.get(f"{API}/maps/{created_map['id']}").json()
        assert g["texts"][0]["text"] == "Привет, мир"

    def test_text_defaults(self, user_ctx, created_map):
        s = user_ctx["session"]
        layer_id = created_map["layers"][0]["id"]
        texts = [{
            "id": str(uuid.uuid4()), "layer_id": layer_id, "x": 0, "y": 0
        }]
        r = s.put(f"{API}/maps/{created_map['id']}", json={"texts": texts})
        assert r.status_code == 200, r.text
        t = r.json()["texts"][0]
        assert t["text"] == "Текст"
        assert t["size"] == 18
        assert t["color"] == "#FFFFFF"


class TestBackwardCompat:
    """Old maps in DB without lines/texts should still return [] for those fields."""

    def test_legacy_map_without_lines_texts(self, user_ctx):
        """Simulate legacy doc via direct PUT that doesn't include lines/texts. GET returns []."""
        s = user_ctx["session"]
        r = s.post(f"{API}/maps", json={"title": "TEST Legacy"})
        assert r.status_code == 200
        mid = r.json()["id"]
        # update only title - lines/texts arrays remain at server defaults (empty)
        r2 = s.put(f"{API}/maps/{mid}", json={"title": "TEST Legacy 2"})
        assert r2.status_code == 200
        body = r2.json()
        assert body["lines"] == []
        assert body["texts"] == []
        assert "background_image" not in body

        g = s.get(f"{API}/maps/{mid}").json()
        assert g["lines"] == []
        assert g["texts"] == []
        assert "background_image" not in g


class TestPublicShareWithNewFields:
    """GET /api/public/maps/{share_token} returns lines, texts, and polygon labels."""

    def test_public_includes_new_fields(self, user_ctx, created_map):
        s = user_ctx["session"]
        layer_id = created_map["layers"][0]["id"]
        # Populate all new field types
        payload = {
            "polygons": [{
                "id": str(uuid.uuid4()), "layer_id": layer_id,
                "points": [[0, 0], [10, 0], [10, 10]],
                "name": "P", "label_x": 5.0, "label_y": 5.0, "label_size": 16
            }],
            "lines": [{
                "id": str(uuid.uuid4()), "layer_id": layer_id,
                "points": [[0, 0], [1, 1]], "name": "L", "color": "#0000FF", "width": 4
            }],
            "texts": [{
                "id": str(uuid.uuid4()), "layer_id": layer_id,
                "x": 7, "y": 8, "text": "T", "size": 20, "color": "#AABBCC"
            }],
        }
        r = s.put(f"{API}/maps/{created_map['id']}", json=payload)
        assert r.status_code == 200, r.text

        # Toggle public
        sh = s.post(f"{API}/maps/{created_map['id']}/share")
        assert sh.status_code == 200
        token = sh.json()["share_token"]
        assert sh.json()["is_public"] is True

        # Public fetch (no auth)
        rp = requests.get(f"{API}/public/maps/{token}")
        assert rp.status_code == 200
        body = rp.json()
        assert "background_image" not in body
        assert len(body["polygons"]) == 1
        assert body["polygons"][0]["label_x"] == 5.0
        assert body["polygons"][0]["label_size"] == 16
        assert len(body["lines"]) == 1 and body["lines"][0]["color"] == "#0000FF"
        assert len(body["texts"]) == 1 and body["texts"][0]["text"] == "T"

        # Toggle off (cleanup)
        s.post(f"{API}/maps/{created_map['id']}/share")


class TestGetMapNoBackgroundImage:
    def test_get_response_has_no_background_image(self, user_ctx, created_map):
        r = user_ctx["session"].get(f"{API}/maps/{created_map['id']}")
        assert r.status_code == 200
        assert "background_image" not in r.json()

    def test_list_response_has_no_background_image(self, user_ctx):
        r = user_ctx["session"].get(f"{API}/maps")
        assert r.status_code == 200
        for m in r.json():
            assert "background_image" not in m
            assert "lines" in m and "texts" in m
