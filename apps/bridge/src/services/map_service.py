"""Map persistence: save the live /map to pgm/yaml, thumbnail it, and record metadata."""

import asyncio
import io
import os
import shutil
import zipfile
from pathlib import Path

try:  # prisma-client-py ships cuid; fall back to a random id if unavailable.
    from cuid import cuid
except ImportError:  # pragma: no cover - exercised only when cuid is missing
    import secrets

    def cuid() -> str:
        return "c" + secrets.token_hex(12)

from services.map_utils import make_thumbnail, parse_map_yaml, read_pgm_size


def default_maps_dir() -> Path:
    return Path(os.path.expanduser(os.getenv("AMRDETAIL_MAPS_DIR", "~/.amrdetail/maps")))


class MapSaveError(RuntimeError):
    pass


class MapService:
    def __init__(self, db, maps_dir: Path | None = None):
        self.db = db
        self.maps_dir = Path(maps_dir) if maps_dir else default_maps_dir()

    async def _run_saver(self, out_prefix: Path) -> None:
        """Invoke nav2 map_saver_cli to write <out_prefix>.pgm + .yaml from latched /map."""
        out_prefix.parent.mkdir(parents=True, exist_ok=True)
        proc = await asyncio.create_subprocess_exec(
            "ros2", "run", "nav2_map_server", "map_saver_cli",
            "-f", str(out_prefix),
            "--ros-args", "-p", "map_subscribe_transient_local:=true",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            _, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
        except asyncio.TimeoutError:
            proc.kill()
            raise MapSaveError("map_saver_cli timed out (no /map?)")
        if proc.returncode != 0 or not out_prefix.with_suffix(".pgm").exists():
            raise MapSaveError(
                f"map_saver_cli failed: {stderr.decode(errors='ignore')[:400]}"
            )

    async def save(self, name: str):
        map_id = cuid()
        out_dir = self.maps_dir / map_id
        prefix = out_dir / "map"
        await self._run_saver(prefix)

        pgm = prefix.with_suffix(".pgm")
        yaml_path = prefix.with_suffix(".yaml")
        thumb = out_dir / "thumb.png"
        make_thumbnail(pgm, thumb)

        meta = parse_map_yaml(yaml_path)
        width, height = read_pgm_size(pgm)

        return await self.db.map.create(
            data={
                "id": map_id,
                "name": name,
                "pgmPath": str(pgm),
                "yamlPath": str(yaml_path),
                "thumbnail": str(thumb),
                "resolution": meta["resolution"],
                "width": width,
                "height": height,
                "originX": meta["originX"],
                "originY": meta["originY"],
                "isActive": False,
            }
        )

    async def list(self):
        return await self.db.map.find_many(order={"createdAt": "desc"})

    async def get_active(self):
        return await self.db.map.find_first(where={"isActive": True})

    async def activate(self, map_id: str):
        await self.db.map.update_many(where={"isActive": True}, data={"isActive": False})
        return await self.db.map.update(where={"id": map_id}, data={"isActive": True})

    async def delete(self, map_id: str):
        row = await self.db.map.find_first(where={"id": map_id})
        if row is not None:
            shutil.rmtree(self.maps_dir / map_id, ignore_errors=True)
            await self.db.map.delete(where={"id": map_id})
        return row

    async def export_zip(self, map_id: str) -> bytes:
        out_dir = self.maps_dir / map_id
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for fname in ("map.pgm", "map.yaml", "thumb.png"):
                fpath = out_dir / fname
                if fpath.exists():
                    zf.write(fpath, arcname=fname)
        return buf.getvalue()
