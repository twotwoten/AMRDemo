from pathlib import Path

from services.map_utils import parse_map_yaml, read_pgm_size, make_thumbnail


def _write_pgm(path: Path, width: int, height: int) -> None:
    # Minimal binary PGM (P5): header + width*height bytes of 0xCD (free-ish gray)
    header = f"P5\n{width} {height}\n255\n".encode("ascii")
    path.write_bytes(header + bytes([205] * (width * height)))


def test_parse_map_yaml(tmp_path: Path):
    yaml_path = tmp_path / "map.yaml"
    yaml_path.write_text(
        "image: map.pgm\n"
        "resolution: 0.05\n"
        "origin: [-1.5, -2.25, 0.0]\n"
        "negate: 0\n"
        "occupied_thresh: 0.65\n"
        "free_thresh: 0.196\n"
    )
    meta = parse_map_yaml(yaml_path)
    assert meta["resolution"] == 0.05
    assert meta["originX"] == -1.5
    assert meta["originY"] == -2.25


def test_read_pgm_size(tmp_path: Path):
    pgm = tmp_path / "map.pgm"
    _write_pgm(pgm, 80, 60)
    assert read_pgm_size(pgm) == (80, 60)


def test_make_thumbnail(tmp_path: Path):
    pgm = tmp_path / "map.pgm"
    _write_pgm(pgm, 400, 200)
    out = tmp_path / "thumb.png"
    make_thumbnail(pgm, out, max_side=200)
    assert out.exists()
    from PIL import Image

    with Image.open(out) as img:
        assert max(img.size) <= 200
