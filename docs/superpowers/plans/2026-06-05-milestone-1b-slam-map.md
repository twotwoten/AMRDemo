# Milestone 1B — SLAM + 맵 관리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gazebo sim에서 실시간 SLAM 맵을 보며 teleop으로 로봇을 움직여 맵을 만들고, 이름을 붙여 저장한 뒤 `/maps`에서 관리(활성화/삭제/내보내기)할 수 있게 한다.

**Architecture:** 1A 인프라(gazebo + rosbridge + FastAPI + Next.js) 위에, ROS2에 `amrdetail_slam`(slam_toolbox online_async)·`amrdetail_safety`(twist_mux)를 추가하고 `sim.launch.py`에 통합한다. 맵 저장은 FastAPI가 `nav2 map_saver_cli`로 latched `/map`을 pgm/yaml로 떠서 썸네일·메타데이터를 만들고 Prisma에 기록한다. UI는 react-konva로 OccupancyGrid를 렌더하고 nipplejs/WASD로 `/cmd_vel_teleop`를 발행한다.

**Tech Stack:** ROS2 Humble(slam_toolbox, twist_mux, nav2_map_server), Python(FastAPI + Prisma + Pillow), Next.js 15 + react-konva + konva + nipplejs + roslib.

**Reference spec:** `docs/superpowers/specs/2026-06-05-milestone-1b-slam-map-design.md`

**환경 노트:**
- ROS2/Gazebo/colcon 명령은 Ubuntu 22.04(WSL2). Node/Python은 호스트에서도 가능하나 sim 검증은 WSL.
- 추가 ROS2 패키지 prereq: `sudo apt install -y ros-humble-slam-toolbox ros-humble-twist-mux ros-humble-nav2-map-server`
- `amrdetail-launch sim`이 sim.launch.py를 호출하므로, slam/twist_mux는 launch에만 추가하면 됨.
- bridge는 ROS 소싱 환경에서 실행되어야 `map_saver_cli` subprocess가 동작(런처가 소싱).

> **저장 메커니즘 정정:** 스펙 §5.2는 `/slam_toolbox/save_map`을 언급하나, 이는 직렬화 포맷(.posegraph)을 만든다. 1B는 pgm/yaml(map_server 로드용 + 썸네일)이 필요하므로 **nav2 `map_saver_cli`** 를 사용한다(표준 맵 저장 방식). slam_toolbox는 `/map` 발행만 담당.

---

## File Structure

```
ros2_ws/src/
├── amrdetail_slam/                         # Task 1
│   ├── config/slam_toolbox.yaml
│   ├── launch/slam.launch.py
│   ├── CMakeLists.txt
│   └── package.xml
├── amrdetail_safety/                       # Task 2
│   ├── config/twist_mux.yaml
│   ├── launch/safety.launch.py
│   ├── CMakeLists.txt
│   └── package.xml
└── amrdetail_bringup/launch/sim.launch.py  # Task 3 (modify)

apps/bridge/src/
├── services/map_utils.py                   # Task 4
├── services/map_service.py                 # Task 5
├── api/maps.py                             # Task 6
└── main.py                                 # Task 6 (modify)
apps/bridge/tests/
├── test_map_utils.py                       # Task 4
├── test_map_service.py                     # Task 5
└── test_maps_api.py                        # Task 6

apps/web/
├── lib/occupancy-grid.ts                   # Task 7
├── lib/ros-client.ts                       # Task 8 (modify: add createPublisher)
├── lib/teleop.ts                           # Task 9
├── lib/maps-api.ts                          # Task 10
├── components/map/MapCanvas.tsx            # Task 11
├── components/map/Teleop.tsx               # Task 12
├── components/map/MappingStatus.tsx        # Task 12
├── components/map/SaveMapPanel.tsx         # Task 12
├── components/map/MapCard.tsx              # Task 14
├── components/map/MapList.tsx              # Task 14
├── app/map/new/page.tsx                    # Task 13
├── app/maps/page.tsx                       # Task 14
└── app/page.tsx                            # Task 15 (modify)
apps/web/tests/
├── occupancy-grid.test.ts                  # Task 7
├── teleop.test.ts                          # Task 9
├── maps-api.test.ts                        # Task 10
└── ros-client.test.ts                      # Task 8 (extend)
```

---

### Task 1: `amrdetail_slam` Package

**Files:**
- Create: `ros2_ws/src/amrdetail_slam/package.xml`
- Create: `ros2_ws/src/amrdetail_slam/CMakeLists.txt`
- Create: `ros2_ws/src/amrdetail_slam/config/slam_toolbox.yaml`
- Create: `ros2_ws/src/amrdetail_slam/launch/slam.launch.py`

- [ ] **Step 1: Create `package.xml`**

```xml
<?xml version="1.0"?>
<package format="3">
  <name>amrdetail_slam</name>
  <version>0.1.0</version>
  <description>slam_toolbox online_async configuration and launch for AMRDetail</description>
  <maintainer email="dean@robos.one">Dean</maintainer>
  <license>MIT</license>

  <buildtool_depend>ament_cmake</buildtool_depend>

  <exec_depend>slam_toolbox</exec_depend>

  <export>
    <build_type>ament_cmake</build_type>
  </export>
</package>
```

- [ ] **Step 2: Create `CMakeLists.txt`**

```cmake
cmake_minimum_required(VERSION 3.8)
project(amrdetail_slam)

find_package(ament_cmake REQUIRED)

install(
  DIRECTORY config launch
  DESTINATION share/${PROJECT_NAME}
)

ament_package()
```

- [ ] **Step 3: Create `config/slam_toolbox.yaml`**

```yaml
slam_toolbox:
  ros__parameters:
    use_sim_time: true
    # Plugin params
    solver_plugin: solver_plugins::CeresSolver
    ceres_linear_solver: SPARSE_NORMAL_CHOLESKY
    ceres_preconditioner: SCHUR_JACOBI
    ceres_trust_strategy: LEVENBERG_MARQUARDT
    ceres_dogleg_type: TRADITIONAL_DOGLEG
    ceres_loss_function: None
    mode: mapping

    odom_frame: odom
    map_frame: map
    base_frame: base_footprint
    scan_topic: /scan

    debug_logging: false
    throttle_scans: 1
    transform_publish_period: 0.02
    map_update_interval: 1.0
    resolution: 0.05
    max_laser_range: 3.5
    minimum_time_interval: 0.5
    transform_timeout: 0.2
    tf_buffer_duration: 30.0
    stack_size_to_use: 40000000
    enable_interactive_mode: false

    # General params for online async, tuned for a small (~4x3m) indoor space
    minimum_travel_distance: 0.2
    minimum_travel_heading: 0.2
    scan_buffer_size: 10
    scan_buffer_maximum_scan_distance: 4.0
    link_match_minimum_response_fine: 0.1
    link_scan_maximum_distance: 1.5
    loop_search_maximum_distance: 3.0
    do_loop_closing: true
    loop_match_minimum_chain_size: 10
    loop_match_maximum_variance_coarse: 3.0
    loop_match_minimum_response_coarse: 0.35
    loop_match_minimum_response_fine: 0.45
```

