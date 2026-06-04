# AMRDetail

TurtleBot3 Waffle Pi 기반 실내 자율주행 + 웹 관제 시스템.

## 프로젝트 단계

- **Phase 1** (현재 설계 완료, 구현 예정): SLAM + Nav2 자율주행 + Next.js 웹 관제
- **Phase 2** (후속): ZED 2i 천장 카메라로 위치 정확도 보정
- **Phase 3** (후속): 운영 기능 (인증, 다중 웨이포인트 등)

## 디자인 문서

- [Phase 1 디자인 문서](./docs/superpowers/specs/2026-06-04-amr-detail-design.md)

## 스택

- ROS2 Humble (Ubuntu 22.04)
- TurtleBot3 Waffle Pi + LDS-02 LiDAR
- slam_toolbox + Nav2
- Next.js 15 + TypeScript + Tailwind + roslibjs
- FastAPI + Prisma + SQLite
- rosbridge_server

## 상태

설계 단계 (구현 계획 작성 중).
