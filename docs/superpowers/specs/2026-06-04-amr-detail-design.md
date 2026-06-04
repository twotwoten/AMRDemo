# AMRDetail — Phase 1 디자인 문서

| 항목 | 값 |
|---|---|
| 작성일 | 2026-06-04 |
| 작성자 | Dean (dean@robos.one) + Claude |
| 상태 | Draft (사용자 리뷰 대기) |
| Phase | Phase 1 (Phase 2/3는 Out of Scope 섹션 참조) |
| 후속 문서 | `docs/superpowers/plans/` (구현 계획, writing-plans 스킬로 생성 예정) |

## 1. 프로젝트 요약

TurtleBot3 Waffle Pi 1대를 활용하여 **소형 실내(~4×3m) 공간에서 SLAM 매핑 및 자율주행**을 수행하고, **웹 브라우저로 실시간 관제**하는 시스템을 구축한다. Phase 1에서는 ROS2 Humble 표준 스택(slam_toolbox + Nav2)을 사용하고, Phase 2에서 보유 중인 **ZED 2i 천장 카메라로 위치 정확도를 보정**하는 확장 작업을 별도 진행한다.

### 1.1 1차 목표
- 실사용 가능한 자율주행 데모 시스템 완성
- Gazebo 시뮬레이션 ↔ 실기 TurtleBot 전환 가능
- 비상 정지를 포함한 안전 장치 동작
- Phase 2 카메라 통합 시 재작업이 최소화되는 인터페이스 미리 마련

### 1.2 성공 기준 (Phase 1 완료 정의)
1. Gazebo sim에서 맵 생성→저장→자율주행 미션 성공 (1회 이상)
2. 실기 TurtleBot Waffle Pi에서 동일 시나리오 성공 (1회 이상)
3. 비상 정지 3중 채널(HTTP/WS/Direct) 모두 단위 테스트 통과
4. WiFi 인위 단절 시 자동 정지 및 재연결 동작 확인
5. `docs/setup-guide.md`만 보고 신규 사용자가 30분 내 sim 환경 실행 가능

## 2. 확정 결정사항

| 항목 | 결정 | 이유 |
|---|---|---|
| 로봇 모델 | TurtleBot3 Waffle Pi (LDS-02 LiDAR) | 보유 장비 |
| 작업 공간 | 소형 회의실 (~4×3m) | 보유 환경 |
| ROS 버전 | ROS2 Humble (Ubuntu 22.04) | 2027-05까지 LTS, 한국어 자료 다수 |
| SLAM 알고리즘 | slam_toolbox (online_async) | 소형 공간 최적, 동적 환경 강함, 맵 편집 가능 |
| 네비게이션 스택 | Nav2 (bt_navigator + AMCL) | ROS2 표준 |
| 호스트 구성 | 별도 PC ↔ TurtleBot 분리 (ROS2 DDS) | RPi4 부하 회피, Phase 2 GPU 활용 |
| 웹 UI 스택 | Next.js 15 + TypeScript + Tailwind + roslibjs | CLAUDE.md 표준 스택 |
| 백엔드 | FastAPI + Prisma (SQLite) + rclpy | rosbridge 위에 비즈니스 로직 레이어 |
| 개발 환경 | sim/real 전환 스위치 (launch 파라미터) | 디버깅 효율 + 실기 의존성 분리 |
| 인증 | Phase 1 범위에서 제외 | 로컬 네트워크 데모 가정 |
| 다국어 | 한국어 only (i18n 구조만 준비) | YAGNI |
| 모노레포 도구 | pnpm workspaces | 일반적인 사실상 표준 |
| Python 패키지 관리 | uv | 2026년 사실상 표준 |

## 3. 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     개발자/오퍼레이터 (브라우저)                            │
│              http://localhost:3000  (Next.js 15 + Tailwind)             │
└────────────────────────────┬────────────────────────────────────────────┘
                             │  HTTP + WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│   Workstation PC  (Ubuntu 22.04, ROS2 Humble)                           │