- [ ] **Step 4: Create `launch/slam.launch.py`**

```python
"""Launch slam_toolbox in online_async mapping mode for AMRDetail."""

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare


def generate_launch_description() -> LaunchDescription:
    use_sim_time = LaunchConfiguration("use_sim_time")
    slam_params = PathJoinSubstitution(
        [FindPackageShare("amrdetail_slam"), "config", "slam_toolbox.yaml"]
    )

    return LaunchDescription(
        [
            DeclareLaunchArgument(
                "use_sim_time",
                default_value="true",
                description="Use simulation clock.",
            ),
            Node(
                package="slam_toolbox",
                executable="async_slam_toolbox_node",
                name="slam_toolbox",
                output="screen",
                parameters=[slam_params, {"use_sim_time": use_sim_time}],
            ),
        ]
    )
```

- [ ] **Step 5: Build the package**

Run:
```bash
cd ros2_ws && colcon build --packages-select amrdetail_slam
```
Expected: "Summary: 1 package finished".

- [ ] **Step 6: Verify launch parses (standalone, no gazebo yet)**

Run:
```bash
source install/setup.bash
ros2 launch amrdetail_slam slam.launch.py --show-args
```
Expected: prints the `use_sim_time` argument with default `true`, no Python errors.

- [ ] **Step 7: Commit**

```bash
cd ..
git add ros2_ws/src/amrdetail_slam
git commit -m "feat(ros2): add amrdetail_slam with slam_toolbox online_async config"
```

---

### Task 2: `amrdetail_safety` Package (twist_mux)

**Files:**
- Create: `ros2_ws/src/amrdetail_safety/package.xml`
- Create: `ros2_ws/src/amrdetail_safety/CMakeLists.txt`
- Create: `ros2_ws/src/amrdetail_safety/config/twist_mux.yaml`
- Create: `ros2_ws/src/amrdetail_safety/launch/safety.launch.py`

- [ ] **Step 1: Create `package.xml`**

```xml
<?xml version="1.0"?>
<package format="3">
  <name>amrdetail_safety</name>
  <version>0.1.0</version>
  <description>cmd_vel priority mux (twist_mux) and safety nodes for AMRDetail</description>
  <maintainer email="dean@robos.one">Dean</maintainer>
  <license>MIT</license>

  <buildtool_depend>ament_cmake</buildtool_depend>

  <exec_depend>twist_mux</exec_depend>

  <export>
    <build_type>ament_cmake</build_type>
  </export>
</package>
```

- [ ] **Step 2: Create `CMakeLists.txt`**

```cmake
cmake_minimum_required(VERSION 3.8)
project(amrdetail_safety)

find_package(ament_cmake REQUIRED)

install(
  DIRECTORY config launch
  DESTINATION share/${PROJECT_NAME}
)

ament_package()
```

- [ ] **Step 3: Create `config/twist_mux.yaml`**

```yaml
twist_mux:
  ros__parameters:
    use_sim_time: true
    topics:
      estop:
        topic:    cmd_vel_estop
        timeout:  0.5
        priority: 100
      navigation:
        topic:    cmd_vel_nav
        timeout:  0.5
        priority: 50
      teleop:
        topic:    cmd_vel_teleop
        timeout:  0.5
        priority: 30
      keyboard:
        topic:    cmd_vel_keyboard
        timeout:  0.5
        priority: 10
```

- [ ] **Step 4: Create `launch/safety.launch.py`**

```python
"""Launch twist_mux to arbitrate /cmd_vel by priority for AMRDetail."""

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare


def generate_launch_description() -> LaunchDescription:
    use_sim_time = LaunchConfiguration("use_sim_time")
    twist_mux_params = PathJoinSubstitution(
        [FindPackageShare("amrdetail_safety"), "config", "twist_mux.yaml"]
    )

    return LaunchDescription(
        [
            DeclareLaunchArgument(
                "use_sim_time",
                default_value="true",
                description="Use simulation clock.",
            ),
            Node(
                package="twist_mux",
                executable="twist_mux",
                name="twist_mux",
                output="screen",
                parameters=[twist_mux_params, {"use_sim_time": use_sim_time}],
                remappings=[("cmd_vel_out", "cmd_vel")],
            ),
        ]
    )
```

- [ ] **Step 5: Build and verify**

```bash
cd ros2_ws && colcon build --packages-select amrdetail_safety
source install/setup.bash
ros2 launch amrdetail_safety safety.launch.py --show-args
```
Expected: 1 package finished; `--show-args` prints `use_sim_time`.

- [ ] **Step 6: Commit**

```bash
cd ..
git add ros2_ws/src/amrdetail_safety
git commit -m "feat(ros2): add amrdetail_safety twist_mux cmd_vel priority"
```

---

### Task 3: Integrate SLAM + twist_mux into `sim.launch.py`

**Files:**
- Modify: `ros2_ws/src/amrdetail_bringup/launch/sim.launch.py`
- Modify: `ros2_ws/src/amrdetail_bringup/package.xml` (add exec_depends)

- [ ] **Step 1: Add exec_depends to `amrdetail_bringup/package.xml`**

Add inside `<package>` next to the existing `<exec_depend>` lines:

```xml
  <exec_depend>amrdetail_slam</exec_depend>
  <exec_depend>amrdetail_safety</exec_depend>
```

- [ ] **Step 2: Replace `amrdetail_bringup/launch/sim.launch.py`**

