import { randomBytes, randomUUID } from "node:crypto";
import { sql } from "@/lib/db";

export type RoomRow = {
  code: string;
  name: string;
  locked_utc_hour: number | null;
  created_at: string | Date;
};

export type MemberRow = {
  id: string;
  room_code: string;
  token: string;
  name: string;
  city: string;
  country: string;
  tz: string;
  flag: string;
  updated_at: string | Date;
};

export type PublicMember = {
  id: string;
  name: string;
  city: string;
  country: string;
  tz: string;
  flag: string;
  updatedAt: number;
};

export type PublicRoom = {
  code: string;
  name: string;
  lockedUtcHour: number | null;
};

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRoomCode(): string {
  let code = "";
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[bytes[i]! % CODE_CHARS.length];
  }
  return code;
}

function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

function toPublicMember(row: MemberRow): PublicMember {
  const updated =
    row.updated_at instanceof Date
      ? row.updated_at.getTime()
      : new Date(row.updated_at).getTime();
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    country: row.country,
    tz: row.tz,
    flag: row.flag,
    updatedAt: updated,
  };
}

function toPublicRoom(row: RoomRow): PublicRoom {
  return {
    code: row.code,
    name: row.name,
    lockedUtcHour: row.locked_utc_hour,
  };
}

function sanitizeText(value: unknown, max: number): string {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function sanitizeLocation(body: {
  name?: unknown;
  city?: unknown;
  country?: unknown;
  tz?: unknown;
  flag?: unknown;
}) {
  const name = sanitizeText(body.name, 28);
  const city = sanitizeText(body.city, 64);
  const country = sanitizeText(body.country, 64);
  const tz = sanitizeText(body.tz, 64);
  const flag = sanitizeText(body.flag, 8) || "🌍";
  if (!city || !country || !tz) {
    throw new Error("Location is required");
  }
  // Basic IANA timezone shape check
  if (!/^[A-Za-z0-9_+/-]+$/.test(tz)) {
    throw new Error("Invalid timezone");
  }
  return { name, city, country, tz, flag };
}

export async function createRoom(input: {
  planetName?: unknown;
  name: unknown;
  city: unknown;
  country: unknown;
  tz: unknown;
  flag?: unknown;
}): Promise<{ room: PublicRoom; member: PublicMember; memberToken: string }> {
  const loc = sanitizeLocation(input);
  if (!loc.name) throw new Error("Name is required");

  let code = generateRoomCode();
  for (let attempt = 0; attempt < 8; attempt++) {
    const existing = await sql<RoomRow>("select code from rooms where code = $1", [code]);
    if (existing.length === 0) break;
    code = generateRoomCode();
  }

  const planetName =
    sanitizeText(input.planetName, 40) || `${loc.name}'s Blue Planet`;

  await sql(
    "insert into rooms (code, name, locked_utc_hour) values ($1, $2, null)",
    [code, planetName],
  );

  const memberId = randomUUID();
  const token = generateToken();
  const rows = await sql<MemberRow>(
    `insert into members (id, room_code, token, name, city, country, tz, flag, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, now())
     returning *`,
    [memberId, code, token, loc.name, loc.city, loc.country, loc.tz, loc.flag],
  );

  const roomRows = await sql<RoomRow>("select * from rooms where code = $1", [code]);
  return {
    room: toPublicRoom(roomRows[0]!),
    member: toPublicMember(rows[0]!),
    memberToken: token,
  };
}

export async function joinRoom(
  codeRaw: string,
  input: {
    name: unknown;
    city: unknown;
    country: unknown;
    tz: unknown;
    flag?: unknown;
  },
): Promise<{ room: PublicRoom; member: PublicMember; memberToken: string }> {
  const code = sanitizeText(codeRaw, 8).toUpperCase();
  if (code.length < 4) throw new Error("Invalid room code");

  const rooms = await sql<RoomRow>("select * from rooms where code = $1", [code]);
  if (rooms.length === 0) throw new Error("Room not found");

  const loc = sanitizeLocation(input);
  if (!loc.name) throw new Error("Name is required");

  const memberId = randomUUID();
  const token = generateToken();
  const rows = await sql<MemberRow>(
    `insert into members (id, room_code, token, name, city, country, tz, flag, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, now())
     returning *`,
    [memberId, code, token, loc.name, loc.city, loc.country, loc.tz, loc.flag],
  );

  return {
    room: toPublicRoom(rooms[0]!),
    member: toPublicMember(rows[0]!),
    memberToken: token,
  };
}

export async function getRoomSnapshot(codeRaw: string): Promise<{
  room: PublicRoom;
  members: PublicMember[];
} | null> {
  const code = sanitizeText(codeRaw, 8).toUpperCase();
  const rooms = await sql<RoomRow>("select * from rooms where code = $1", [code]);
  if (rooms.length === 0) return null;

  const members = await sql<MemberRow>(
    "select * from members where room_code = $1 order by updated_at asc",
    [code],
  );

  return {
    room: toPublicRoom(rooms[0]!),
    members: members.map(toPublicMember),
  };
}

export async function requireMember(
  codeRaw: string,
  tokenRaw: string | null,
): Promise<MemberRow> {
  const code = sanitizeText(codeRaw, 8).toUpperCase();
  const token = sanitizeText(tokenRaw, 128);
  if (!token) throw new Error("Unauthorized");

  const rows = await sql<MemberRow>(
    "select * from members where room_code = $1 and token = $2",
    [code, token],
  );
  if (rows.length === 0) throw new Error("Unauthorized");
  return rows[0]!;
}

export async function updateLockedHour(
  codeRaw: string,
  token: string | null,
  lockedUtcHour: number | null,
): Promise<PublicRoom> {
  await requireMember(codeRaw, token);
  const code = sanitizeText(codeRaw, 8).toUpperCase();

  if (
    lockedUtcHour !== null &&
    (!Number.isInteger(lockedUtcHour) || lockedUtcHour < 0 || lockedUtcHour > 23)
  ) {
    throw new Error("Invalid hour");
  }

  const rows = await sql<RoomRow>(
    "update rooms set locked_utc_hour = $2 where code = $1 returning *",
    [code, lockedUtcHour],
  );
  if (rows.length === 0) throw new Error("Room not found");
  return toPublicRoom(rows[0]!);
}

export async function updateMyLocation(
  codeRaw: string,
  token: string | null,
  input: {
    city: unknown;
    country: unknown;
    tz: unknown;
    flag?: unknown;
    name?: unknown;
  },
): Promise<PublicMember> {
  const me = await requireMember(codeRaw, token);
  const loc = sanitizeLocation({ ...input, name: input.name ?? me.name });
  const name = loc.name || me.name;

  const rows = await sql<MemberRow>(
    `update members
     set city = $2, country = $3, tz = $4, flag = $5, name = $6, updated_at = now()
     where id = $1
     returning *`,
    [me.id, loc.city, loc.country, loc.tz, loc.flag, name],
  );
  return toPublicMember(rows[0]!);
}

export async function addFriend(
  codeRaw: string,
  token: string | null,
  input: {
    name: unknown;
    city: unknown;
    country: unknown;
    tz: unknown;
    flag?: unknown;
  },
): Promise<PublicMember> {
  await requireMember(codeRaw, token);
  const code = sanitizeText(codeRaw, 8).toUpperCase();
  const loc = sanitizeLocation(input);
  if (!loc.name) throw new Error("Name is required");

  const countRows = await sql<{ count: string }>(
    "select count(*)::text as count from members where room_code = $1",
    [code],
  );
  const count = Number(countRows[0]?.count ?? 0);
  if (count >= 24) throw new Error("Room is full (24 people max)");

  const memberId = randomUUID();
  const friendToken = generateToken();
  const rows = await sql<MemberRow>(
    `insert into members (id, room_code, token, name, city, country, tz, flag, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, now())
     returning *`,
    [memberId, code, friendToken, loc.name, loc.city, loc.country, loc.tz, loc.flag],
  );
  return toPublicMember(rows[0]!);
}

export async function removeMember(
  codeRaw: string,
  token: string | null,
  memberId: string,
): Promise<void> {
  const me = await requireMember(codeRaw, token);
  const id = sanitizeText(memberId, 64);
  if (!id) throw new Error("Invalid member");
  if (id === me.id) throw new Error("You cannot remove yourself");

  await sql("delete from members where room_code = $1 and id = $2", [
    me.room_code,
    id,
  ]);
}