│                                                                         │
│   ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────────┐   │
│   │  Next.js Server  │  │ FastAPI Bridge   │  │  rosbridge_server   │   │
│   │  (관제 UI / API)  │◄─┤  (DB + 미션관리)  │  │  (ROS2↔WebSocket)   │   │
│   └──────────────────┘  └────────┬─────────┘  └──────────┬──────────┘   │
│                                  │ Prisma                │ ROS2 토픽    │
│                                  ▼                       │              │
│                          ┌──────────────┐                │              │
│                          │  SQLite DB   │                │              │
│                          │ (맵/미션/로그)│                │              │
│                          └──────────────┘                │              │
│                                                          ▼              │
│   ┌──────────────────────────────────────────────────────────────┐      │
│   │  ROS2 노드들 (PC에서 실행)                                      │      │
│   │  • slam_toolbox   • nav2_bringup   • amcl                    │      │
│   │  • map_server     • cmd_vel_mux    • pose_corrector(Phase1)  │      │
│   └──────────────────────────────────────────────────────────────┘      │
│                                  ▲                                      │
└──────────────────────────────────┼──────────────────────────────────────┘
                                   │ ROS2 DDS (WiFi, cyclonedds unicast)
                                   │ ROS_DOMAIN_ID=30
        ┌──────────────────────────┴──────────────────────────┐
        ▼                                                     ▼
┌───────────────────────┐                          ┌────────────────────┐
│  Real Mode            │                          │  Sim Mode          │
│  TurtleBot3 Waffle Pi │      ←use_sim_time→      │  Gazebo            │
│  • LDS-02 LiDAR       │                          │  turtlebot3_world  │
│  • bringup 노드만 실행 │                          │  /clock 발행        │
└───────────────────────┘                          └────────────────────┘
```

### 3.1 아키텍처 선택의 이유
1. **FastAPI Bridge 분리**: Next.js만 rosbridge에 직결하지 않은 이유 — Prisma(DB), 비ROS 로직(미션 큐), Phase 2 ZED 처리(Python 라이브러리 풍부)에 유리. 3-Tier로 분리해 각 레이어 독립 교체 가능.
2. **TurtleBot은 센서 드라이브 노드만**: SLAM/Nav2를 PC에서 돌려야 RPi4 부하 회피. Phase 2 ZED 통합 시 GPU 활용 자연스럽게 이어짐.
3. **Phase 2 확장 지점**: FastAPI 안에 `pose_corrector` 추상화 인터페이스를 미리 두고, Phase 1은 패스스루(AMCL pose 그대로), Phase 2에서 ZED 보정 노드로 교체.

### 3.2 아키텍처 위험요소 및 대응
- **ROS2 DDS WiFi 디스커버리 불안정**: `cyclonedds` + `unicast discovery` 사용. `configs/cyclonedds.xml`에 정적 IP 등록.
- **rosbridge ↔ FastAPI 데이터 일관성**: 원칙 — DB 쓰기는 FastAPI만, 실시간 ROS 데이터는 rosbridge로 직결.
- **rclpy + asyncio 충돌**: FastAPI 안에서 `MultiThreadedExecutor`를 별도 스레드로 격리.

## 4. 컴포넌트 상세

### 4.1 Next.js Frontend (`apps/web/`)

| 항목 | 내용 |
|---|---|
| 역할 | 관제 UI 렌더링, 사용자 입력 캡처 |
| 통신 | FastAPI HTTP (미션/맵/설정), rosbridge WebSocket (실시간 토픽) |
| 주요 화면 7개 | 대시보드, 맵 빌더, 맵 관리, 자율주행, 랜드마크, 미션 히스토리, 진단 |

**핵심 라이브러리**
- `roslibjs` — ROS2 토픽 구독/발행
- `react-konva` (또는 SVG) — 점유 격자 맵 + 로봇·경로·목표 오버레이
- `zustand` — 상태 관리 (ROS 연결 상태, 현재 미션)
- `nipplejs` — 모바일/태블릿 조이스틱

### 4.2 FastAPI Bridge (`apps/bridge/`)

| 항목 | 내용 |
|---|---|
| 역할 | 비즈니스 로직 + DB 게이트웨이 + ROS2↔HTTP 어댑터 |
| 통신 | `rclpy`로 ROS2 노드 참여, Prisma로 SQLite, HTTP/WebSocket로 UI 응답 |
| 책임 | 미션 큐 관리, 맵 메타데이터, 사용자 인증(Phase 3+), 로그 영구화 |

**핵심 모듈**
- `mission_service.py` — 목표 좌표 → Nav2 액션 호출, 진행 상황 추적
- `map_service.py` — slam_toolbox `/save_map` 트리거, 파일 시스템에 PGM/YAML, Prisma 메타데이터
- `landmark_service.py` — 랜드마크 CRUD
- `pose_corrector.py` — **Phase 2 확장 지점** (4.6 절 참조)
- `ros_listener.py` — `/odom`, `/amcl_pose`, `/map`, `/rosout` 등 구독 후 DB 로깅 + UI 푸시

### 4.3 ROS2 패키지 (`ros2_ws/src/`)

#### `amrdetail_bringup`
- sim/real 전환 launch 파일 (`use_sim_time:=true|false`)
- 실기 모드: SSH로 TurtleBot bringup 자동 시작 (수동 시작 가이드 fallback)

#### `amrdetail_slam`
- slam_toolbox `online_async` 모드 설정
- 맵 저장 서비스 호출 가능

#### `amrdetail_navigation`
- Nav2 기본 스택 (`bt_navigator`, `controller_server`, `planner_server`, `behavior_server`)
- AMCL은 매핑 완료 후 별도 launch로 전환 (모드 분리)

#### `amrdetail_safety`
- `cmd_vel_mux` 노드 — E-Stop > Nav2 > Teleop 우선순위
- E-Stop 액션 서버

#### `amrdetail_msgs`
- `Mission.msg`, `MissionStatus.msg`
- Phase 2에서 `CorrectedPose.msg` 추가 예정

### 4.4 rosbridge_server
- 표준 패키지. 포트 9090. 화이트리스트로 노출 토픽 제한(보안).

### 4.5 데이터 저장 — Prisma 스키마 (Phase 1)

Phase 1 핵심 모델만. Phase 2 필드는 nullable로 미리 추가하여 마이그레이션 부담 회피.

```prisma
model Map {
  id          String   @id @default(cuid())
  name        String   @unique
  pgmPath     String
  yamlPath    String
  thumbnail   String?  // PNG 썸네일 경로
  resolution  Float
  width       Int
  height      Int
  originX     Float
  originY     Float
  isActive    Boolean  @default(false)  // 현재 사용 중 표시
  createdAt   DateTime @default(now())
  missions    Mission[]
  landmarks   Landmark[]
}

