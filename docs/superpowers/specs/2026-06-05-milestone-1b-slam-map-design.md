# Milestone 1B — SLAM + 맵 관리 설계

> 상위 설계: `docs/superpowers/specs/2026-06-04-amr-detail-design.md` (§10.2). 이 문서는 1B 마일스톤 범위로 구체화한 설계다.
> 작성일: 2026-06-05 · 선행: Milestone 1A 완료(`milestone-1a` 태그).

## 1. 목표 & 범위

**목표:** Gazebo sim에서 **맵 생성 → 저장 → 다른 세션에서 로드**까지 완성한다.

**범위 = SIM 전용.** 실기 TurtleBot 연결 검증은 하드웨어가 준비된 별도 세션으로 미룬다(스펙 §10.2의 "실기 연결 검증" 항목은 1B 코드 범위에서 제외).

**완료 기준:**
- `amrdetail-launch sim` 실행 시 gazebo + slam_toolbox + twist_mux + rosbridge + bridge + web이 함께 기동된다.
- `/map/new`에서 실시간 OccupancyGrid가 보이고, UI teleop(조이스틱/WASD)으로 로봇을 움직여 맵을 채울 수 있다.
- 맵 이름을 입력해 저장하면 pgm/yaml/썸네일이 생성되고 DB에 메타데이터가 기록된다.
- `/maps`에서 저장된 맵이 썸네일·메타데이터와 함께 보이고, 활성화/삭제/내보내기가 동작한다.
- 활성화한 맵이 대시보드 "현재 맵"에 표시된다(새 세션에서 다시 열어도 유지).
- web vitest + bridge pytest 통과.

## 2. 결정 요약 (브레인스토밍)

| 항목 | 결정 |
|---|---|
| 범위 | sim 전용 (실기 보류) |
| SLAM 생명주기 | **상시 기동** (sim launch 포함). 온디맨드 start/stop은 1C(모드 전환)로 보류 |
| "로드" 범위 | 저장 파일 유효 + `/maps` 표시 + 활성화(isActive)·대시보드 반영. **map_server 실시간 `/map` 재발행은 1C**로 보류 |
| 맵 빌더 레이아웃 | **B (우측 사이드바)** — 좌측 큰 맵 + 우측 컨트롤 패널. 컨트롤은 독립 패널 컴포넌트로 모듈화(배치 변경 용이, 런타임 드래그 재배치는 비범위) |
| 맵 렌더링 | **react-konva** — OccupancyGrid를 오프스크린 canvas `ImageData`(셀당 1px)로 그려 `Konva.Image`로 스케일. 1C 오버레이 확장 유리 |
| Teleop 입력 | **nipplejs 조이스틱 + WASD** 키 → `/cmd_vel_teleop` 발행 |
| cmd_vel 안전 | `twist_mux` 도입(우선순위 seam 선구축). 1B는 `cmd_vel_teleop`만 활성 |
| 로봇 위치 표시 | `/odom` (AMCL·`/pose_for_ui`는 1C) |

## 3. 아키텍처 — 1A 위에 추가되는 것

```
Browser (Next.js :3000)
  ├─ HTTP  → FastAPI :8000  /maps/*  (저장·목록·활성화·삭제·내보내기, DB 게이트웨이)
  └─ WS    → rosbridge :9090  /map(OccupancyGrid 구독), /odom(구독), /cmd_vel_teleop(발행)

FastAPI bridge (rclpy 노드)
  └─ /slam_toolbox/save_map 서비스 호출 → pgm/yaml → 썸네일(Pillow) → Prisma

ROS2 (amrdetail-launch sim)
  gazebo(turtlebot3_world) → /scan /odom
  slam_toolbox(online_async) → /map (latched), /slam_toolbox/save_map 서비스
  twist_mux → /cmd_vel  (입력 우선순위 estop>nav>teleop>kbd)
  rosbridge_server :9090
```

**유지하는 핵심 규칙:** ① DB 쓰기는 FastAPI만(Next는 HTTP). ② 실시간 `/map`은 rosbridge 직접 구독(FastAPI 우회). ③ sim/real 토픽명 동일·SLAM 코드 모드 무지(1B는 sim launch만 작성). ④ UI는 `/amcl_pose` 직접 구독 금지(`/pose_for_ui`는 1C에서 도입).