```python
"""Launch Gazebo turtlebot3_world + rosbridge + slam_toolbox + twist_mux (Milestone 1B)."""

from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription, DeclareLaunchArgument
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare


def generate_launch_description() -> LaunchDescription:
    use_sim_time = LaunchConfiguration("use_sim_time")

    turtlebot3_gazebo_launch = PathJoinSubstitution(
        [FindPackageShare("turtlebot3_gazebo"), "launch", "turtlebot3_world.launch.py"]
    )
    slam_launch = PathJoinSubstitution(
        [FindPackageShare("amrdetail_slam"), "launch", "slam.launch.py"]
    )
    safety_launch = PathJoinSubstitution(
        [FindPackageShare("amrdetail_safety"), "launch", "safety.launch.py"]
    )

    return LaunchDescription(
        [
            DeclareLaunchArgument(
                "use_sim_time",
                default_value="true",
                description="Use simulation clock from Gazebo.",
            ),
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource([turtlebot3_gazebo_launch]),
            ),
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource([slam_launch]),
                launch_arguments={"use_sim_time": use_sim_time}.items(),
            ),
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource([safety_launch]),
                launch_arguments={"use_sim_time": use_sim_time}.items(),
            ),
            Node(
                package="rosbridge_server",
                executable="rosbridge_websocket",
                name="rosbridge_websocket",
                parameters=[{"use_sim_time": use_sim_time, "port": 9090}],
                output="screen",
            ),
        ]
    )
```

- [ ] **Step 3: Build affected packages**

```bash
cd ros2_ws && colcon build --packages-select amrdetail_bringup
source install/setup.bash
```
Expected: 1 package finished.

- [ ] **Step 4: Launch the full sim stack and verify SLAM + mux topics**

```bash
export TURTLEBOT3_MODEL=waffle_pi
ros2 launch amrdetail_bringup sim.launch.py
```
In a second shell:
```bash
source /opt/ros/humble/setup.bash && source ros2_ws/install/setup.bash
export ROS_DOMAIN_ID=30
ros2 topic list | grep -E "/map|/cmd_vel"
ros2 topic echo --once /map | head -5
```
Expected: `/map`, `/cmd_vel`, `/cmd_vel_teleop` present; `/map` echoes an OccupancyGrid (info + data). Drive test:
```bash
ros2 topic pub --once /cmd_vel_teleop geometry_msgs/msg/Twist '{linear: {x: 0.2}}'
```
Expected: robot moves in Gazebo (twist_mux forwards teleop → /cmd_vel). Stop the launch.

- [ ] **Step 5: Commit**

```bash
cd ..
git add ros2_ws/src/amrdetail_bringup
git commit -m "feat(ros2): wire slam_toolbox + twist_mux into sim.launch.py"
```

---

### Task 4: Bridge — Map File Utilities

**Files:**
- Create: `apps/bridge/src/services/__init__.py` (empty)
- Create: `apps/bridge/src/services/map_utils.py`
- Test: `apps/bridge/tests/test_map_utils.py`
- Modify: `apps/bridge/pyproject.toml` (add Pillow)

- [ ] **Step 1: Add Pillow to `pyproject.toml` dependencies**

In `[project].dependencies`, add:
```toml
  "pillow>=10.4",
```
Then:
```bash
cd apps/bridge && uv sync
```

- [ ] **Step 2: Write failing tests `apps/bridge/tests/test_map_utils.py`**

```python
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
```

- [ ] **Step 3: Run tests, verify they fail**

```bash
uv run pytest tests/test_map_utils.py -v
```
Expected: ImportError / module `services.map_utils` not found.

- [ ] **Step 4: Implement `apps/bridge/src/services/map_utils.py`**

```python
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
```

> Note: `yaml` comes from PyYAML, a transitive dep of many ROS/uvicorn stacks; if `uv run pytest` reports it missing, add `"pyyaml>=6.0"` to `pyproject.toml` dependencies and `uv sync`.

- [ ] **Step 5: Run tests, verify they pass**

```bash
uv run pytest tests/test_map_utils.py -v
```
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
cd ../..
git add apps/bridge/src/services apps/bridge/pyproject.toml apps/bridge/uv.lock apps/bridge/tests/test_map_utils.py
git commit -m "feat(bridge): add map file utils (yaml parse, pgm size, thumbnail)"
```

---

### Task 5: Bridge — `MapService` (save via map_saver_cli + Prisma)

**Files:**
- Create: `apps/bridge/src/services/map_service.py`
- Test: `apps/bridge/tests/test_map_service.py`

- [ ] **Step 1: Write failing test `apps/bridge/tests/test_map_service.py`**

```python
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
        self._rows.append(data["data"])
        row = MagicMock()
        for k, v in data["data"].items():
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
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
cd apps/bridge && uv run pytest tests/test_map_service.py -v
```
Expected: ImportError for `services.map_service`.

- [ ] **Step 3: Implement `apps/bridge/src/services/map_service.py`**

```python
"""Map persistence: save the live /map to pgm/yaml, thumbnail it, and record metadata."""

import asyncio
import io
import os
import shutil
import zipfile
from pathlib import Path

from cuid import cuid  # provided by prisma-client-py deps; if missing see note below

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
            raise MapSaveError(f"map_saver_cli failed: {stderr.decode(errors='ignore')[:400]}")

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
```

> Note: if `from cuid import cuid` is unavailable in the venv, replace the import with a tiny id helper:
> ```python
> import secrets
> def cuid() -> str:
>     return "c" + secrets.token_hex(12)
> ```
> The DB column is a free-form String id, so any unique string works.

- [ ] **Step 4: Run tests, verify they pass**

```bash
uv run pytest tests/test_map_service.py -v
```
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
cd ../..
git add apps/bridge/src/services/map_service.py apps/bridge/tests/test_map_service.py
git commit -m "feat(bridge): add MapService save/list/activate/delete/export"
```

---

### Task 6: Bridge — `/maps` API Router

**Files:**
- Create: `apps/bridge/src/api/maps.py`
- Modify: `apps/bridge/src/main.py`
- Test: `apps/bridge/tests/test_maps_api.py`

- [ ] **Step 1: Write failing test `apps/bridge/tests/test_maps_api.py`**

```python
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
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
cd apps/bridge && uv run pytest tests/test_maps_api.py -v
```
Expected: ImportError for `api.maps`.

- [ ] **Step 3: Implement `apps/bridge/src/api/maps.py`**

