# Milestone 1A — Infrastructure Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap an empty monorepo so that running `amrdetail-launch sim` brings up Gazebo with TurtleBot3, rosbridge, FastAPI, and a Next.js dashboard that shows "● Connected" and live `/odom` updates.

**Architecture:** pnpm workspaces monorepo with three apps — `apps/web` (Next.js 15 frontend), `apps/bridge` (FastAPI + Prisma), and `ros2_ws/` (ROS2 colcon workspace). A `scripts/amrdetail-launch` CLI wraps the launch sequence for both sim and real modes. Communication: browser ↔ FastAPI via HTTP, browser ↔ ROS2 via rosbridge WebSocket on port 9090.

**Tech Stack:**
- Node 20 + pnpm 9 + Next.js 15 + TypeScript 5 + Tailwind 3.4 + roslibjs
- Python 3.10 + uv + FastAPI + Prisma (Python client) + SQLite
- ROS2 Humble + Gazebo Classic + slam_toolbox + Nav2 + rosbridge_suite (later milestones)
- Ubuntu 22.04 (native or WSL2 — see `docs/setup-guide.md`)

**Reference spec:** `docs/superpowers/specs/2026-06-04-amr-detail-design.md`

**Environment notes:**
- All ROS2 / Gazebo / colcon commands MUST run on Ubuntu 22.04 (or WSL2 with WSLg).
- Node / Python / Next.js commands can run on Windows host, but Phase 2 (ZED, CUDA) will need Linux. Recommend everyone use Ubuntu/WSL2 from the start.
- Throughout this plan, "shell" means a bash shell on Ubuntu/WSL2.
- Per project CLAUDE.md: do NOT use `/dev/null` or `NUL` redirects.

---

## File Structure (created in this milestone)

```
AMRDetail/
├── package.json                            # Task 1 — monorepo root
├── pnpm-workspace.yaml                     # Task 1
├── .env.example                            # Task 1
├── .nvmrc                                  # Task 1
├── apps/
│   ├── web/                                # Task 2-4
│   │   ├── app/
│   │   │   ├── page.tsx                    # Task 3
│   │   │   ├── layout.tsx                  # (next-app default)
│   │   │   └── globals.css                 # (next-app default)
│   │   ├── components/ros/
│   │   │   ├── ROSProvider.tsx             # Task 4
│   │   │   └── RosStatus.tsx               # Task 4 + extended in Task 12
│   │   ├── lib/
│   │   │   └── ros-client.ts               # Task 4
│   │   ├── tests/
│   │   │   └── ros-client.test.ts          # Task 4
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tailwind.config.ts
│   └── bridge/                             # Task 5-6
│       ├── src/
│       │   ├── main.py                     # Task 5
│       │   └── api/
│       │       └── health.py               # Task 5
│       ├── prisma/
│       │   └── schema.prisma               # Task 6
│       ├── tests/
│       │   └── test_health.py              # Task 5
│       ├── pyproject.toml
│       └── .env.example
├── ros2_ws/                                # Task 7-9
│   └── src/
│       ├── amrdetail_msgs/                 # Task 8
│       │   ├── msg/
│       │   │   ├── Mission.msg
│       │   │   └── MissionStatus.msg
│       │   ├── CMakeLists.txt
│       │   └── package.xml
│       └── amrdetail_bringup/              # Task 9
│           ├── launch/
│           │   └── sim.launch.py
│           ├── CMakeLists.txt
│           └── package.xml
├── configs/                                # Task 10
│   └── cyclonedds.xml
├── scripts/                                # Task 11
│   └── amrdetail-launch
└── docs/
    └── setup-guide.md                      # Task 13
```

---

### Task 1: Monorepo Root Scaffold

**Goal:** Establish pnpm workspaces root with shared config files.

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.env.example`
- Create: `.nvmrc`

- [ ] **Step 1: Create `.nvmrc`**

```
20
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
```

- [ ] **Step 3: Create root `package.json`**

```json
{
  "name": "amrdetail",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "dev:web": "pnpm --filter @amrdetail/web dev",
    "build:web": "pnpm --filter @amrdetail/web build",
    "test:web": "pnpm --filter @amrdetail/web test",
    "lint:web": "pnpm --filter @amrdetail/web lint"
  },
  "devDependencies": {
    "typescript": "5.6.3"
  }
}
```

- [ ] **Step 4: Create `.env.example`**

```bash
# AMRDetail root environment template
# Copy to .env.local (gitignored) and adjust per environment.

# FastAPI bridge URL (used by Next.js)
NEXT_PUBLIC_BRIDGE_URL=http://localhost:8000

# rosbridge WebSocket URL (used by Next.js)
NEXT_PUBLIC_ROSBRIDGE_URL=ws://localhost:9090

# ROS_DOMAIN_ID (must match across PC and TurtleBot)
ROS_DOMAIN_ID=30

# DDS implementation
RMW_IMPLEMENTATION=rmw_cyclonedds_cpp
CYCLONEDDS_URI=file://./configs/cyclonedds.xml

# TurtleBot connection (real mode only)
TURTLEBOT_IP=192.168.0.42
TURTLEBOT_USER=ubuntu
```

- [ ] **Step 5: Verify pnpm install works**

Run:
```bash
pnpm install
```
Expected: creates `pnpm-lock.yaml`, no errors (no apps yet, so just installs root TypeScript).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml .env.example .nvmrc pnpm-lock.yaml
git commit -m "chore: scaffold pnpm monorepo root"
```

---

### Task 2: Bootstrap Next.js 15 App

