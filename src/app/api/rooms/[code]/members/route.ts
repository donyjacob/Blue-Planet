import { NextResponse } from "next/server";
import { addFriend, updateMyLocation } from "@/lib/rooms";

export const runtime = "nodejs";

type Params = { params: Promise<{ code: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { code } = await params;
    const token = request.headers.get("x-member-token");
    const body = await request.json();
    const member = await addFriend(code, token, body);
    return NextResponse.json({ member });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add friend";
    const status =
      message === "Unauthorized"
        ? 401
        : message.includes("required") || message.includes("full")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { code } = await params;
    const token = request.headers.get("x-member-token");
    const body = await request.json();
    const member = await updateMyLocation(code, token, body);
    return NextResponse.json({ member });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update location";
    const status =
      message === "Unauthorized"
        ? 401
        : message.includes("required") || message.includes("Invalid")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