```python
"""HTTP endpoints for map management. Next.js reaches map state only through here."""

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from services.map_service import MapService, MapSaveError

router = APIRouter(prefix="/maps", tags=["maps"])

# Overridden in tests via app.dependency_overrides.
_service_singleton: MapService | None = None


def get_map_service() -> MapService:
    global _service_singleton
    if _service_singleton is None:
        from prisma import Prisma  # imported lazily; requires generated client at runtime

        _service_singleton = MapService(db=Prisma())
    return _service_singleton


class SaveMapRequest(BaseModel):
    name: str


def _serialize(m) -> dict:
    return {
        "id": m.id,
        "name": m.name,
        "thumbnail": m.thumbnail,
        "resolution": m.resolution,
        "width": m.width,
        "height": m.height,
        "originX": m.originX,
        "originY": m.originY,
        "isActive": m.isActive,
        "createdAt": str(m.createdAt),
    }


@router.get("")
async def list_maps(svc: MapService = Depends(get_map_service)):
    return [_serialize(m) for m in await svc.list()]


@router.get("/active")
async def active_map(svc: MapService = Depends(get_map_service)):
    m = await svc.get_active()
    return _serialize(m) if m else None


@router.post("/save")
async def save_map(req: SaveMapRequest, svc: MapService = Depends(get_map_service)):
    try:
        m = await svc.save(req.name)
    except MapSaveError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return _serialize(m)


@router.post("/{map_id}/activate")
async def activate_map(map_id: str, svc: MapService = Depends(get_map_service)):
    return _serialize(await svc.activate(map_id))


@router.delete("/{map_id}")
async def delete_map(map_id: str, svc: MapService = Depends(get_map_service)):
    row = await svc.delete(map_id)
    if row is None:
        raise HTTPException(status_code=404, detail="map not found")
    return {"deleted": map_id}


@router.get("/{map_id}/export")
async def export_map(map_id: str, svc: MapService = Depends(get_map_service)):
    data = await svc.export_zip(map_id)
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{map_id}.zip"'},
    )
```

- [ ] **Step 4: Register the router in `apps/bridge/src/main.py`**

Add import and include after the health router:
```python
from api import health, maps
```
```python
    app.include_router(health.router, tags=["system"])
    app.include_router(maps.router)
```

- [ ] **Step 5: Run tests, verify they pass**

```bash
uv run pytest tests/test_maps_api.py -v
```
Expected: 3 passed.

- [ ] **Step 6: Run the full bridge test suite**

```bash
uv run pytest -v
```
Expected: all green (health + map_utils + map_service + maps_api).

- [ ] **Step 7: Commit**

```bash
cd ../..
git add apps/bridge/src/api/maps.py apps/bridge/src/main.py apps/bridge/tests/test_maps_api.py
git commit -m "feat(bridge): add /maps API router"
```

---

### Task 7: Web — OccupancyGrid → RGBA Utility

**Files:**
- Create: `apps/web/lib/occupancy-grid.ts`
- Test: `apps/web/tests/occupancy-grid.test.ts`

- [ ] **Step 1: Write failing test `apps/web/tests/occupancy-grid.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { occupancyGridToRGBA } from "@/lib/occupancy-grid"

describe("occupancyGridToRGBA", () => {
  it("maps unknown(-1)→gray, free(0)→white, occupied(100)→black", () => {
    const rgba = occupancyGridToRGBA([-1, 0, 100], 3, 1)
    expect(Array.from(rgba.slice(0, 4))).toEqual([127, 127, 127, 255]) // unknown
    expect(Array.from(rgba.slice(4, 8))).toEqual([255, 255, 255, 255]) // free
    expect(Array.from(rgba.slice(8, 12))).toEqual([0, 0, 0, 255]) // occupied
  })

  it("produces width*height*4 bytes", () => {
    const rgba = occupancyGridToRGBA(new Array(80 * 60).fill(0), 80, 60)
    expect(rgba.length).toBe(80 * 60 * 4)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd apps/web && pnpm exec vitest run tests/occupancy-grid.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/lib/occupancy-grid.ts`**

```ts
/**
 * Convert a nav_msgs/OccupancyGrid `data` array (row-major, values -1..100)
 * into an RGBA buffer suitable for ImageData. -1=unknown(gray), 0=free(white),
 * higher=darker, 100=occupied(black).
 */
export function occupancyGridToRGBA(
  data: number[],
  width: number,
  height: number,
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const v = data[i]
    let shade: number
    if (v < 0) {
      shade = 127 // unknown
    } else {
      shade = Math.round(255 - (Math.min(100, v) / 100) * 255) // 0→255(white), 100→0(black)
    }
    const o = i * 4
    rgba[o] = shade
    rgba[o + 1] = shade
    rgba[o + 2] = shade
    rgba[o + 3] = 255
  }
  return rgba
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm exec vitest run tests/occupancy-grid.test.ts
```
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
cd ../..
git add apps/web/lib/occupancy-grid.ts apps/web/tests/occupancy-grid.test.ts
git commit -m "feat(web): add occupancy-grid RGBA utility"
```

---

### Task 8: Web — `createPublisher` in ros-client

**Files:**
- Modify: `apps/web/lib/ros-client.ts`
- Test: `apps/web/tests/ros-client.test.ts` (extend)

- [ ] **Step 1: Extend the mock + add a failing test in `apps/web/tests/ros-client.test.ts`**

Append a new `describe` block at the end (the FakeTopic mock from the existing Task-12 test may already exist — if so, extend it to record `publish` calls; otherwise add):

```ts
describe("createPublisher", () => {
  it("advertises a topic and publishes wrapped messages", async () => {
    const published: unknown[] = []
    const ROSLIB = (await import("roslib")) as unknown as {
      Topic: new (o: unknown) => { publish: (m: unknown) => void; unadvertise: () => void }
      Message: new (v: unknown) => unknown
    }
    class FakeTopic {
      constructor(_o: unknown) {}
      publish(m: unknown) {
        published.push(m)
      }
      unadvertise() {}
    }
    ;(ROSLIB as { Topic: typeof FakeTopic }).Topic = FakeTopic
    ;(ROSLIB as { Message: new (v: unknown) => unknown }).Message = class {
      constructor(public v: unknown) {}
    }

    const { useRosStore, createPublisher } = await import("@/lib/ros-client")
    useRosStore.getState().connect("ws://localhost:9090")
    const ros = useRosStore.getState().ros as unknown as { fire: (e: string) => void }
    ros.fire("connection")

    const pub = createPublisher("/cmd_vel_teleop", "geometry_msgs/msg/Twist")
    pub.publish({ linear: { x: 1, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0 } })
    expect(published).toHaveLength(1)
    pub.close()
  })
})
```

> The existing `roslib` mock in this file mocks `Ros`. Ensure the mock object also exposes assignable `Topic` and `Message` properties (the test assigns them above). If the top-level `vi.mock("roslib", …)` returns a frozen object, update it to a plain mutable object exporting `Ros`, `Topic`, `Message`.

- [ ] **Step 2: Run test, verify it fails**

```bash
cd apps/web && pnpm exec vitest run tests/ros-client.test.ts -t "createPublisher"
```
Expected: FAIL — `createPublisher` is not a function.

- [ ] **Step 3: Add `createPublisher` to `apps/web/lib/ros-client.ts`**

Change the import line:
```ts
import { Ros, Topic, Message } from "roslib"
```
Append at the end of the file:
```ts
export interface Publisher<T> {
  publish: (msg: T) => void
  close: () => void
}