**Goal:** Create `apps/web` with Next.js 15 + TypeScript + Tailwind, runs on `pnpm dev:web`.

**Files:**
- Create: `apps/web/` (via create-next-app)

- [ ] **Step 1: Run create-next-app non-interactively**

```bash
pnpm dlx create-next-app@15 apps/web \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*" \
  --use-pnpm \
  --no-turbopack
```

Expected: `apps/web` directory created. Confirm structure exists:
```bash
ls apps/web
```
Should list: `app/`, `public/`, `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.mjs`.

- [ ] **Step 2: Rename web package to scope name**

Edit `apps/web/package.json`. Change the `"name"` field:

```json
{
  "name": "@amrdetail/web",
  ...
}
```

- [ ] **Step 3: Verify dev server starts**

```bash
pnpm dev:web
```
Expected: prints `Local: http://localhost:3000`. Open browser, confirm default Next.js page loads. Then Ctrl+C.

- [ ] **Step 4: Verify build works**

```bash
pnpm build:web
```
Expected: compiles successfully, prints route table.

- [ ] **Step 5: Commit**

```bash
git add apps/web pnpm-lock.yaml package.json
git commit -m "chore(web): bootstrap Next.js 15 with TypeScript and Tailwind"
```

---

### Task 3: Replace Default Page with Dashboard Skeleton

**Goal:** Replace default Next.js homepage with the AMRDetail dashboard skeleton (header + placeholder cards).

**Files:**
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/layout.tsx` (title + lang)

- [ ] **Step 1: Replace `apps/web/app/page.tsx`**

```tsx
export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <h1 className="text-xl font-semibold">AMRDetail</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded bg-blue-500 px-2 py-0.5 font-mono text-xs text-white">
            SIM
          </span>
          <span className="text-neutral-500">● Disconnected</span>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-neutral-500">현재 맵</h2>
          <p className="text-neutral-400">아직 생성된 맵이 없습니다.</p>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-neutral-500">빠른 작업</h2>
          <ul className="space-y-1 text-sm">
            <li>🗺️ 새 맵 만들기 (Milestone 1B)</li>
            <li>🎯 자율주행 시작 (Milestone 1C)</li>
            <li>📋 미션 히스토리 (Milestone 1C)</li>
            <li>⚙️ 시스템 진단 (Milestone 1D)</li>
          </ul>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4 md:col-span-2">
          <h2 className="mb-2 text-sm font-medium text-neutral-500">시스템 상태</h2>
          <p className="text-neutral-400">
            ROS 연결 정보는 Task 4 이후에 표시됩니다.
          </p>
        </div>
      </section>
    </main>
  )
}
```

- [ ] **Step 2: Update `apps/web/app/layout.tsx` metadata**

Find the existing `export const metadata` block and replace its `title` and `description`:

```tsx
export const metadata: Metadata = {
  title: "AMRDetail",
  description: "TurtleBot3 자율주행 관제 시스템",
}
```

Also change the `<html lang="en">` element to `<html lang="ko">`.

- [ ] **Step 3: Verify visually**

```bash
pnpm dev:web
```
Open `http://localhost:3000`. Expected: AMRDetail dashboard with header, SIM badge, three placeholder cards. Ctrl+C to stop.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/page.tsx apps/web/app/layout.tsx
git commit -m "feat(web): scaffold dashboard skeleton"
```

---

### Task 4: ROS Client + Provider with Connection Status

**Goal:** Add roslibjs-based ROS client and a `RosStatus` component that reflects WebSocket connection state in the dashboard.

**Files:**
- Create: `apps/web/lib/ros-client.ts`
- Create: `apps/web/components/ros/ROSProvider.tsx`
- Create: `apps/web/components/ros/RosStatus.tsx`
- Create: `apps/web/tests/ros-client.test.ts`
- Modify: `apps/web/app/layout.tsx` (wrap with provider)
- Modify: `apps/web/app/page.tsx` (use `<RosStatus />`)

- [ ] **Step 1: Install dependencies**

```bash
pnpm --filter @amrdetail/web add roslib zustand
pnpm --filter @amrdetail/web add -D vitest @testing-library/react @testing-library/jest-dom jsdom @types/roslib
```

- [ ] **Step 2: Create `apps/web/lib/ros-client.ts`**

```ts
import ROSLIB from "roslib"
import { create } from "zustand"

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error"

interface RosState {
  ros: ROSLIB.Ros | null
  status: ConnectionStatus
  lastError: string | null
  connect: (url: string) => void
  disconnect: () => void
}

export const useRosStore = create<RosState>((set, get) => ({
  ros: null,
  status: "disconnected",
  lastError: null,

  connect: (url: string) => {
    if (get().ros) return
    set({ status: "connecting", lastError: null })

    const ros = new ROSLIB.Ros({ url })

    ros.on("connection", () => set({ status: "connected" }))
    ros.on("close", () => set({ status: "disconnected" }))
    ros.on("error", (err: Error) =>
      set({ status: "error", lastError: err.message })
    )

    set({ ros })
  },

  disconnect: () => {
    get().ros?.close()
    set({ ros: null, status: "disconnected" })
  },
}))
```

- [ ] **Step 3: Create `apps/web/components/ros/ROSProvider.tsx`**

```tsx
"use client"

import { useEffect } from "react"
import { useRosStore } from "@/lib/ros-client"