model Mission {
  id           String   @id @default(cuid())
  mapId        String
  map          Map      @relation(fields: [mapId], references: [id])
  goalX        Float
  goalY        Float
  goalTheta    Float
  status       String   // "pending" | "running" | "succeeded" | "failed" | "canceled"
  failureReason String?
  startedAt    DateTime @default(now())
  finishedAt   DateTime?
  rosLogDir    String?  // ROS log 디렉토리 경로
  rosbagPath   String?  // 자동 녹화 rosbag 경로
  poseLogs     PoseLog[]

  // Phase 2 확장 필드 (Phase 1에서는 항상 null)
  actualArrivalX     Float?
  actualArrivalY     Float?
  actualArrivalTheta Float?
  arrivalErrorM      Float?
  poseSource         String?  // "amcl" | "zed" | "fused"
}

model PoseLog {
  id          Int      @id @default(autoincrement())
  missionId   String
  mission     Mission  @relation(fields: [missionId], references: [id])
  t           DateTime @default(now())
  x           Float
  y           Float
  theta       Float
  source      String   // "slam" | "amcl" (Phase 2: "fused" 추가)
}

model Landmark {
  id        String   @id @default(cuid())
  mapId     String
  map       Map      @relation(fields: [mapId], references: [id])
  name      String
  x         Float
  y         Float
  theta     Float
  icon      String?  // "door" | "printer" | "desk" 등
  createdAt DateTime @default(now())

  @@unique([mapId, name])
}
```

### 4.6 통신 토픽 표준화

| 토픽/서비스 | 타입 | 발행자 | 구독자 | 비고 |
|---|---|---|---|---|
| `/scan` | `LaserScan` | TurtleBot/Gazebo | slam_toolbox, Nav2 | |
| `/odom` | `Odometry` | TurtleBot/Gazebo | slam_toolbox, Nav2 | |
| `/map` | `OccupancyGrid` | slam_toolbox / map_server | UI, Nav2 | latched (transient_local) |
| `/amcl_pose` | `PoseWithCovarianceStamped` | AMCL | UI, FastAPI | |
| `/initialpose` | `PoseWithCovarianceStamped` | UI | AMCL | 초기 위치 설정 |
| `/goal_pose` | `PoseStamped` | UI(테스트), FastAPI | Nav2 | 단순 발행용 |
| `/navigate_to_pose` | Action | FastAPI | Nav2 | 정식 경로 (선호) |
| `/cmd_vel` | `Twist` | Teleop, Nav2, E-Stop | cmd_vel_mux → TurtleBot | 우선순위 mux 통과 |
| `/pose_for_ui` | `PoseWithCovarianceStamped` | (별칭) | UI | Phase 1=`/amcl_pose`, Phase 2=`/corrected_pose` |
| `/rosout` | `Log` | 모든 노드 | FastAPI(진단) | 에러 로그 수집 |
| `/corrected_pose` | (Phase 2) | pose_corrector 노드 | UI, DB | Phase 2에서 신설 |
| `/zed/pose` | (Phase 2) | ZED 노드 | EKF | Phase 2에서 신설 |

## 5. 데이터 흐름 시퀀스

### 5.1 시나리오 A — 맵 생성

```
User → UI: 시작 클릭
UI → FastAPI: POST /maps/start
FastAPI → ROS2: slam_toolbox launch
slam_toolbox → TurtleBot/Sim: /scan, /odom 구독
slam_toolbox → rosbridge → UI: /map 발행 (실시간 격자맵)
User → UI: WASD/조이스틱 → /cmd_vel → cmd_vel_mux → TurtleBot
User → UI: 저장 클릭
UI → FastAPI: POST /maps/save {name}
FastAPI → ROS2: /save_map 서비스 호출
FastAPI: 썸네일 생성, Prisma.map.create
FastAPI → UI: {mapId} 응답
```

### 5.2 시나리오 B — 자율주행 미션

```
User → UI: 맵 클릭 (x, y) [선택 Shift+드래그로 theta]
UI → FastAPI: POST /missions {mapId, goalX, goalY, goalTheta}
FastAPI: Prisma.mission.create (status="pending")
FastAPI → Nav2 Action: navigate_to_pose.send_goal_async
Nav2 → FastAPI: goal accepted, status="running"
Nav2 → FastAPI: feedback (distance_remaining, ETA)
FastAPI → UI (WebSocket): mission status push
Nav2 → FastAPI: result (success/failure)
FastAPI: Prisma.mission.update (status="succeeded", finishedAt)
FastAPI → UI: final push
```

### 5.3 시나리오 C — 비상 정지 (3중 백업)

```
User → UI: E-Stop 클릭 (또는 스페이스바)
UI: 3개 채널 동시 발화
  Ch1: HTTP POST /emergency-stop
       → FastAPI: cancel_goal (Nav2) + /cmd_vel=0 (100ms × 10회)
  Ch2: WebSocket "emergency_stop"
       → rosbridge: /cmd_vel=0 직접 publish
  Ch3: roslibjs ActionClient.cancel_goal() 직접 호출
