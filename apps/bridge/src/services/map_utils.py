"""Helpers for parsing ROS map files (pgm/yaml) and generating thumbnails."""

from pathlib import Path

import yaml
from PIL import Image


def parse_map_yaml(yaml_path: Path) -> dict[str, float]:
    """Return resolution + origin x/y from a ROS map yaml."""
    data = yaml.safe_load(Path(yaml_path).read_text())
    origin = data.get("origin", [0.0, 0.0, 0.0])
    return {
        "resolution": float(data["resolution"]),
        "originX": float(origin[0]),
        "originY": float(origin[1]),
    }


def read_pgm_size(pgm_path: Path) -> tuple[int, int]:
    """Return (width, height) of a PGM image without loading all pixels into RAM."""
    with Image.open(pgm_path) as img:
        return (img.width, img.height)


def make_thumbnail(pgm_path: Path, out_path: Path, max_side: int = 200) -> None:
    """Write a PNG thumbnail (<= max_side on the long edge) from a PGM map."""
    with Image.open(pgm_path) as img:
        thumb = img.convert("L").copy()
        thumb.thumbnail((max_side, max_side))
        thumb.save(out_path, format="PNG")