export function ROSProvider({ children }: { children: React.ReactNode }) {
  const connect = useRosStore((s) => s.connect)
  const disconnect = useRosStore((s) => s.disconnect)

  useEffect(() => {
    const url =
      process.env.NEXT_PUBLIC_ROSBRIDGE_URL ?? "ws://localhost:9090"
    connect(url)
    return () => disconnect()
  }, [connect, disconnect])

  return <>{children}</>
}
```

- [ ] **Step 4: Create `apps/web/components/ros/RosStatus.tsx`**

```tsx
"use client"

import { useRosStore } from "@/lib/ros-client"

const labels: Record<string, { dot: string; text: string; tone: string }> = {
  connected:    { dot: "●", text: "Connected",    tone: "text-emerald-600" },
  connecting:   { dot: "●", text: "Connecting…",  tone: "text-amber-500"   },
  disconnected: { dot: "●", text: "Disconnected", tone: "text-neutral-400" },
  error:        { dot: "●", text: "Error",        tone: "text-red-600"     },
}

export function RosStatus() {
  const status = useRosStore((s) => s.status)
  const lastError = useRosStore((s) => s.lastError)
  const label = labels[status]

  return (
    <span className={`flex items-center gap-1 text-sm ${label.tone}`} title={lastError ?? undefined}>
      <span>{label.dot}</span>
      <span>{label.text}</span>
    </span>
  )
}
```

- [ ] **Step 5: Wrap layout with provider**

In `apps/web/app/layout.tsx`, import and wrap children:

```tsx
import { ROSProvider } from "@/components/ros/ROSProvider"
```

Replace the `<body>` content from:
```tsx
<body className={inter.className}>{children}</body>
```
to:
```tsx
<body className={inter.className}>
  <ROSProvider>{children}</ROSProvider>
</body>
```

- [ ] **Step 6: Use `<RosStatus />` in dashboard**

In `apps/web/app/page.tsx`, replace the static `<span className="text-neutral-500">● Disconnected</span>` with:

```tsx
<RosStatus />
```

Add the import:
```tsx
import { RosStatus } from "@/components/ros/RosStatus"
```

- [ ] **Step 7: Write failing test for store transitions**

Create `apps/web/tests/ros-client.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest"

// roslib uses WebSocket internally — mock it before importing the store.
vi.mock("roslib", () => {
  class FakeRos {
    handlers: Record<string, ((...args: unknown[]) => void)[]> = {}
    constructor(_opts: { url: string }) {}
    on(event: string, cb: (...args: unknown[]) => void) {
      ;(this.handlers[event] ??= []).push(cb)
    }
    close() {
      this.handlers.close?.forEach((cb) => cb())
    }
    fire(event: string, payload?: unknown) {
      this.handlers[event]?.forEach((cb) => cb(payload))
    }
  }
  return { default: { Ros: FakeRos } }
})

import { useRosStore } from "@/lib/ros-client"

describe("ros-client store", () => {
  beforeEach(() => {
    useRosStore.setState({ ros: null, status: "disconnected", lastError: null })
  })

  it("transitions to connecting then connected", () => {
    useRosStore.getState().connect("ws://localhost:9090")
    expect(useRosStore.getState().status).toBe("connecting")

    const ros = useRosStore.getState().ros as unknown as { fire: (e: string) => void }
    ros.fire("connection")
    expect(useRosStore.getState().status).toBe("connected")
  })

  it("captures error messages", () => {
    useRosStore.getState().connect("ws://localhost:9090")
    const ros = useRosStore.getState().ros as unknown as {
      fire: (e: string, p?: unknown) => void
    }
    ros.fire("error", new Error("nope"))
    expect(useRosStore.getState().status).toBe("error")
    expect(useRosStore.getState().lastError).toBe("nope")
  })

  it("disconnect resets the store", () => {
    useRosStore.getState().connect("ws://localhost:9090")
    useRosStore.getState().disconnect()
    expect(useRosStore.getState().status).toBe("disconnected")
    expect(useRosStore.getState().ros).toBeNull()
  })
})
```

- [ ] **Step 8: Configure Vitest**

Create `apps/web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config"
import { resolve } from "node:path"

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
})
```

Add a `test` script to `apps/web/package.json`:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run"
}
```

- [ ] **Step 9: Run tests, verify they pass**

```bash
pnpm test:web
```
Expected: 3 passing tests under "ros-client store".

- [ ] **Step 10: Manual smoke check — disconnected state**

```bash
pnpm dev:web
```
Open `http://localhost:3000`. Expected: header shows red/neutral "● Error" or "● Disconnected" (because rosbridge is not running yet). No JS console crashes.

- [ ] **Step 11: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): add ROS client store, provider, and status indicator"
```

---

### Task 5: Bootstrap FastAPI Bridge with Health Endpoint

**Goal:** Create `apps/bridge` Python project with uv, expose `GET /health` that returns `{"status": "ok"}`, with a passing pytest.

**Files:**
- Create: `apps/bridge/pyproject.toml`
- Create: `apps/bridge/.env.example`
- Create: `apps/bridge/src/main.py`
- Create: `apps/bridge/src/api/health.py`
- Create: `apps/bridge/src/api/__init__.py`
- Create: `apps/bridge/src/__init__.py`
- Create: `apps/bridge/tests/test_health.py`
- Create: `apps/bridge/tests/__init__.py`

- [ ] **Step 1: Install uv (if missing)**

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```
Verify:
```bash
uv --version
```
Expected: prints uv version (0.4+).

- [ ] **Step 2: Create `apps/bridge/pyproject.toml`**