UI: 하나라도 ACK 받으면 "정지 확인" 표시
모두 실패: "물리적 전원 차단을 시도하세요" 모달
```

### 5.4 시나리오 D — sim/real 전환

```
설정 파일: ~/.amrdetail/config.yaml
  robot_mode: "sim" | "real"
  robot_ip: "192.168.0.42"  (real 전용)

CLI:
  amrdetail-launch sim   ← gazebo + slam/nav2 + rosbridge
  amrdetail-launch real  ← (turtlebot ssh & bringup) + slam/nav2 + rosbridge

UI: GET /system/mode로 모드 판별, 헤더에 배지 표시 ("SIM"/"REAL")

핵심: sensor 토픽명은 양쪽 모드에서 동일 (/scan, /odom)
      → SLAM/Nav2 코드는 모드 무지(blind)
      → use_sim_time만 다름
```

## 6. UI 화면 설계

총 **7개 화면**. 와이어프레임은 분량 관계로 핵심만 요약. 자세한 ASCII 와이어프레임은 브레인스토밍 대화 기록 참조.

### 6.1 화면 목록

| 경로 | 화면명 | 핵심 기능 |
|---|---|---|
| `/` | 대시보드 | 시스템 상태, 현재 맵, 빠른 작업 진입 |
| `/map/new` | 맵 빌더 | SLAM 실시간 매핑, teleop, 맵 저장 |
| `/maps` | 맵 관리 | 저장 맵 목록, 썸네일, 활성화, 삭제, 내보내기 |
| `/navigate` | 자율주행 콘솔 | 맵 클릭→목표 지정, 진행률, E-Stop, 랜드마크 드롭다운 |
| `/landmarks` | 랜드마크 관리 | 위치 이름 부여 (`회의실 입구` 등), CRUD |
| `/missions` | 미션 히스토리 | 필터/검색 가능한 미션 로그 + 상세 패널 |
| `/diagnostics` | 시스템 진단 | ROS 노드 상태, 토픽 hz, 에러 로그, TF 트리 |

### 6.2 디자인 토큰 (Tailwind 기반)

| 용도 | 클래스 | 색상 |
|---|---|---|
| 액센트 Primary | `bg-indigo-600 text-white` | #4F46E5 |
| 성공 | `bg-emerald-500` | #10B981 |
| 위험/E-Stop | `bg-red-600` | #DC2626 |
| 경고/REAL 모드 | `bg-amber-500` | #F59E0B |
| 정보/SIM 모드 | `bg-blue-500` | #3B82F6 |
| 배경 | `bg-neutral-50` / `bg-white` | |
| 텍스트 | `text-neutral-900 / 600` | |

### 6.3 핵심 UI 규칙
- E-Stop은 항상 화면 우측 상단 + 스페이스바 글로벌 hotkey
- 헤더에 모드 배지 (SIM 노란색 / REAL 빨간색) 상시 표시
- 색맹 대응: 상태 아이콘은 색뿐 아니라 모양(✅❌🛑)도 함께 사용
- 데스크탑 우선. 모바일은 미션 히스토리만 잘 보이도록 반응형
- 한국어 only, i18n 구조(next-intl 골격)만 준비

## 7. 에러 처리 및 안전 장치

### 7.1 실패 모드 매트릭스

| 실패 유형 | 감지 방법 | 대응 | UI 표시 |
|---|---|---|---|
| TurtleBot WiFi 끊김 | `/odom` 1s 미수신 | Nav2 자동 정지 + UI 알림 | 빨간 배너 |
| rosbridge 끊김 | WebSocket `onclose` | 지수 백오프 재연결 (1s→16s) | 헤더 ●Reconnecting |
| FastAPI 다운 | HTTP 5xx / fetch 실패 | 토스트 + 재시도 버튼 | "서버 응답 없음" |
| SLAM 노드 크래시 | rclpy alive 체크 (5s) | 자동 재시작 1회 시도 | 모달 |
| Nav2 경로 계획 실패 | 액션 result != SUCCESS | DB에 실패 사유 기록 | 미션 카드 ❌ |
| 미션 타임아웃 | FastAPI 60s watchdog | cancel_goal + status=failed | "시간 초과" |
| 활성 맵 없음 | 자율주행 진입 시 체크 | 맵 선택 모달 | "맵을 먼저 선택하세요" |

### 7.2 E-Stop 신뢰성 (3중 백업)

E-Stop은 단일 채널 실패가 곧 사고이므로:
- **Ch1 (HTTP)**: FastAPI가 cancel_goal + /cmd_vel=0 반복
- **Ch2 (WebSocket)**: rosbridge 직접 /cmd_vel=0 publish
- **Ch3 (Direct)**: 브라우저 roslibjs ActionClient.cancel_goal

하나라도 ACK 시 정지 확인. 모두 실패 시 물리적 전원 차단 안내.

### 7.3 cmd_vel 우선순위 (cmd_vel_mux)

```
E-Stop      → priority 100 (최고)
Nav2        → priority 50
UI Teleop   → priority 30
Keyboard    → priority 10
```

### 7.4 로깅/모니터링
- **백엔드 로그**: `structlog` JSON 포맷, `~/.amrdetail/logs/bridge-YYYYMMDD.log`
- **ROS2 로그**: 기본 `~/.ros/log/`, 미션 단위로 경로를 `Mission.rosLogDir`에 기록
- **rosbag 자동 녹화**: 미션 시작 시 자동 시작, 종료 시 중단. `~/.amrdetail/rosbags/<missionId>/` 저장
- **프론트엔드 로그**: 콘솔만 (별도 수집 없음, MVP 범위)

## 8. Phase 2 확장 인터페이스

가장 중요한 절. 여기 명세된 인터페이스를 Phase 1에서 미리 못박아야 Phase 2 통합 시 재작업이 없다.

### 8.1 `PoseCorrector` 추상화 (FastAPI)

```python
# apps/bridge/src/services/pose_corrector.py
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