## 4. ROS2 패키지

### 4.1 `amrdetail_slam`
- `config/slam_toolbox.yaml` — `online_async` 모드 파라미터. TurtleBot3 공식값 기반, `use_sim_time: true`(sim).
- `launch/slam.launch.py` — slam_toolbox `async_slam_toolbox_node` + config 로드, `use_sim_time` 인자.
- 노출 서비스: `/slam_toolbox/save_map`(`slam_toolbox/srv/SaveMap`) — 저장 API가 호출.
- 빌드: `ament_cmake` — `launch/`, `config/` 디렉터리를 `share/`에 install (`amrdetail_bringup`과 동일 패턴).

### 4.2 `amrdetail_safety`
- `config/twist_mux.yaml` — topics & 우선순위:
  - `cmd_vel_estop`(100) > `cmd_vel_nav`(50) > `cmd_vel_teleop`(30) > `cmd_vel_keyboard`(10), 출력 `/cmd_vel`.
  - 1B는 `cmd_vel_teleop`만 실제 발행됨. 나머지는 설정만(1C/safety에서 채움).
- `launch/safety.launch.py` — `twist_mux` 노드 기동(또는 sim.launch.py에 직접 포함).
- gazebo diff-drive가 `/cmd_vel` 구독 → twist_mux 출력과 직접 연결.

### 4.3 `amrdetail_bringup/launch/sim.launch.py` (수정)
- 기존(turtlebot3_world + rosbridge)에 **slam_toolbox + twist_mux 추가**. 한 번의 `ros2 launch`로 전체 sim 스택 기동.

### 4.4 `scripts/amrdetail-launch` (영향 없음/소폭)
- sim 모드는 위 sim.launch.py를 그대로 호출하므로 추가 변경 최소. (1A에서 발견된 web 자식 조기 종료 이슈는 `setsid`로 하드닝 검토 — 구현 계획에서 다룸.)

## 5. Bridge (FastAPI)

### 5.1 Prisma
- `Map` 모델은 **1A Task 6에서 스펙 §4.5와 동일하게 이미 생성**됨 → **새 마이그레이션 불필요**. (Mission 관계 필드는 1C에서 추가)

### 5.2 `src/services/map_service.py`
- rclpy 싱글톤 노드(백그라운드 executor)로 ROS2 참여. ROS 소싱 환경에서 실행(런처가 소싱).
- 기능:
  - `save_map(name)` → `/slam_toolbox/save_map` 호출(경로 `AMRDETAIL_MAPS_DIR/<cuid>/map`) → yaml 파싱(resolution, origin x/y) + pgm 헤더(width/height) → Pillow 썸네일(`thumb.png`, 장변 ~200px) → `prisma.map.create(...)`.
  - `list_maps()`, `get_active()`, `activate(id)`(타 맵 isActive=false), `delete(id)`(디렉터리+row), `export(id)`(zip: map.pgm/map.yaml/thumb.png).
- 저장 경로: env `AMRDETAIL_MAPS_DIR`, 기본 `~/.amrdetail/maps/`.

### 5.3 `src/api/maps.py` (라우터)
| 메서드 | 경로 | 동작 |
|---|---|---|
| POST | `/maps/save` | `{name}` → 저장, `{mapId,...}` 반환 |
| GET | `/maps` | 목록 |
| GET | `/maps/active` | 활성 맵(없으면 null) |
| POST | `/maps/{id}/activate` | 활성화 |
| DELETE | `/maps/{id}` | 삭제 |
| GET | `/maps/{id}/export` | zip 스트림 |

- 에러: 이름 중복(409), 활성 맵 없음(null 반환), save 서비스 타임아웃(503).

## 6. Web (Next.js)

### 6.1 라우트
- `app/map/new/page.tsx` — 맵 빌더(레이아웃 B).
- `app/maps/page.tsx` — 맵 관리.
- 대시보드(`app/page.tsx`) — "현재 맵" 카드를 `GET /maps/active`로 연동, "새 맵 만들기"→`/map/new`, "맵 관리"→`/maps` 링크.

