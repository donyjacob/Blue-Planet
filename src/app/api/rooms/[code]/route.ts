import { NextResponse } from "next/server";
import { getRoomSnapshot, updateLockedHour } from "@/lib/rooms";

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
    const locked =
      body.lockedUtcHour === null || body.lockedUtcHour === undefined
        ? null
        : Number(body.lockedUtcHour);
    const room = await updateLockedHour(code, token, locked);
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