```toml
[project]
name = "amrdetail-bridge"
version = "0.1.0"
description = "AMRDetail bridge: FastAPI + Prisma + rclpy"
requires-python = ">=3.10,<3.13"
dependencies = [
  "fastapi>=0.115",
  "uvicorn[standard]>=0.32",
  "pydantic>=2.9",
  "structlog>=24.4",
]

[dependency-groups]
dev = [
  "pytest>=8.3",
  "pytest-asyncio>=0.24",
  "httpx>=0.27",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["src"]
asyncio_mode = "auto"
```

- [ ] **Step 3: Create `apps/bridge/.env.example`**

```bash
# FastAPI bridge configuration
HOST=0.0.0.0
PORT=8000
LOG_LEVEL=INFO

# Prisma / SQLite
DATABASE_URL=file:./prisma/dev.db

# CORS (Next.js dev origin)
CORS_ORIGINS=http://localhost:3000
```

- [ ] **Step 4: Create `apps/bridge/src/__init__.py` and `apps/bridge/src/api/__init__.py`**

Both files: empty.

- [ ] **Step 5: Create `apps/bridge/src/api/health.py`**

```python
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 6: Create `apps/bridge/src/main.py`**

```python
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import health


def create_app() -> FastAPI:
    app = FastAPI(title="AMRDetail Bridge", version="0.1.0")

    origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router, tags=["system"])
    return app


app = create_app()
```

- [ ] **Step 7: Create `apps/bridge/tests/__init__.py`** (empty file).

- [ ] **Step 8: Write failing test**

Create `apps/bridge/tests/test_health.py`:

```python
from fastapi.testclient import TestClient

from main import create_app


def test_health_returns_ok():
    client = TestClient(create_app())
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 9: Install dependencies and run test**

```bash
cd apps/bridge
uv sync
uv run pytest -v
```
Expected: 1 passed.

- [ ] **Step 10: Verify uvicorn starts**

```bash
uv run uvicorn main:app --app-dir src --port 8000
```
In another shell:
```bash
curl http://localhost:8000/health
```
Expected: `{"status":"ok"}`. Stop uvicorn with Ctrl+C.

- [ ] **Step 11: Commit**

```bash
cd ../..
git add apps/bridge
git commit -m "feat(bridge): bootstrap FastAPI with health endpoint and pytest"
```

---

### Task 6: Prisma Schema + Initial Migration

**Goal:** Add Prisma schema with `Map` and `Landmark` models (minimum needed to compile; full schema arrives in Milestones 1B/1C/1D). Generate Python client.

**Files:**
- Create: `apps/bridge/prisma/schema.prisma`
- Modify: `apps/bridge/pyproject.toml` (add prisma dependency)
- Modify: `apps/bridge/.env.example` (already has DATABASE_URL — verify)

- [ ] **Step 1: Add prisma dependency**

Edit `apps/bridge/pyproject.toml` and add to `dependencies`:

```toml
dependencies = [
  "fastapi>=0.115",
  "uvicorn[standard]>=0.32",
  "pydantic>=2.9",
  "structlog>=24.4",
  "prisma>=0.15",
]
```

- [ ] **Step 2: Create `apps/bridge/prisma/schema.prisma`**

```prisma
generator client {
  provider             = "prisma-client-py"
  recursive_type_depth = 5
  interface            = "asyncio"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Map {
  id         String   @id @default(cuid())
  name       String   @unique
  pgmPath    String
  yamlPath   String
  thumbnail  String?
  resolution Float
  width      Int
  height     Int
  originX    Float
  originY    Float
  isActive   Boolean  @default(false)
  createdAt  DateTime @default(now())

  landmarks  Landmark[]
}

model Landmark {
  id        String   @id @default(cuid())
  mapId     String
  map       Map      @relation(fields: [mapId], references: [id])
  name      String
  x         Float
  y         Float
  theta     Float
  icon      String?
  createdAt DateTime @default(now())

  @@unique([mapId, name])
}
```

- [ ] **Step 3: Sync dependencies and generate client**

```bash
cd apps/bridge
uv sync
DATABASE_URL=file:./prisma/dev.db uv run prisma generate
```
Expected: prints "Generated Prisma Client Python".

- [ ] **Step 4: Apply migration to create dev.db**

```bash
DATABASE_URL=file:./prisma/dev.db uv run prisma migrate dev --name init
```
Expected: prompts for name (already provided via `--name`), creates `prisma/migrations/<timestamp>_init/migration.sql`, generates `prisma/dev.db`.

- [ ] **Step 5: Verify by querying the table list**

```bash
uv run python -c "import sqlite3; print(sqlite3.connect('prisma/dev.db').execute(\"SELECT name FROM sqlite_master WHERE type='table'\").fetchall())"
```
Expected: includes `('Map',)` and `('Landmark',)`.

- [ ] **Step 6: Update `.gitignore` for Prisma artifacts**

Append to repo root `.gitignore`:

```
apps/bridge/prisma/dev.db
apps/bridge/prisma/dev.db-journal
```

