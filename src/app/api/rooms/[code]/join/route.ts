import { NextResponse } from "next/server";
import { joinRoom } from "@/lib/rooms";

export const runtime = "nodejs";

type Params = { params: Promise<{ code: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { code } = await params;
    const body = await request.json();
    const result = await joinRoom(code, body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to join room";
    const status =
      message === "Room not found"
        ? 404
        : message.includes("required") || message.includes("Invalid")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