@dataclass
class Pose2D:
    x: float
    y: float
    theta: float                  # radians
    covariance: list[float]       # 3x3 flattened (x, y, theta)
    timestamp: float
    source: str                   # "amcl" | "slam" | "zed" | "fused"

@dataclass
class ArrivalReport:
    error_m: float                # 목표-실제 거리 오차
    error_rad: float              # 방향 오차
    confidence: str               # "low" | "medium" | "high"
    source: str

class PoseCorrector(ABC):
    """Phase 1: 패스스루. Phase 2: ZED 융합 구현체로 교체."""

    @abstractmethod
    def get_current_pose(self) -> Optional[Pose2D]: ...

    @abstractmethod
    def evaluate_arrival(self, goal: Pose2D, actual: Pose2D) -> ArrivalReport: ...


class PassthroughCorrector(PoseCorrector):
    """Phase 1 구현: AMCL pose 그대로."""
    def __init__(self, ros_listener):
        self.listener = ros_listener

    def get_current_pose(self):
        return self.listener.latest_amcl_pose()

    def evaluate_arrival(self, goal, actual):
        from math import hypot
        return ArrivalReport(
            error_m=hypot(goal.x - actual.x, goal.y - actual.y),
            error_rad=abs(goal.theta - actual.theta),
            confidence="low",
            source="amcl"
        )