Confirm these patterns are already covered by existing rules (Task 1's `.gitignore` already had `*.db` — verify by running:
```bash
git check-ignore apps/bridge/prisma/dev.db
```
Expected: prints the path (means it's ignored). If not, add the lines above.

- [ ] **Step 7: Commit**

```bash
cd ../..
git add apps/bridge/pyproject.toml apps/bridge/uv.lock apps/bridge/prisma/schema.prisma apps/bridge/prisma/migrations
git commit -m "feat(bridge): add Prisma schema with Map and Landmark models"
```

---

### Task 7: ROS2 Workspace Skeleton

**Goal:** Create `ros2_ws/src/` with empty `colcon` workspace ready to add packages.

**Files:**
- Create: `ros2_ws/src/.gitkeep`

- [ ] **Step 1: Verify ROS2 Humble is installed**

```bash
source /opt/ros/humble/setup.bash
ros2 --help
```
Expected: prints ros2 CLI help. If not installed, STOP and follow `docs/setup-guide.md` (created in Task 13).

- [ ] **Step 2: Create workspace directory**

```bash
mkdir -p ros2_ws/src
touch ros2_ws/src/.gitkeep
```

- [ ] **Step 3: Verify empty colcon build succeeds**

```bash
cd ros2_ws
colcon build
```
Expected: "Summary: 0 packages finished" (no packages yet, but no error).

- [ ] **Step 4: Update `.gitignore` to exclude build artifacts**

The patterns are already in `.gitignore` from Task 1 (`ros2_ws/build/`, `ros2_ws/install/`, `ros2_ws/log/`). Verify:
```bash
git check-ignore ros2_ws/build
```
Expected: prints `ros2_ws/build` (means ignored). If not, add lines to `.gitignore`.

- [ ] **Step 5: Commit**

```bash
cd ..
git add ros2_ws/src/.gitkeep
git commit -m "chore(ros2): scaffold colcon workspace"
```

---

### Task 8: `amrdetail_msgs` Package

**Goal:** Create the custom message package with `Mission.msg` and `MissionStatus.msg`, build successfully, and import message types via `ros2 interface`.

**Files:**
- Create: `ros2_ws/src/amrdetail_msgs/package.xml`
- Create: `ros2_ws/src/amrdetail_msgs/CMakeLists.txt`
- Create: `ros2_ws/src/amrdetail_msgs/msg/Mission.msg`
- Create: `ros2_ws/src/amrdetail_msgs/msg/MissionStatus.msg`

- [ ] **Step 1: Create `ros2_ws/src/amrdetail_msgs/package.xml`**

```xml
<?xml version="1.0"?>
<package format="3">
  <name>amrdetail_msgs</name>
  <version>0.1.0</version>
  <description>Custom messages for AMRDetail mission and status tracking</description>
  <maintainer email="dean@robos.one">Dean</maintainer>
  <license>MIT</license>

  <buildtool_depend>ament_cmake</buildtool_depend>
  <buildtool_depend>rosidl_default_generators</buildtool_depend>

  <depend>std_msgs</depend>
  <depend>geometry_msgs</depend>

  <exec_depend>rosidl_default_runtime</exec_depend>
  <member_of_group>rosidl_interface_packages</member_of_group>

  <export>
    <build_type>ament_cmake</build_type>
  </export>
</package>
```

- [ ] **Step 2: Create `ros2_ws/src/amrdetail_msgs/CMakeLists.txt`**

```cmake
cmake_minimum_required(VERSION 3.8)
project(amrdetail_msgs)

if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

find_package(ament_cmake REQUIRED)
find_package(rosidl_default_generators REQUIRED)
find_package(std_msgs REQUIRED)
find_package(geometry_msgs REQUIRED)

rosidl_generate_interfaces(${PROJECT_NAME}
  "msg/Mission.msg"
  "msg/MissionStatus.msg"
  DEPENDENCIES std_msgs geometry_msgs
)

ament_export_dependencies(rosidl_default_runtime)
ament_package()
```

- [ ] **Step 3: Create `ros2_ws/src/amrdetail_msgs/msg/Mission.msg`**

```
# A navigation mission target
string mission_id
geometry_msgs/Pose2D goal
string map_name
```

- [ ] **Step 4: Create `ros2_ws/src/amrdetail_msgs/msg/MissionStatus.msg`**

```
# Live progress of a navigation mission
string mission_id
string status         # "pending" | "running" | "succeeded" | "failed" | "canceled"
float64 distance_remaining
float64 eta_seconds
string failure_reason
```

- [ ] **Step 5: Build the workspace**

```bash
cd ros2_ws
colcon build --packages-select amrdetail_msgs
```
Expected: "Summary: 1 package finished".

- [ ] **Step 6: Source and verify message types are visible**

```bash
source install/setup.bash
ros2 interface show amrdetail_msgs/msg/Mission
ros2 interface show amrdetail_msgs/msg/MissionStatus
```
Expected: each command prints the message fields defined above.

- [ ] **Step 7: Commit**

```bash
cd ..
git add ros2_ws/src/amrdetail_msgs
git commit -m "feat(ros2): add amrdetail_msgs package with Mission and MissionStatus"
```

---

### Task 9: `amrdetail_bringup` Package with Sim Launch File

**Goal:** Create a launch file that starts Gazebo `turtlebot3_world` + rosbridge_server with sim time enabled. After running, `ros2 topic list` shows `/odom`, `/scan`, etc.

**Files:**
- Create: `ros2_ws/src/amrdetail_bringup/package.xml`
- Create: `ros2_ws/src/amrdetail_bringup/CMakeLists.txt`
- Create: `ros2_ws/src/amrdetail_bringup/launch/sim.launch.py`

**Prerequisites:** Ensure TurtleBot3 simulation packages are installed:
```bash
sudo apt install -y ros-humble-turtlebot3-gazebo ros-humble-rosbridge-suite
```
And set `TURTLEBOT3_MODEL=waffle_pi` in the shell or `~/.bashrc`.

- [ ] **Step 1: Create `ros2_ws/src/amrdetail_bringup/package.xml`**

```xml
<?xml version="1.0"?>
<package format="3">
  <name>amrdetail_bringup</name>
  <version>0.1.0</version>
  <description>Launch files for AMRDetail simulation and real robot bringup</description>
  <maintainer email="dean@robos.one">Dean</maintainer>
  <license>MIT</license>

  <buildtool_depend>ament_cmake</buildtool_depend>

  <exec_depend>turtlebot3_gazebo</exec_depend>
  <exec_depend>rosbridge_server</exec_depend>

  <export>
    <build_type>ament_cmake</build_type>
  </export>
</package>
```

- [ ] **Step 2: Create `ros2_ws/src/amrdetail_bringup/CMakeLists.txt`**

```cmake
cmake_minimum_required(VERSION 3.8)
project(amrdetail_bringup)

find_package(ament_cmake REQUIRED)

install(
  DIRECTORY launch
  DESTINATION share/${PROJECT_NAME}
)

ament_package()
```

- [ ] **Step 3: Create `ros2_ws/src/amrdetail_bringup/launch/sim.launch.py`**

```python
"""Launch Gazebo turtlebot3_world with rosbridge_server for AMRDetail Milestone 1A."""

from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription, DeclareLaunchArgument
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare


def generate_launch_description() -> LaunchDescription:
    use_sim_time = LaunchConfiguration("use_sim_time")

    turtlebot3_gazebo_launch = PathJoinSubstitution(
        [
            FindPackageShare("turtlebot3_gazebo"),
            "launch",
            "turtlebot3_world.launch.py",
        ]
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

- [ ] **Step 4: Build the package**

```bash
cd ros2_ws
colcon build --packages-select amrdetail_bringup
```
Expected: "Summary: 1 package finished".

- [ ] **Step 5: Source and run the launch file**

```bash
source install/setup.bash
export TURTLEBOT3_MODEL=waffle_pi
ros2 launch amrdetail_bringup sim.launch.py
```
Expected:
- Gazebo opens with TurtleBot3 in the `turtlebot3_world` environment.
- Terminal shows `Rosbridge WebSocket server started on port 9090`.

Leave running for the next step.

- [ ] **Step 6: Verify topics are publishing (in a second shell)**

```bash
source /opt/ros/humble/setup.bash
source ros2_ws/install/setup.bash
ros2 topic list
ros2 topic echo --once /odom
```
Expected:
- `ros2 topic list` includes `/odom`, `/scan`, `/cmd_vel`, `/tf`, `/clock`.
- `ros2 topic echo --once /odom` prints an Odometry message.

Stop the launch with Ctrl+C in the first shell.

- [ ] **Step 7: Commit**

```bash
cd ..
git add ros2_ws/src/amrdetail_bringup
git commit -m "feat(ros2): add amrdetail_bringup sim.launch.py"
```

---

### Task 10: Cyclone DDS Configuration

**Goal:** Add a static cyclonedds.xml that uses unicast discovery (avoids WiFi multicast issues during real-robot integration in Milestone 1B).

**Files:**
- Create: `configs/cyclonedds.xml`

- [ ] **Step 1: Create `configs/cyclonedds.xml`**

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<CycloneDDS xmlns="https://cdds.io/config" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            xsi:schemaLocation="https://cdds.io/config https://raw.githubusercontent.com/eclipse-cyclonedds/cyclonedds/master/etc/cyclonedds.xsd">
  <Domain id="any">
    <General>
      <Interfaces>
        <!-- Adjust the name to match `ip addr` (e.g., eth0, wlan0). -->
        <NetworkInterface autodetermine="true" />
      </Interfaces>
      <AllowMulticast>spdp</AllowMulticast>
      <MaxMessageSize>65500B</MaxMessageSize>
    </General>
    <Discovery>
      <ParticipantIndex>auto</ParticipantIndex>
      <Peers>
        <!-- Add explicit peers here when running multi-host (PC + TurtleBot). -->
        <!-- <Peer address="192.168.0.42"/> -->
      </Peers>
    </Discovery>
    <Internal>
      <SocketReceiveBufferSize min="10MB"/>
    </Internal>
  </Domain>
</CycloneDDS>
```

- [ ] **Step 2: Verify the file is parseable**

Install cyclonedds CLI (already a transitive dep of rmw_cyclonedds_cpp):
```bash
xmllint --noout configs/cyclonedds.xml && echo "OK"
```
Expected: prints `OK`.

If `xmllint` is missing:
```bash
sudo apt install -y libxml2-utils
```

- [ ] **Step 3: Document the env var in `.env.example`**

`.env.example` from Task 1 already includes:
```bash
CYCLONEDDS_URI=file://./configs/cyclonedds.xml
```
Verify present. If missing, add it.

- [ ] **Step 4: Commit**

```bash
git add configs/cyclonedds.xml
git commit -m "feat(configs): add cyclonedds.xml with unicast discovery template"
```

---

### Task 11: `amrdetail-launch` CLI Script

**Goal:** One command — `amrdetail-launch sim` — starts the full sim stack (ROS2 launch + FastAPI + Next.js dev server) in a single terminal. Each component runs in a managed background process; Ctrl+C tears them all down.

**Files:**
- Create: `scripts/amrdetail-launch`

- [ ] **Step 1: Create `scripts/amrdetail-launch`**

```bash
#!/usr/bin/env bash
# AMRDetail launcher: starts the full sim or real stack.
# Usage:
#   amrdetail-launch sim   # Gazebo + rosbridge + FastAPI + Next.js
#   amrdetail-launch real  # (Milestone 1B) TurtleBot bringup + ...

set -euo pipefail

MODE="${1:-}"
if [[ "$MODE" != "sim" && "$MODE" != "real" ]]; then
  echo "Usage: amrdetail-launch <sim|real>" >&2
  exit 64
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Load .env.local if present
if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

export ROS_DOMAIN_ID="${ROS_DOMAIN_ID:-30}"
export RMW_IMPLEMENTATION="${RMW_IMPLEMENTATION:-rmw_cyclonedds_cpp}"
export CYCLONEDDS_URI="file://$REPO_ROOT/configs/cyclonedds.xml"
export TURTLEBOT3_MODEL="${TURTLEBOT3_MODEL:-waffle_pi}"

# Source ROS2 + workspace
source /opt/ros/humble/setup.bash
if [[ -f "$REPO_ROOT/ros2_ws/install/setup.bash" ]]; then
  # shellcheck disable=SC1091
  source "$REPO_ROOT/ros2_ws/install/setup.bash"
else
  echo "Workspace not built yet. Run: (cd ros2_ws && colcon build)" >&2
  exit 1
fi

declare -a PIDS=()
cleanup() {
  echo
  echo "Stopping AMRDetail processes…"
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

start() {
  local label="$1"; shift
  echo "[$label] starting: $*"
  ( "$@" ) &
  PIDS+=("$!")
}

case "$MODE" in
  sim)
    start ros2  ros2 launch amrdetail_bringup sim.launch.py
    start bridge bash -c "cd apps/bridge && uv run uvicorn main:app --app-dir src --host 0.0.0.0 --port 8000"
    start web    bash -c "cd apps/web && pnpm dev"
    ;;
  real)
    echo "real mode arrives in Milestone 1B." >&2
    exit 65
    ;;
esac

echo
echo "AMRDetail $MODE stack is running. Open http://localhost:3000"
echo "Press Ctrl+C to stop."
wait
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x scripts/amrdetail-launch
```

- [ ] **Step 3: End-to-end smoke test**

```bash
./scripts/amrdetail-launch sim
```
Expected: Gazebo window opens, FastAPI logs `Uvicorn running on http://0.0.0.0:8000`, Next.js logs `Local: http://localhost:3000`.

Open `http://localhost:3000` — the dashboard should show **● Connected** (green) in the header. The header still shows the SIM badge.

Open `http://localhost:8000/health` — should return `{"status":"ok"}`.

Stop with Ctrl+C — all three processes should terminate cleanly.

- [ ] **Step 4: Commit**

```bash
git add scripts/amrdetail-launch
git commit -m "feat(scripts): add amrdetail-launch sim CLI"
```

---

### Task 12: Live `/odom` Topic Display

**Goal:** Extend `RosStatus` (or add a small companion) so the dashboard shows the last received `/odom` x/y position, proving end-to-end ROS data flow.

**Files:**
- Create: `apps/web/components/ros/OdomReadout.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/tests/ros-client.test.ts` (extend mock to support topic subscribe)

- [ ] **Step 1: Write failing test for topic subscription helper**

Edit `apps/web/tests/ros-client.test.ts`. **Add a new `describe` block** at the end (do not modify existing tests):

```ts
describe("subscribeTopic helper", () => {
  it("invokes callback with payload when message arrives", async () => {
    const ROSLIB = (await import("roslib")).default as unknown as {
      Ros: new (opts: { url: string }) => unknown
      Topic?: new (opts: unknown) => unknown
    }

    // Augment the mock with a Topic class for this test
    const subs: ((msg: unknown) => void)[] = []
    class FakeTopic {
      constructor(_opts: { ros: unknown; name: string; messageType: string }) {}
      subscribe(cb: (msg: unknown) => void) {
        subs.push(cb)
      }
      unsubscribe() {
        subs.length = 0
      }
    }
    ;(ROSLIB as { Topic: typeof FakeTopic }).Topic = FakeTopic

    const { subscribeTopic } = await import("@/lib/ros-client")

    useRosStore.getState().connect("ws://localhost:9090")
    const ros = useRosStore.getState().ros as unknown as { fire: (e: string) => void }
    ros.fire("connection")

    const received: unknown[] = []
    const unsub = subscribeTopic("/odom", "nav_msgs/msg/Odometry", (msg) => {
      received.push(msg)
    })

    subs.forEach((cb) => cb({ pose: { pose: { position: { x: 1, y: 2 } } } }))
    expect(received).toHaveLength(1)
    unsub()
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm test:web
```
Expected: the new test fails with `subscribeTopic is not a function` or similar.

- [ ] **Step 3: Add `subscribeTopic` to `apps/web/lib/ros-client.ts`**

Append to the existing file:

```ts
import ROSLIB from "roslib"

export type Unsubscribe = () => void

export function subscribeTopic<T>(
  name: string,
  messageType: string,
  onMessage: (msg: T) => void,
): Unsubscribe {
  const ros = useRosStore.getState().ros
  if (!ros) return () => {}

  const topic = new ROSLIB.Topic({ ros, name, messageType })
  topic.subscribe(onMessage as (msg: ROSLIB.Message) => void)
  return () => topic.unsubscribe()
}
```

(Note: the existing top-of-file `import ROSLIB from "roslib"` already exists from Task 4; do NOT add a duplicate import. Just add `export type Unsubscribe` and the function.)

- [ ] **Step 4: Run tests, verify they pass**

```bash
pnpm test:web
```
Expected: 4 passing tests.

- [ ] **Step 5: Create `apps/web/components/ros/OdomReadout.tsx`**

```tsx
"use client"

import { useEffect, useState } from "react"
import { subscribeTopic } from "@/lib/ros-client"
import { useRosStore } from "@/lib/ros-client"

interface OdometryMessage {
  pose: {
    pose: {
      position: { x: number; y: number; z: number }
    }
  }
}

export function OdomReadout() {
  const status = useRosStore((s) => s.status)
  const [pose, setPose] = useState<{ x: number; y: number } | null>(null)
  const [lastUpdate, setLastUpdate] = useState<number | null>(null)

  useEffect(() => {
    if (status !== "connected") return
    const unsub = subscribeTopic<OdometryMessage>(
      "/odom",
      "nav_msgs/msg/Odometry",
      (msg) => {
        setPose({
          x: msg.pose.pose.position.x,
          y: msg.pose.pose.position.y,
        })
        setLastUpdate(Date.now())
      },
    )
    return unsub
  }, [status])

  if (status !== "connected") {
    return <p className="text-neutral-400">ROS 연결 대기 중…</p>
  }

  if (!pose) {
    return <p className="text-neutral-400">/odom 토픽 수신 대기 중…</p>
  }

  return (
    <div className="font-mono text-sm">
      <div>x: {pose.x.toFixed(3)} m</div>
      <div>y: {pose.y.toFixed(3)} m</div>
      {lastUpdate && (
        <div className="text-xs text-neutral-500">
          마지막 업데이트: {new Date(lastUpdate).toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Mount in dashboard**

In `apps/web/app/page.tsx`, replace the contents of the system status card (the third card, `md:col-span-2`) with:

```tsx
<div className="rounded-lg border border-neutral-200 bg-white p-4 md:col-span-2">
  <h2 className="mb-2 text-sm font-medium text-neutral-500">시스템 상태</h2>
  <OdomReadout />
</div>
```

Add the import:
```tsx
import { OdomReadout } from "@/components/ros/OdomReadout"
```

- [ ] **Step 7: End-to-end smoke test**

```bash
./scripts/amrdetail-launch sim
```
Open `http://localhost:3000`. Expected:
- Header shows **● Connected** (green).
- "시스템 상태" card shows live `x:` and `y:` values.

In a second shell, drive the robot manually:
```bash
source /opt/ros/humble/setup.bash
ros2 run turtlebot3_teleop teleop_keyboard
```
Press `w` a few times. The dashboard `x:` value should update in real time.

Stop teleop with Ctrl+C. Stop the launch with Ctrl+C.

- [ ] **Step 8: Commit**

```bash
git add apps/web
git commit -m "feat(web): live /odom readout on dashboard"
```

---

### Task 13: `docs/setup-guide.md`

**Goal:** A new contributor can follow this file and reach a working `amrdetail-launch sim` in under 30 minutes.

**Files:**
- Create: `docs/setup-guide.md`

- [ ] **Step 1: Create `docs/setup-guide.md`**

````markdown
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
````

- [ ] **Step 2: Verify the guide compiles cleanly**

```bash
ls docs/setup-guide.md
```
Open the file in any markdown previewer and confirm formatting is intact.

- [ ] **Step 3: Commit**

```bash
git add docs/setup-guide.md
git commit -m "docs: add Milestone 1A setup guide"
```

---

### Task 14: Final Milestone 1A Verification + Push

**Goal:** Confirm the Milestone 1A completion criteria from the spec (1.2 / 10.1) and push to GitHub.

- [ ] **Step 1: Cold-cache verification**

In a fresh shell:
```bash
cd ~  # ensure no residual env
# Open new terminal, then:
cd /path/to/AMRDemo
./scripts/amrdetail-launch sim
```

Expected (the Milestone 1A "Done" criteria):
- [x] `amrdetail-launch sim` exits with no errors during startup.
- [x] Gazebo window opens with TurtleBot3.
- [x] http://localhost:3000 dashboard renders.
- [x] Header shows `● Connected`.
- [x] "시스템 상태" card shows live `x:` and `y:` values.
- [x] http://localhost:8000/health returns `{"status":"ok"}`.
- [x] Ctrl+C tears down all processes (verify with `ps aux | grep -E 'gazebo|rosbridge|uvicorn|next'`).

If any item fails, stop and debug before continuing.

- [ ] **Step 2: Run all tests one final time**

```bash
pnpm test:web
(cd apps/bridge && uv run pytest -v)
```
Expected:
- `pnpm test:web`: 4 passing (3 from Task 4 + 1 from Task 12).
- `pytest -v`: 1 passing (health endpoint).

- [ ] **Step 3: Confirm `git status` is clean**

```bash
git status
```
Expected: `nothing to commit, working tree clean`. If untracked files exist, decide whether to add them to `.gitignore` or commit.

- [ ] **Step 4: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 5: Tag the milestone**

```bash
git tag -a milestone-1a -m "Milestone 1A: infrastructure setup complete"
git push origin milestone-1a
```

---

## Completion Criteria Recap

This plan is complete when:

1. **Spec § 1.2 #1 (partial)**: `amrdetail-launch sim` runs and the UI shows live ROS data — ✓ verified in Task 12 + Task 14.
2. **Spec § 10.1**: All boxes under "Milestone 1A — 인프라 셋업" checked — ✓ tasks 1-13 cover them.
3. All tests pass (Task 14 Step 2).
4. The code is on GitHub `main` and tagged `milestone-1a` (Task 14 Step 4-5).

After this, the next implementation step is **Milestone 1B (SLAM + Map Management)**. Re-run the brainstorming → writing-plans flow scoped to that milestone, using the same spec document as reference.
