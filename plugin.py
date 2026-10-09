"""Dashboard layout belongs to this plugin; current device state belongs to HDO."""
from fastapi import HTTPException

def activate(ctx):
    async def read(request, context):
        return context.store.get("layout", {"devices": [], "widgets": []})

    async def save(request, context):
        layout = await request.json()
        if not isinstance(layout, dict) or set(layout) - {"devices", "widgets"}:
            raise HTTPException(422, "Invalid dashboard layout")
        if not isinstance(layout.get("devices"), list) or len(layout["devices"]) > 500 or any(not isinstance(id, str) for id in layout["devices"]):
            raise HTTPException(422, "Invalid device list")
        if not isinstance(layout.get("widgets", []), list) or len(layout.get("widgets", [])) > 100:
            raise HTTPException(422, "Invalid widget list")
        context.store.set("layout", layout)
        return layout

    ctx.route("layout", read, role="user")
    ctx.route("layout", save, methods=("PUT",))