# Phase 2에서 구현 예정
class ZedFusedCorrector(PoseCorrector):
    """ZED Object Detection + AMCL EKF 융합."""
    pass
```

UI/미션 서비스는 항상 `PoseCorrector` 인터페이스만 호출. 교체는 `corrector_factory.py` 한 줄 변경.

### 8.2 ROS2 토픽 별칭 전략

UI는 항상 `/pose_for_ui`만 구독. 별칭 매핑은 launch 파일에서 처리:

```python
# Phase 1: pose_for_ui ← amcl_pose
Node(executable='topic_relay', arguments=['/amcl_pose', '/pose_for_ui'])

# Phase 2: pose_for_ui ← corrected_pose
Node(executable='topic_relay', arguments=['/corrected_pose', '/pose_for_ui'])
```

UI 코드 변경 0줄로 Phase 2 통과 가능.

### 8.3 DB 스키마 확장 슬롯

Phase 1 `Mission` 테이블에 nullable 필드 미리 추가 (4.5 참조). Phase 1에서는 항상 `null`, Phase 2에서 채움. 마이그레이션 부담 0.

### 8.4 UI 컴포넌트 미리 준비

- 미션 상세 패널의 "실제 도착" / "오차" 항목은 Phase 1에서 `<ArrivalReport mission={m} />` 컴포넌트로 작성
- 데이터가 null이면 "Phase 2 활성화 시 표시" placeholder 표시
- Phase 2 진입 시 컴포넌트 로직 변경 불필요, 데이터만 채워짐

## 9. 프로젝트 폴더 구조

```
AMRDetail/
├── apps/
│   ├── web/                          # Next.js 15
│   │   ├── app/
│   │   │   ├── page.tsx              # 대시보드
│   │   │   ├── map/new/page.tsx
│   │   │   ├── maps/page.tsx
│   │   │   ├── navigate/page.tsx
│   │   │   ├── landmarks/page.tsx
│   │   │   ├── missions/page.tsx
│   │   │   └── diagnostics/page.tsx
│   │   ├── components/
│   │   │   ├── map/                  # MapCanvas, RobotMarker, GoalPicker
│   │   │   ├── mission/              # MissionStatus, ArrivalReport
│   │   │   ├── ros/                  # ROSProvider (roslibjs)
│   │   │   └── ui/                   # 공통 UI
│   │   ├── lib/
│   │   │   ├── api-client.ts
│   │   │   ├── ros-client.ts
│   │   │   └── stores/               # zustand
│   │   ├── public/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── bridge/                       # FastAPI + Prisma
│       ├── src/
│       │   ├── api/                  # FastAPI 라우터
│       │   ├── services/             # 비즈니스 로직
│       │   ├── ros/                  # rclpy 노드
│       │   └── main.py
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── seed.py
│       ├── tests/
│       ├── pyproject.toml
│       └── .env.example
│
├── ros2_ws/
│   └── src/
│       ├── amrdetail_bringup/
│       ├── amrdetail_slam/
│       ├── amrdetail_navigation/
│       ├── amrdetail_safety/
│       └── amrdetail_msgs/
│
├── configs/
│   ├── slam_toolbox.yaml
│   ├── nav2.yaml
│   ├── rosbridge.yaml
│   └── cyclonedds.xml
│
├── scripts/
│   ├── amrdetail-launch              # sim|real 모드 진입 CLI
│   ├── setup-turtlebot.sh
│   ├── seed-demo-data.sh
│   └── healthcheck.sh
│
├── docs/
│   ├── superpowers/
│   │   ├── specs/
│   │   │   └── 2026-06-04-amr-detail-design.md
│   │   └── plans/                    # writing-plans로 생성 예정
│   ├── setup-guide.md
│   └── architecture.md
│
├── .env.example
├── README.md
├── CLAUDE.md
├── package.json                      # 모노레포 루트
└── pnpm-workspace.yaml
```

**핵심 원칙**
- Prisma 스키마는 `apps/bridge/prisma/schema.prisma` 단일. Next.js는 HTTP로만 접근.
- ROS2 워크스페이스는 별도. `colcon build`가 Node/Python 빌드와 격리.
- `configs/`는 모든 launch 파일이 공유 참조.

## 10. 마일스톤

총 4단계, 예상 **3-4주** (1인 풀타임 기준).

### 10.1 Milestone 1A — 인프라 셋업 (3-4일)
**목표: sim 환경에서 전체 스택 가동 (Hello World)**

- [ ] 모노레포 초기화 (pnpm workspaces)
- [ ] Next.js 15 + Tailwind 부트스트랩
- [ ] FastAPI 프로젝트 부트스트랩 + Prisma 스키마 초안
- [ ] ROS2 워크스페이스 + `amrdetail_msgs` 패키지
- [ ] Gazebo `turtlebot3_world` 실행 launch
- [ ] rosbridge_server 연결 확인 (UI에서 `/odom` 토픽 수신 표시)
- [ ] sim/real CLI (`amrdetail-launch sim`) 동작
- [ ] `.env.example` + 설치 가이드 (`docs/setup-guide.md`) 초안

**완료 기준**: `amrdetail-launch sim` 실행 → Gazebo 켜짐 → UI 대시보드 "● Connected" 표시

### 10.2 Milestone 1B — SLAM + 맵 관리 (4-5일)
**목표: sim에서 맵 만들고 저장하고 다시 불러오기**

- [ ] `amrdetail_slam` 패키지에 slam_toolbox 설정
- [ ] 맵 빌더 화면 (`/map/new`) — 실시간 OccupancyGrid 렌더링
- [ ] UI 조이스틱 + 키보드 teleop으로 `/cmd_vel` 발행
- [ ] `amrdetail_safety/cmd_vel_mux` 도입 (Nav2 vs Teleop 우선순위)
- [ ] 맵 저장 API (`POST /maps/save`) — PGM/YAML + 썸네일 생성
- [ ] 맵 관리 화면 (`/maps`) — 목록, 활성화, 삭제, 내보내기
- [ ] Prisma Map 모델 + 마이그레이션
- [ ] **실기 TurtleBot 연결 검증** (이 시점에 첫 실기 테스트)

**완료 기준**: sim과 real 양쪽에서 맵 생성→저장→다른 세션에서 로드 성공

### 10.3 Milestone 1C — Nav2 + 자율주행 + 미션 (5-7일)
**목표: 클릭 한 번으로 자율주행 완주**

- [ ] `amrdetail_navigation` Nav2 설정 (planner, controller, behavior, AMCL)
- [ ] map_server로 저장된 맵 로드
- [ ] 자율주행 콘솔 (`/navigate`) — 맵 클릭→목표, Shift+드래그로 theta
- [ ] FastAPI `mission_service`: `navigate_to_pose` 액션 클라이언트
- [ ] WebSocket 미션 진행 상태 푸시 (feedback → UI)
- [ ] E-Stop 3채널 (HTTP + WS + 클라이언트 직접)
- [ ] `PoseCorrector` 추상화 + `PassthroughCorrector` 구현
- [ ] 미션 히스토리 화면 (`/missions`) + Prisma Mission, PoseLog
- [ ] rosbag 자동 녹화 (미션 단위)

**완료 기준**: sim과 real에서 맵 클릭 → 도착 → DB success 기록 + 이력 조회 가능

### 10.4 Milestone 1D — 추가 화면 + 마무리 (3-4일)
**목표: 운영 편의 기능 + 안정화**

- [ ] 랜드마크 관리 (`/landmarks`) + Prisma Landmark 모델
- [ ] 자율주행 화면에 랜드마크 드롭다운 통합
- [ ] 시스템 진단 (`/diagnostics`) — 노드 상태, 토픽 hz, 에러 로그
- [ ] 대시보드 시스템 상태 패널 완성
- [ ] E2E 테스트: Playwright로 sim 자동 시나리오 1개
- [ ] launch_testing으로 ROS2 통합 테스트
- [ ] README + 설치 가이드 최종화
- [ ] 시드 스크립트 (데모용 맵 + 랜드마크)

**완료 기준**: 신규 사용자가 `docs/setup-guide.md`만 보고 30분 내 sim 실행 + 자율주행 데모 가능

### 10.5 위험 완화 일정

| 마일스톤 | 위험 | 완화 |
|---|---|---|
| 1A | ROS2 DDS WiFi 디스커버리 실패 | cyclonedds.xml 미리 준비, fastrtps 대안 검토 |
| 1B | 실기 TurtleBot 연결 실패 | 1B 시작 시 가장 먼저 시도 |
| 1C | Nav2 파라미터 튜닝 시간 폭증 | TurtleBot3 공식 파라미터 그대로 사용, 튜닝은 Phase 3 |
| 1D | E2E sim 시작 시간 ~30초 | 로컬에서만 실행 옵션 추가 |

## 11. 테스트 전략

| 레이어 | 테스트 종류 | 도구 |
|---|---|---|
| Frontend | 단위(컴포넌트) + E2E (sim 환경) | Vitest + Playwright |
| FastAPI | 단위(서비스) + 통합(rclpy mock) | pytest |
| ROS2 노드 | launch 통합 테스트 (Gazebo 자동) | `launch_testing` |
| 시스템 | sim에서 자동 미션 시나리오 | bash + Playwright |

### Phase 1 최소 통과 기준 (재확인)
1. Gazebo sim에서 맵 생성→저장→자율주행 미션 성공 (1회)
2. 실기 TurtleBot에서 동일 시나리오 성공 (1회)
3. E-Stop 3채널 모두 단위 테스트 통과
4. WiFi 인위 단절 시 자동 정지 + 재연결 동작 확인

## 12. Phase 1 데모 시나리오

```
1. amrdetail-launch sim
2. 브라우저 → http://localhost:3000
3. 대시보드 → "새 맵 만들기"
4. SLAM 화면에서 WASD로 로봇 이동 → 맵 완성 → "회의실A" 저장
5. 맵 관리 → "회의실A" 활성화
6. 랜드마크 추가 → "프린터 앞", "회의실 입구"
7. 자율주행 화면 → 드롭다운 "프린터 앞" 선택 → 주행 시작
8. 도착 후 미션 히스토리 확인
9. (실기) amrdetail-launch real → 동일 시연
```

## 13. Out of Scope (Phase 2+)

이번 스펙 범위에서 의도적으로 제외된 항목. 별도 스펙으로 진행 예정.

### Phase 2 — ZED 2i 천장 카메라 통합
- [ ] ZED SDK 설치 및 ROS2 wrapper 구성 (CUDA 환경 확인)
- [ ] 카메라 캘리브레이션 워크플로우 (intrinsic + extrinsic)
- [ ] 로봇 추적 (ArUco/AprilTag 마커 또는 ZED Object Detection)
- [ ] `robot_localization` EKF 융합 노드 설정
- [ ] `/corrected_pose` 토픽 발행 노드 구현
- [ ] `PassthroughCorrector` → `ZedFusedCorrector` 교체
- [ ] 신규 화면 3개:
  - `/camera` — 라이브 카메라 뷰 + 로봇 오버레이
  - `/accuracy` — 정확도 통계 대시보드 (오차 히트맵 등)
  - `/calibration` — 캘리브레이션 가이드 워크플로우
- [ ] DB 컬럼 활용: `Mission.actualArrivalX/Y/Theta`, `arrivalErrorM`
- [ ] `CameraCalibration`, `AccuracyReport` 테이블 추가

### Phase 3 — 운영 기능
- [ ] 인증/권한 (멀티유저)
- [ ] 설정 페이지 (UI에서 파라미터 조정)
- [ ] 다중 웨이포인트 / 순회 경로
- [ ] 로봇 디버그 뷰 (라이다 raw, costmap 시각화)
- [ ] 다국어 (i18n 활성화)
- [ ] 외부 배포 (Docker, CI/CD)
- [ ] Nav2 파라미터 튜닝 가이드

## 14. 결정 보류 사항 (구현 단계에서 정함)

- 맵 파일 저장 경로 디폴트: `~/.amrdetail/maps/<map-id>/{map.pgm, map.yaml}` (변경 가능)
- 미션 큐 정책: "1개만 허용, 추가 요청 시 409 응답" (변경 가능)
- rosbag 디스크 정책: 30일 후 자동 삭제 또는 수동 (구현 시 결정)
- ROS_DOMAIN_ID: 30 (기본값, 환경 충돌 시 변경)

## 15. 참조 문서 (외부)

- [TurtleBot3 e-Manual (ROS2 Humble)](https://emanual.robotis.com/docs/en/platform/turtlebot3/overview/)
- [slam_toolbox GitHub](https://github.com/SteveMacenski/slam_toolbox)
- [Nav2 Documentation](https://docs.nav2.org/)
- [rosbridge_suite](https://github.com/RobotWebTools/rosbridge_suite)
- [roslibjs](https://github.com/RobotWebTools/roslibjs)
- [ZED 2i SDK (Phase 2 참조)](https://www.stereolabs.com/docs/)

---

**문서 끝.**
