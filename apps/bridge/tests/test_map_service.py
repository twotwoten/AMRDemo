from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from services.map_service import MapService


class FakeMapTable:
    def __init__(self):
        self.create = AsyncMock(side_effect=self._create)
        self.find_many = AsyncMock(return_value=[])
        self.find_first = AsyncMock(return_value=None)
        self.update_many = AsyncMock()
        self.update = AsyncMock()
        self.delete = AsyncMock()
        self._rows: list[dict] = []

    async def _create(self, data):
        self._rows.append(data)
        row = MagicMock()
        for k, v in data.items():
            setattr(row, k, v)
        return row


class FakeDB:
    def __init__(self):
        self.map = FakeMapTable()


@pytest.fixture
def maps_dir(tmp_path: Path) -> Path:
    return tmp_path / "maps"


async def test_save_runs_saver_and_creates_row(monkeypatch, maps_dir: Path):
    db = FakeDB()
    svc = MapService(db=db, maps_dir=maps_dir)

    # Fake the map_saver subprocess: write pgm + yaml where the service expects them
    async def fake_run_saver(self, out_prefix: Path):
        out_prefix.parent.mkdir(parents=True, exist_ok=True)
        header = b"P5\n40 30\n255\n"
        out_prefix.with_suffix(".pgm").write_bytes(header + bytes([205] * (40 * 30)))
        out_prefix.with_suffix(".yaml").write_text(
            "image: map.pgm\nresolution: 0.05\norigin: [-1.0, -0.75, 0.0]\n"
        )

    monkeypatch.setattr(MapService, "_run_saver", fake_run_saver)

    row = await svc.save("회의실A")

    assert db.map.create.await_count == 1
    created = db.map.create.call_args.kwargs["data"]
    assert created["name"] == "회의실A"
    assert created["resolution"] == 0.05
    assert created["width"] == 40 and created["height"] == 30
    assert created["originX"] == -1.0 and created["originY"] == -0.75
    assert Path(created["pgmPath"]).exists()
    assert Path(created["yamlPath"]).exists()
    assert Path(created["thumbnail"]).exists()
    assert row.name == "회의실A"


async def test_activate_unsets_others(maps_dir: Path):
    db = FakeDB()
    svc = MapService(db=db, maps_dir=maps_dir)
    await svc.activate("map-123")
    db.map.update_many.assert_awaited()  # clear previous active
    db.map.update.assert_awaited_with(
        where={"id": "map-123"}, data={"isActive": True}
    )
