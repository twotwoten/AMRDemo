# AMRDetail Setup Guide (Milestone 1A)

This guide gets a fresh machine to the point where `amrdetail-launch sim` opens Gazebo and the dashboard shows a live `/odom` readout.

Target completion time: **30 minutes** on a clean Ubuntu 22.04 system.

## 0. Prerequisites

You need **Ubuntu 22.04** (native or WSL2 with WSLg for Gazebo GUI).

If you're on Windows:
1. Enable WSL2 and install Ubuntu 22.04 from the Microsoft Store.
2. WSLg is included by default on Windows 11; on Windows 10, update WSL: `wsl --update`.
3. Run all commands below inside the Ubuntu shell.

## 1. Install ROS2 Humble

Follow the official guide: https://docs.ros.org/en/humble/Installation/Ubuntu-Install-Debs.html

Quick version:
```bash
sudo apt update && sudo apt install -y curl gnupg lsb-release software-properties-common
sudo add-apt-repository universe
sudo curl -sSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.key \
  -o /usr/share/keyrings/ros-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/ros-archive-keyring.gpg] http://packages.ros.org/ros2/ubuntu $(lsb_release -cs) main" \
  | sudo tee /etc/apt/sources.list.d/ros2.list > /dev/null
sudo apt update
sudo apt install -y ros-humble-desktop python3-colcon-common-extensions
echo 'source /opt/ros/humble/setup.bash' >> ~/.bashrc
source ~/.bashrc
```

Verify:
```bash
ros2 --help
```

## 2. Install AMRDetail dependencies

```bash
sudo apt install -y \
  ros-humble-turtlebot3 \
  ros-humble-turtlebot3-simulations \
  ros-humble-turtlebot3-gazebo \
  ros-humble-rosbridge-suite \
  ros-humble-rmw-cyclonedds-cpp \
  libxml2-utils
echo 'export TURTLEBOT3_MODEL=waffle_pi' >> ~/.bashrc
source ~/.bashrc
```

## 3. Install Node 20 + pnpm

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable
corepack prepare pnpm@9.12.0 --activate
```

Verify:
```bash
node --version    # v20.x
pnpm --version    # 9.12.0
```

## 4. Install uv (Python package manager)

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc
```

Verify:
```bash
uv --version
```

## 5. Clone and configure AMRDetail

```bash
git clone https://github.com/twotwoten/AMRDemo.git
cd AMRDemo
cp .env.example .env.local
```

## 6. Build the Node and Python workspaces

```bash
pnpm install
(cd apps/bridge && uv sync && DATABASE_URL=file:./prisma/dev.db uv run prisma migrate dev --name init)
```

## 7. Build the ROS2 workspace

```bash
cd ros2_ws
colcon build
source install/setup.bash
cd ..
```

## 8. Launch the simulator

```bash
./scripts/amrdetail-launch sim
```

Expected:
- Gazebo opens with TurtleBot3 in `turtlebot3_world`.
- Logs show `Rosbridge WebSocket server started on port 9090`.
- Logs show `Uvicorn running on http://0.0.0.0:8000`.
- Logs show `Local: http://localhost:3000`.

Open http://localhost:3000 in your browser. You should see:
- `● Connected` in the header.
- Live `x:` and `y:` values under "시스템 상태".

## 9. Drive the robot (smoke test)

In a separate shell:
```bash
source /opt/ros/humble/setup.bash
ros2 run turtlebot3_teleop teleop_keyboard
```
Press `w` to drive forward. Confirm the dashboard's `x:` value updates.

## Troubleshooting

**Gazebo doesn't open (WSL2)**: Ensure WSLg works. From Ubuntu, try `xeyes` (`sudo apt install -y x11-apps`). If no window, update Windows + WSL.

**`● Disconnected` persists**: Confirm rosbridge is running with `ros2 node list | grep rosbridge`. If missing, the `sim.launch.py` may have failed — check the first shell for errors.

**Cyclone DDS warnings about interfaces**: Edit `configs/cyclonedds.xml` and replace `autodetermine="true"` with `name="eth0"` (or your interface name from `ip addr`).

**Port 9090/8000/3000 already in use**: `lsof -i :9090` to find the process, kill it, or change the port in the relevant config.
