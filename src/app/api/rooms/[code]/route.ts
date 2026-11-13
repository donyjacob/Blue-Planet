import { NextResponse } from "next/server";
import { getRoomSnapshot, updateRoom } from "@/lib/rooms";

export const runtime = "nodejs";

type Params = { params: Promise<{ code: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { code } = await params;
    const snapshot = await getRoomSnapshot(code);
    if (!snapshot) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load room";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { code } = await params;
    const token = request.headers.get("x-member-token");
    const body = await request.json();
    const patch: { lockedUtcHour?: number | null; meetUrl?: string | null } = {};

    if ("lockedUtcHour" in body) {
      patch.lockedUtcHour =
        body.lockedUtcHour === null || body.lockedUtcHour === undefined
          ? null
          : Number(body.lockedUtcHour);
    }
    if ("meetUrl" in body) {
      patch.meetUrl = body.meetUrl === undefined ? undefined : body.meetUrl;
    }

    if (patch.lockedUtcHour === undefined && patch.meetUrl === undefined) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const room = await updateRoom(code, token, patch);
    return NextResponse.json({ room });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update room";
    const status =
      message === "Unauthorized"
        ? 401
        : message.includes("Invalid") || message.includes("not found")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