/**
 * Create a publisher on the active rosbridge connection. Returns a no-op
 * publisher if not connected yet.
 */
export function createPublisher<T extends Record<string, unknown>>(
  name: string,
  messageType: string,
): Publisher<T> {
  const ros = useRosStore.getState().ros
  if (!ros) return { publish: () => {}, close: () => {} }

  const topic = new Topic({ ros, name, messageType })
  return {
    publish: (msg: T) => topic.publish(new Message(msg)),
    close: () => topic.unadvertise(),
  }
}
```

- [ ] **Step 4: Run tests, verify all pass**

```bash
pnpm exec vitest run tests/ros-client.test.ts
```
Expected: all ros-client tests pass (existing + createPublisher).

- [ ] **Step 5: Commit**

```bash
cd ../..
git add apps/web/lib/ros-client.ts apps/web/tests/ros-client.test.ts
git commit -m "feat(web): add createPublisher to ros-client"
```

---

### Task 9: Web — Teleop → Twist Utility

**Files:**
- Create: `apps/web/lib/teleop.ts`
- Test: `apps/web/tests/teleop.test.ts`

- [ ] **Step 1: Write failing test `apps/web/tests/teleop.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { keysToTwist, vectorToTwist, LINEAR_SPEED, ANGULAR_SPEED } from "@/lib/teleop"

describe("keysToTwist", () => {
  it("returns zero twist for no keys", () => {
    const t = keysToTwist(new Set())
    expect(t.linear.x).toBe(0)
    expect(t.angular.z).toBe(0)
  })
  it("w drives forward, a turns left", () => {
    const t = keysToTwist(new Set(["w", "a"]))
    expect(t.linear.x).toBeCloseTo(LINEAR_SPEED)
    expect(t.angular.z).toBeCloseTo(ANGULAR_SPEED)
  })
  it("w+s cancel out", () => {
    expect(keysToTwist(new Set(["w", "s"])).linear.x).toBe(0)
  })
})

