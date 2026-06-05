from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from main import create_app
from api.maps import get_map_service


def _fake_map(**kw):
    base = dict(
        id="m1", name="회의실A", thumbnail="/t.png", resolution=0.05,
        width=40, height=30, originX=-1.0, originY=-0.75, isActive=False,
        createdAt="2026-06-05T00:00:00",
    )
    base.update(kw)
    return SimpleNamespace(**base)


def _client_with(service) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_map_service] = lambda: service
    return TestClient(app)


def test_list_maps():
    svc = AsyncMock()
    svc.list.return_value = [_fake_map()]
    client = _client_with(svc)
    r = client.get("/maps")
    assert r.status_code == 200
    assert r.json()[0]["name"] == "회의실A"


def test_save_map():
    svc = AsyncMock()
    svc.save.return_value = _fake_map(id="m2", name="새맵")
    client = _client_with(svc)
    r = client.post("/maps/save", json={"name": "새맵"})
    assert r.status_code == 200
    assert r.json()["id"] == "m2"
    svc.save.assert_awaited_once_with("새맵")


def test_activate_map():
    svc = AsyncMock()
    svc.activate.return_value = _fake_map(isActive=True)
    client = _client_with(svc)
    r = client.post("/maps/m1/activate")
    assert r.status_code == 200
    svc.activate.assert_awaited_once_with("m1")