### 6.2 컴포넌트 (`components/map/`)
- `MapCanvas.tsx` — react-konva. `/map` OccupancyGrid 구독 → 오프스크린 canvas `ImageData`(점유=검정/자유=흰색/미지=회색, 셀당 1px) → `Konva.Image`로 해상도 스케일. `/odom` 로봇 마커(원+heading) 오버레이. 모듈화된 표시 전용 컴포넌트.
- `Teleop.tsx` — nipplejs 조이스틱(터치/마우스) + 키보드 WASD. 입력 → `geometry_msgs/Twist`를 `/cmd_vel_teleop`로 주기 발행(키 뗌/조이스틱 해제 시 0). 독립 패널.
- `MappingStatus.tsx` — `/map` 수신 hz, 로봇 x/y, 연결 상태 표시. 독립 패널.
- `SaveMapPanel.tsx` — 맵 이름 입력 + 저장 버튼 → `POST /maps/save` → 토스트 + `/maps` 이동.
- `MapList.tsx` / `MapCard.tsx` — 썸네일 카드(이름·생성일·active 뱃지·활성화/삭제/내보내기 버튼).

> 레이아웃 B는 `/map/new`에서 좌측 `MapCanvas` + 우측 사이드바(`Teleop`·`MappingStatus`·`SaveMapPanel`)를 배치. 각 패널은 독립 컴포넌트라 배치 변경이 쉽다.

### 6.3 lib
- `lib/ros-client.ts` — 기존 `subscribeTopic`에 더해 **`publishTopic`/`getTopic`** 헬퍼 추가(`/cmd_vel_teleop` 발행용). `unknown` 좁히기 패턴 유지(`any` 금지).
- `lib/maps-api.ts` — `/maps/*` HTTP 래퍼(`NEXT_PUBLIC_BRIDGE_URL`). Next는 DB 직접접근 금지.

## 7. 데이터 흐름 — 맵 저장

```
(상시) slam_toolbox → /map (latched) → rosbridge → MapCanvas 실시간 렌더
User → Teleop → /cmd_vel_teleop → twist_mux → /cmd_vel → gazebo (로봇 이동, 맵 확장)
User → SaveMapPanel: 이름 입력 + 저장
  → POST /maps/save {name}
  → bridge: /slam_toolbox/save_map (pgm/yaml 생성)
  → bridge: 썸네일 생성 + yaml/pgm 메타 파싱 + prisma.map.create
  → {mapId} 응답 → 토스트 → /maps 이동
```

## 8. 테스트

- **web (vitest):** MapCanvas가 mock OccupancyGrid를 렌더(셀→픽셀 매핑), Teleop이 입력에 맞는 Twist를 `/cmd_vel_teleop`로 발행, MapList/MapCard 렌더 및 액션 호출.
- **bridge (pytest):** rclpy 서비스 클라이언트 mock + `tmp_path` fs로 `save_map`(파일·썸네일·DB row·yaml/pgm 파싱), `/maps` 엔드포인트(prisma mock), export zip 내용.
- **ros2:** 정식 `launch_testing`은 1D. 1B는 `amrdetail-launch sim` 수동 E2E(맵 생성→저장→`/maps` 재확인)로 완료 기준 검증(1A처럼 WSL + Playwright 캡처 가능).

## 9. 비범위 (1C 이후로 명시 보류)

- `map_server`로 저장 맵 `/map` 실시간 재발행, 온디맨드 SLAM start/stop(`POST /maps/start`).
- AMCL, `/pose_for_ui`, Nav2, `navigate_to_pose`, E-Stop 3채널.
- 실기 TurtleBot 연결/SSH bringup, real launch.
- Mission/PoseLog 모델·미션 히스토리, 랜드마크 화면.
- 런타임 레이아웃 드래그 재배치.

## 10. 가정 & 리스크

- rclpy는 ROS2 설치에서 제공 → bridge는 반드시 ROS 소싱 환경(WSL)에서 실행. pyproject로는 설치 불가(런처가 소싱하므로 OK).
- slam_toolbox `/save_map` 경로/권한: `AMRDETAIL_MAPS_DIR` 쓰기 가능해야 함.
- `/map`은 latched(transient_local) — rosbridge 구독 QoS 설정 필요할 수 있음(구현 시 확인).
- WSL `/mnt/c` 성능 이슈로 작업 복사본은 네이티브 FS(`~/amrdetail`)에서 빌드/실행(1A와 동일).
