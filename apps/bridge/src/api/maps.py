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
        from prisma import Prisma  # lazy: requires generated client at runtime

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