describe("vectorToTwist", () => {
  it("maps joystick up to forward, right to clockwise", () => {
    const t = vectorToTwist({ x: 0, y: 1 }) // up
    expect(t.linear.x).toBeCloseTo(LINEAR_SPEED)
    const r = vectorToTwist({ x: 1, y: 0 }) // right
    expect(r.angular.z).toBeCloseTo(-ANGULAR_SPEED)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd apps/web && pnpm exec vitest run tests/teleop.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/lib/teleop.ts`**

```ts
export interface Vec3 {
  x: number
  y: number
  z: number
}
export interface Twist {
  linear: Vec3
  angular: Vec3
}

// TurtleBot3 Waffle Pi safe limits.
export const LINEAR_SPEED = 0.22 // m/s
export const ANGULAR_SPEED = 1.0 // rad/s

function twist(lin: number, ang: number): Twist {
  return { linear: { x: lin, y: 0, z: 0 }, angular: { x: 0, y: 0, z: ang } }
}

/** WASD set → Twist. w/s forward/back, a/d turn left/right. */
export function keysToTwist(keys: Set<string>): Twist {
  let lin = 0
  let ang = 0
  if (keys.has("w")) lin += LINEAR_SPEED
  if (keys.has("s")) lin -= LINEAR_SPEED
  if (keys.has("a")) ang += ANGULAR_SPEED
  if (keys.has("d")) ang -= ANGULAR_SPEED
  return twist(lin, ang)
}

/** Joystick vector (x right, y up; each -1..1) → Twist. */
export function vectorToTwist(v: { x: number; y: number }): Twist {
  return twist(v.y * LINEAR_SPEED, -v.x * ANGULAR_SPEED)
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm exec vitest run tests/teleop.test.ts
```
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
cd ../..
git add apps/web/lib/teleop.ts apps/web/tests/teleop.test.ts
git commit -m "feat(web): add teleop twist utilities"
```

---

### Task 10: Web — Maps HTTP Client

**Files:**
- Create: `apps/web/lib/maps-api.ts`
- Test: `apps/web/tests/maps-api.test.ts`

- [ ] **Step 1: Write failing test `apps/web/tests/maps-api.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { getMaps, saveMap, activateMap, deleteMap, exportMapUrl } from "@/lib/maps-api"

describe("maps-api", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("getMaps GETs /maps", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [{ id: "m1" }] })
    vi.stubGlobal("fetch", fetchMock)
    const maps = await getMaps()
    expect(maps[0].id).toBe("m1")
    expect(fetchMock.mock.calls[0][0]).toContain("/maps")
  })

  it("saveMap POSTs name", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ id: "m2" }) })
    vi.stubGlobal("fetch", fetchMock)
    const m = await saveMap("새맵")
    expect(m.id).toBe("m2")
    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body)).toEqual({ name: "새맵" })
  })

  it("throws on non-ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({}) }),
    )
    await expect(saveMap("dup")).rejects.toThrow(/409/)
  })

  it("exportMapUrl builds a URL", () => {
    expect(exportMapUrl("m1")).toContain("/maps/m1/export")
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cd apps/web && pnpm exec vitest run tests/maps-api.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/lib/maps-api.ts`**

```ts
export interface MapMeta {
  id: string
  name: string
  thumbnail: string | null
  resolution: number
  width: number
  height: number
  originX: number
  originY: number
  isActive: boolean
  createdAt: string
}

const BASE = process.env.NEXT_PUBLIC_BRIDGE_URL ?? "http://localhost:8000"

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`request failed: ${res.status}`)
  return (await res.json()) as T
}

export async function getMaps(): Promise<MapMeta[]> {
  return json<MapMeta[]>(await fetch(`${BASE}/maps`))
}

export async function getActiveMap(): Promise<MapMeta | null> {
  return json<MapMeta | null>(await fetch(`${BASE}/maps/active`))
}

export async function saveMap(name: string): Promise<MapMeta> {
  return json<MapMeta>(
    await fetch(`${BASE}/maps/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  )
}

export async function activateMap(id: string): Promise<MapMeta> {
  return json<MapMeta>(await fetch(`${BASE}/maps/${id}/activate`, { method: "POST" }))
}

export async function deleteMap(id: string): Promise<void> {
  const res = await fetch(`${BASE}/maps/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error(`delete failed: ${res.status}`)
}

export function exportMapUrl(id: string): string {
  return `${BASE}/maps/${id}/export`
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm exec vitest run tests/maps-api.test.ts
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
cd ../..
git add apps/web/lib/maps-api.ts apps/web/tests/maps-api.test.ts
git commit -m "feat(web): add maps HTTP client"
```

---

### Task 11: Web — `MapCanvas` (react-konva)

**Files:**
- Modify: `apps/web/package.json` (add deps)
- Create: `apps/web/components/map/MapCanvas.tsx`

- [ ] **Step 1: Add dependencies**

```bash
pnpm --filter @amrdetail/web add konva react-konva nipplejs
```

- [ ] **Step 2: Create `apps/web/components/map/MapCanvas.tsx`**

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { Stage, Layer, Image as KonvaImage, Circle } from "react-konva"
import { subscribeTopic } from "@/lib/ros-client"
import { occupancyGridToRGBA } from "@/lib/occupancy-grid"

interface OccupancyGridMsg {
  info: {
    width: number
    height: number
    resolution: number
    origin: { position: { x: number; y: number } }
  }
  data: number[]
}
interface OdomMsg {
  pose: { pose: { position: { x: number; y: number } } }
}

const VIEW = 480 // px square viewport

export function MapCanvas() {
  const [bitmap, setBitmap] = useState<HTMLCanvasElement | null>(null)
  const [grid, setGrid] = useState<OccupancyGridMsg["info"] | null>(null)
  const [robot, setRobot] = useState<{ x: number; y: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const unsub = subscribeTopic<OccupancyGridMsg>(
      "/map",
      "nav_msgs/msg/OccupancyGrid",
      (msg) => {
        const { width, height } = msg.info
        if (width === 0 || height === 0) return
        const cv = canvasRef.current ?? document.createElement("canvas")
        cv.width = width
        cv.height = height
        const ctx = cv.getContext("2d")
        if (!ctx) return
        const rgba = occupancyGridToRGBA(msg.data, width, height)
        ctx.putImageData(new ImageData(rgba, width, height), 0, 0)
        canvasRef.current = cv
        setBitmap(cv)
        setGrid(msg.info)
      },
    )
    return unsub
  }, [])

  useEffect(() => {
    const unsub = subscribeTopic<OdomMsg>("/odom", "nav_msgs/msg/Odometry", (m) =>
      setRobot({ x: m.pose.pose.position.x, y: m.pose.pose.position.y }),
    )
    return unsub
  }, [])

  if (!bitmap || !grid) {
    return <p className="text-neutral-400">/map 토픽 수신 대기 중…</p>
  }

  // Fit the grid into the square viewport; OccupancyGrid origin is bottom-left,
  // so flip vertically (scaleY -1) to match screen coordinates.
  const scale = Math.min(VIEW / grid.width, VIEW / grid.height)
  const toPx = (wx: number, wy: number) => ({
    x: ((wx - grid.origin.position.x) / grid.resolution) * scale,
    y: VIEW - ((wy - grid.origin.position.y) / grid.resolution) * scale,
  })

  return (
    <Stage width={VIEW} height={VIEW} className="rounded border border-neutral-200 bg-neutral-100">
      <Layer>
        <KonvaImage image={bitmap} scaleX={scale} scaleY={-scale} y={VIEW} />
        {robot && (() => {
          const p = toPx(robot.x, robot.y)
          return <Circle x={p.x} y={p.y} radius={6} fill="#2563eb" stroke="#fff" strokeWidth={2} />
        })()}
      </Layer>
    </Stage>
  )
}
```

> Konva needs `window`; this component is `"use client"` and is mounted via `next/dynamic` with `ssr:false` in Task 13.

- [ ] **Step 3: Verify it type-checks / builds**

```bash
cd apps/web && pnpm exec tsc --noEmit
```
Expected: no type errors (no `any`). 

- [ ] **Step 4: Commit**

```bash
cd ../..
git add apps/web/package.json pnpm-lock.yaml apps/web/components/map/MapCanvas.tsx
git commit -m "feat(web): add MapCanvas (react-konva occupancy grid + robot marker)"
```

---

### Task 12: Web — Teleop, MappingStatus, SaveMapPanel Components

**Files:**
- Create: `apps/web/components/map/Teleop.tsx`
- Create: `apps/web/components/map/MappingStatus.tsx`
- Create: `apps/web/components/map/SaveMapPanel.tsx`

- [ ] **Step 1: Create `apps/web/components/map/Teleop.tsx`**

```tsx
"use client"

import { useEffect, useRef } from "react"
import nipplejs from "nipplejs"
import { createPublisher } from "@/lib/ros-client"
import { keysToTwist, vectorToTwist, type Twist } from "@/lib/teleop"

export function Teleop() {
  const zoneRef = useRef<HTMLDivElement | null>(null)
  const keys = useRef<Set<string>>(new Set())

  useEffect(() => {
    const pub = createPublisher<Record<string, unknown>>(
      "/cmd_vel_teleop",
      "geometry_msgs/msg/Twist",
    )
    const send = (t: Twist) => pub.publish(t as unknown as Record<string, unknown>)

    // Keyboard
    const down = (e: KeyboardEvent) => {
      if (["w", "a", "s", "d"].includes(e.key)) {
        keys.current.add(e.key)
        send(keysToTwist(keys.current))
      }
    }
    const up = (e: KeyboardEvent) => {
      if (keys.current.delete(e.key)) send(keysToTwist(keys.current))
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)

    // Joystick
    const manager = zoneRef.current
      ? nipplejs.create({ zone: zoneRef.current, mode: "static", position: { left: "50%", top: "50%" } })
      : null
    manager?.on("move", (_e, d) => {
      const angle = d.angle?.radian ?? 0
      const force = Math.min(1, d.force ?? 0)
      send(vectorToTwist({ x: Math.cos(angle) * force, y: Math.sin(angle) * force }))
    })
    manager?.on("end", () => send(vectorToTwist({ x: 0, y: 0 })))

    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      manager?.destroy()
      send({ linear: { x: 0, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0 } })
      pub.close()
    }
  }, [])

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-neutral-500">조작 (WASD / 조이스틱)</div>
      <div ref={zoneRef} className="relative h-32 w-full rounded bg-neutral-100" />
    </div>
  )
}
```

- [ ] **Step 2: Create `apps/web/components/map/MappingStatus.tsx`**

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { subscribeTopic, useRosStore } from "@/lib/ros-client"

interface OdomMsg {
  pose: { pose: { position: { x: number; y: number } } }
}

export function MappingStatus() {
  const status = useRosStore((s) => s.status)
  const [pose, setPose] = useState<{ x: number; y: number } | null>(null)
  const [hz, setHz] = useState(0)
  const ticks = useRef<number[]>([])

  useEffect(() => {
    const unsubOdom = subscribeTopic<OdomMsg>("/odom", "nav_msgs/msg/Odometry", (m) =>
      setPose({ x: m.pose.pose.position.x, y: m.pose.pose.position.y }),
    )
    const unsubMap = subscribeTopic<unknown>("/map", "nav_msgs/msg/OccupancyGrid", () => {
      const now = Date.now()
      ticks.current = [...ticks.current, now].filter((t) => now - t < 5000)
      setHz(Number((ticks.current.length / 5).toFixed(1)))
    })
    return () => {
      unsubOdom()
      unsubMap()
    }
  }, [])

  return (
    <div className="space-y-1 font-mono text-xs text-neutral-600">
      <div>연결: {status}</div>
      <div>/map: {hz} Hz</div>
      <div>x: {pose ? pose.x.toFixed(3) : "—"} m</div>
      <div>y: {pose ? pose.y.toFixed(3) : "—"} m</div>
    </div>
  )
}
```

- [ ] **Step 3: Create `apps/web/components/map/SaveMapPanel.tsx`**

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { saveMap } from "@/lib/maps-api"

export function SaveMapPanel() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await saveMap(name.trim())
      router.push("/maps")
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <input
        className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        placeholder="맵 이름"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button
        className="w-full rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        onClick={onSave}
        disabled={saving || !name.trim()}
      >
        {saving ? "저장 중…" : "맵 저장"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Type-check**

```bash
cd apps/web && pnpm exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd ../..
git add apps/web/components/map/Teleop.tsx apps/web/components/map/MappingStatus.tsx apps/web/components/map/SaveMapPanel.tsx
git commit -m "feat(web): add Teleop, MappingStatus, SaveMapPanel components"
```

---

### Task 13: Web — Map Builder Page (`/map/new`, layout B)

**Files:**
- Create: `apps/web/app/map/new/page.tsx`

- [ ] **Step 1: Create `apps/web/app/map/new/page.tsx`**

```tsx
"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { RosStatus } from "@/components/ros/RosStatus"
import { Teleop } from "@/components/map/Teleop"
import { MappingStatus } from "@/components/map/MappingStatus"
import { SaveMapPanel } from "@/components/map/SaveMapPanel"

// Konva needs window — load the canvas client-only.
const MapCanvas = dynamic(
  () => import("@/components/map/MapCanvas").then((m) => m.MapCanvas),
  { ssr: false, loading: () => <p className="text-neutral-400">맵 로딩 중…</p> },
)

export default function MapBuilderPage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-neutral-500 hover:underline">
            ← 대시보드
          </Link>
          <h1 className="text-xl font-semibold">맵 빌더</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded bg-blue-500 px-2 py-0.5 font-mono text-xs text-white">SIM</span>
          <RosStatus />
        </div>
      </header>

      {/* Layout B: 좌측 맵 + 우측 사이드바. 각 패널은 독립 컴포넌트라 배치 변경 쉬움. */}
      <section className="flex flex-col gap-4 p-6 lg:flex-row">
        <div className="flex-1 rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-neutral-500">실시간 맵</h2>
          <MapCanvas />
        </div>
        <aside className="flex w-full flex-col gap-4 lg:w-72">
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <Teleop />
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-medium text-neutral-500">매핑 상태</h2>
            <MappingStatus />
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-medium text-neutral-500">맵 저장</h2>
            <SaveMapPanel />
          </div>
        </aside>
      </section>
    </main>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
cd apps/web && pnpm build
```
Expected: compiles; `/map/new` appears in the route table.

- [ ] **Step 3: Commit**

```bash
cd ../..
git add apps/web/app/map
git commit -m "feat(web): add map builder page (/map/new, layout B)"
```

---

### Task 14: Web — Map Management Page (`/maps`)

**Files:**
- Create: `apps/web/components/map/MapCard.tsx`
- Create: `apps/web/components/map/MapList.tsx`
- Create: `apps/web/app/maps/page.tsx`

- [ ] **Step 1: Create `apps/web/components/map/MapCard.tsx`**

```tsx
"use client"

import type { MapMeta } from "@/lib/maps-api"
import { exportMapUrl } from "@/lib/maps-api"

export function MapCard({
  map,
  onActivate,
  onDelete,
}: {
  map: MapMeta
  onActivate: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="mb-2 flex h-32 items-center justify-center rounded bg-neutral-100 text-neutral-400">
        {/* 썸네일은 bridge가 파일경로로 보관 — MVP에선 placeholder, 정적 서빙은 후속 */}
        🗺️ {map.width}×{map.height}
      </div>
      <div className="flex items-center justify-between">
        <span className="font-medium">{map.name}</span>
        {map.isActive && (
          <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">활성</span>
        )}
      </div>
      <div className="mt-1 text-xs text-neutral-500">
        {new Date(map.createdAt).toLocaleString()} · {map.resolution} m/px
      </div>
      <div className="mt-3 flex gap-2 text-sm">
        <button
          className="rounded bg-blue-600 px-2 py-1 text-white disabled:opacity-50"
          onClick={() => onActivate(map.id)}
          disabled={map.isActive}
        >
          활성화
        </button>
        <a className="rounded border border-neutral-300 px-2 py-1" href={exportMapUrl(map.id)}>
          내보내기
        </a>
        <button className="rounded border border-red-300 px-2 py-1 text-red-600" onClick={() => onDelete(map.id)}>
          삭제
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `apps/web/components/map/MapList.tsx`**

```tsx
"use client"

import { useEffect, useState } from "react"
import { getMaps, activateMap, deleteMap, type MapMeta } from "@/lib/maps-api"
import { MapCard } from "@/components/map/MapCard"

export function MapList() {
  const [maps, setMaps] = useState<MapMeta[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    try {
      setMaps(await getMaps())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }
  useEffect(() => {
    refresh()
  }, [])

  const onActivate = async (id: string) => {
    await activateMap(id)
    refresh()
  }
  const onDelete = async (id: string) => {
    await deleteMap(id)
    refresh()
  }

  if (error) return <p className="text-red-600">맵을 불러오지 못했습니다: {error}</p>
  if (maps.length === 0) return <p className="text-neutral-400">아직 저장된 맵이 없습니다.</p>

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {maps.map((m) => (
        <MapCard key={m.id} map={m} onActivate={onActivate} onDelete={onDelete} />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create `apps/web/app/maps/page.tsx`**

```tsx
import Link from "next/link"
import { MapList } from "@/components/map/MapList"

export default function MapsPage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-neutral-500 hover:underline">← 대시보드</Link>
          <h1 className="text-xl font-semibold">맵 관리</h1>
        </div>
        <Link href="/map/new" className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">
          + 새 맵 만들기
        </Link>
      </header>
      <section className="p-6">
        <MapList />
      </section>
    </main>
  )
}
```

- [ ] **Step 4: Verify build**

```bash
cd apps/web && pnpm build
```
Expected: `/maps` in route table, no errors.

- [ ] **Step 5: Commit**

```bash
cd ../..
git add apps/web/components/map/MapCard.tsx apps/web/components/map/MapList.tsx apps/web/app/maps
git commit -m "feat(web): add map management page (/maps)"
```

---

### Task 15: Web — Dashboard "현재 맵" + Navigation Links

**Files:**
- Modify: `apps/web/app/page.tsx`
- Create: `apps/web/components/map/ActiveMapCard.tsx`

- [ ] **Step 1: Create `apps/web/components/map/ActiveMapCard.tsx`**

```tsx
"use client"

import { useEffect, useState } from "react"
import { getActiveMap, type MapMeta } from "@/lib/maps-api"

export function ActiveMapCard() {
  const [map, setMap] = useState<MapMeta | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getActiveMap()
      .then(setMap)
      .catch(() => setMap(null))
      .finally(() => setLoaded(true))
  }, [])

  if (!loaded) return <p className="text-neutral-400">불러오는 중…</p>
  if (!map) return <p className="text-neutral-400">활성화된 맵이 없습니다.</p>
  return (
    <div>
      <p className="font-medium">{map.name}</p>
      <p className="text-xs text-neutral-500">
        {map.width}×{map.height} · {map.resolution} m/px
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Update `apps/web/app/page.tsx`**

Replace the "현재 맵" card body and the "빠른 작업" list to add links. New file content:

```tsx
import Link from "next/link"
import { RosStatus } from "@/components/ros/RosStatus"
import { OdomReadout } from "@/components/ros/OdomReadout"
import { ActiveMapCard } from "@/components/map/ActiveMapCard"

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <h1 className="text-xl font-semibold">AMRDetail</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded bg-blue-500 px-2 py-0.5 font-mono text-xs text-white">SIM</span>
          <RosStatus />
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-neutral-500">현재 맵</h2>
          <ActiveMapCard />
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-neutral-500">빠른 작업</h2>
          <ul className="space-y-1 text-sm">
            <li>
              <Link href="/map/new" className="text-blue-600 hover:underline">🗺️ 새 맵 만들기</Link>
            </li>
            <li>
              <Link href="/maps" className="text-blue-600 hover:underline">🗂️ 맵 관리</Link>
            </li>
            <li className="text-neutral-400">🎯 자율주행 시작 (Milestone 1C)</li>
            <li className="text-neutral-400">📋 미션 히스토리 (Milestone 1C)</li>
          </ul>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4 md:col-span-2">
          <h2 className="mb-2 text-sm font-medium text-neutral-500">시스템 상태</h2>
          <OdomReadout />
        </div>
      </section>
    </main>
  )
}
```

- [ ] **Step 3: Run web tests + build**

```bash
cd apps/web && pnpm exec vitest run && pnpm build
```
Expected: all vitest pass; build succeeds.

- [ ] **Step 4: Commit**

```bash
cd ../..
git add apps/web/app/page.tsx apps/web/components/map/ActiveMapCard.tsx
git commit -m "feat(web): dashboard active-map card + nav links"
```

---

### Task 16: End-to-End Verification (sim) + Milestone Tag

**Goal:** Confirm the 1B completion criteria in a running sim.

- [ ] **Step 1: Install ROS prereqs (once)**

```bash
sudo apt install -y ros-humble-slam-toolbox ros-humble-twist-mux ros-humble-nav2-map-server
```

- [ ] **Step 2: Build the workspace**

```bash
cd ros2_ws && colcon build && source install/setup.bash && cd ..
```

- [ ] **Step 3: Launch the full stack**

```bash
./scripts/amrdetail-launch sim
```
> If the bridge port 8000 is occupied (Apache in some WSL setups), use `BRIDGE_PORT=8010 ./scripts/amrdetail-launch sim` and set `NEXT_PUBLIC_BRIDGE_URL=http://localhost:8010` in `apps/web/.env.local`.

- [ ] **Step 4: Verify map building**

Open `http://localhost:3000/map/new`. Expected:
- "실시간 맵" shows the OccupancyGrid (grows as the robot moves).
- Drag the joystick / press WASD → robot moves in Gazebo, map fills in.
- 매핑 상태 shows `/map` Hz > 0 and live x/y.

- [ ] **Step 5: Verify save → manage → activate**

- Enter "회의실A", click 맵 저장 → redirected to `/maps`.
- `/maps` shows the new card. Click 활성화.
- Open `/` (dashboard) → "현재 맵" shows "회의실A".
- Confirm files exist:
```bash
ls ~/.amrdetail/maps/*/
```
Expected: `map.pgm`, `map.yaml`, `thumb.png`.

- [ ] **Step 6: Verify reload across sessions**

Stop the stack (Ctrl+C), restart `./scripts/amrdetail-launch sim`, open `/maps`. Expected: "회의실A" still listed and active (DB persisted) — satisfies "다른 세션에서 로드".

- [ ] **Step 7: Run all tests**

```bash
pnpm test:web
(cd apps/bridge && uv run pytest -v)
```
Expected: all green.

- [ ] **Step 8: Tag the milestone**

```bash
git tag -a milestone-1b -m "Milestone 1B: SLAM + map management (sim)"
```
(Push with `git push origin main && git push origin milestone-1b` after user confirmation.)

---

## Completion Criteria Recap

1. `amrdetail-launch sim` brings up gazebo + slam_toolbox + twist_mux + rosbridge + bridge + web.
2. `/map/new` renders the live OccupancyGrid; teleop moves the robot and fills the map.
3. Saving writes pgm/yaml/thumbnail + DB row; `/maps` lists, activates, deletes, exports.
4. Active map persists across sessions and shows on the dashboard.
5. All vitest + pytest pass.

After this: **Milestone 1C (Nav2 + 자율주행 + 미션)** — re-run brainstorming → writing-plans scoped to 1C.
