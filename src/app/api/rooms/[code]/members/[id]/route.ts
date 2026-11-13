import { NextResponse } from "next/server";
import { removeMember } from "@/lib/rooms";

export const runtime = "nodejs";

type Params = { params: Promise<{ code: string; id: string }> };

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { code, id } = await params;
    const token = request.headers.get("x-member-token");
    await removeMember(code, token, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove member";
    const status =
      message === "Unauthorized"
        ? 401
        : message.includes("cannot") || message.includes("Invalid")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
