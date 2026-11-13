"use client";

import { useEffect, useMemo, useState } from "react";
import { CitySearch } from "@/components/CitySearch";
import { GLOBAL_CITIES, cityFromTimezone, type City } from "@/lib/cities";
import {
  formatTimeInZone,
  getDayLabelInZone,
  getHourInZone,
  getHourStatus,
  getTzShortName,
} from "@/lib/time";

type Member = {
  id: string;
  name: string;
  city: string;
  country: string;
  tz: string;
  flag: string;
  updatedAt: number;
};

type Room = {
  code: string;
  name: string;
  lockedUtcHour: number | null;
  meetUrl: string | null;
};

type Toast = { id: number; message: string; type: "info" | "success" | "error" };

type HourSlot = {
  utcHour: number;
  percentage: number;
  idealCount: number;
  stretchCount: number;
  sleepCount: number;
  memberBreakdown: Array<{
    id: string;
    name: string;
    city: string;
    flag: string;
    tz: string;
    localHour: number;
    formattedTime: string;
    dayLabel: string;
    status: ReturnType<typeof getHourStatus>;
  }>;
};

const SESSION_KEY = "blue-planet-session";

function loadSession(): { roomCode: string; memberToken: string; memberId: string } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { roomCode: string; memberToken: string; memberId: string };
  } catch {
    return null;
  }
}

function saveSession(session: { roomCode: string; memberToken: string; memberId: string }) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function copyText(text: string) {
  void navigator.clipboard?.writeText(text);
}

/** Stable free Jitsi room shared by everyone with the same Blue Planet code. */
function jitsiMeetingUrl(roomCode: string, displayName?: string): string {
  const meetingId = `BluePlanet${roomCode.replace(/[^A-Za-z0-9]/g, "")}`;
  const base = `https://meet.jit.si/${meetingId}`;
  if (!displayName?.trim()) return base;
  return `${base}#userInfo.displayName="${encodeURIComponent(displayName.trim())}"`;
}

export function BluePlanetApp() {
  const [entryMode, setEntryMode] = useState<"join" | "create">("join");
  const [userName, setUserName] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [planetName, setPlanetName] = useState("");
  const [entryLocation, setEntryLocation] = useState<City | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberToken, setMemberToken] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [selectedUtcHour, setSelectedUtcHour] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [locationOpen, setLocationOpen] = useState(false);
  const [friendOpen, setFriendOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [meetDraft, setMeetDraft] = useState("");
  const [meetBusy, setMeetBusy] = useState(false);
  const [showJitsi, setShowJitsi] = useState(false);
  const [modalLocation, setModalLocation] = useState<City | null>(null);
  const [friendName, setFriendName] = useState("");
  const [friendLocation, setFriendLocation] = useState<City>(
    GLOBAL_CITIES.find((c) => c.city === "London") ?? GLOBAL_CITIES[0]!,
  );

  const showToast = (message: string, type: Toast["type"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3400);
  };

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    setEntryLocation(cityFromTimezone(tz));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const session = loadSession();
    if (!session) return;
    void (async () => {
      try {
        const res = await fetch(`/api/rooms/${session.roomCode}`);
        if (!res.ok) {
          clearSession();
          return;
        }
        const data = (await res.json()) as { room: Room; members: Member[] };
        setRoom(data.room);
        setMembers(data.members);
        setMemberToken(session.memberToken);
        setMyId(session.memberId);
        setIsDemo(false);
      } catch {
        clearSession();
      }
    })();
  }, []);

  useEffect(() => {
    if (!room || isDemo) return;
    const poll = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/${room.code}`);
        if (!res.ok) return;
        const data = (await res.json()) as { room: Room; members: Member[] };
        setRoom(data.room);
        setMembers(data.members);
      } catch {
        // ignore transient poll failures
      }
    }, 3000);
    return () => window.clearInterval(poll);
  }, [room, isDemo]);

  const detectGps = async (target: "entry" | "modal") => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const base = cityFromTimezone(tz);
    if (target === "entry") setEntryLocation(base);
    else setModalLocation(base);

    if (!navigator.geolocation) {
      showToast(`Using timezone ${base.city}`, "info");
      return;
    }

    showToast("Requesting browser location…", "info");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
          );
          const data = (await res.json()) as {
            city?: string;
            locality?: string;
            principalSubdivision?: string;
            countryName?: string;
          };
          const updated: City = {
            city: data.city || data.locality || data.principalSubdivision || base.city,
            country: data.countryName || base.country,
            tz,
            flag: base.flag,
          };
          if (target === "entry") setEntryLocation(updated);
          else setModalLocation(updated);
          showToast(`Location set: ${updated.city}, ${updated.country}`, "success");
        } catch {
          showToast(`Timezone detected (${tz})`, "info");
        }
      },
      () => showToast(`GPS declined — using ${base.city}`, "info"),
      { timeout: 6000 },
    );
  };

  const hourSlots: HourSlot[] = useMemo(() => {
    const baseMidnightUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0),
    );
    const results: HourSlot[] = [];
    for (let utcHour = 0; utcHour < 24; utcHour++) {
      const slotDate = new Date(baseMidnightUtc.getTime() + utcHour * 3600 * 1000);
      let score = 0;
      let idealCount = 0;
      let stretchCount = 0;
      let sleepCount = 0;
      const memberBreakdown = members.map((m) => {
        const localHour = getHourInZone(slotDate, m.tz);
        const status = getHourStatus(localHour);
        if (status.tier === "ideal") {
          score += 100;
          idealCount++;
        } else if (status.tier === "stretch") {
          score += 55;
          stretchCount++;
        } else {
          sleepCount++;
        }
        return {
          id: m.id,
          name: m.name,
          city: m.city,
          flag: m.flag,
          tz: m.tz,
          localHour,
          formattedTime: formatTimeInZone(slotDate, m.tz),
          dayLabel: getDayLabelInZone(slotDate, m.tz),
          status,
        };
      });
      const maxPossible = Math.max(1, members.length * 100);
      results.push({
        utcHour,
        percentage: Math.round((score / maxPossible) * 100),
        idealCount,
        stretchCount,
        sleepCount,
        memberBreakdown,
      });
    }
    return results;
  }, [members, now]);

  const rankedSlots = useMemo(
    () => [...hourSlots].sort((a, b) => b.percentage - a.percentage || a.utcHour - b.utcHour),
    [hourSlots],
  );

  useEffect(() => {
    if (selectedUtcHour === null && rankedSlots[0]) {
      setSelectedUtcHour(rankedSlots[0].utcHour);
    }
  }, [rankedSlots, selectedUtcHour]);

  const activeSlot = hourSlots.find((h) => h.utcHour === selectedUtcHour) ?? hourSlots[0];

  const enterRoomState = (payload: {
    room: Room;
    members: Member[];
    memberToken: string;
    memberId: string;
    demo?: boolean;
  }) => {
    setRoom(payload.room);
    setMembers(payload.members);
    setMemberToken(payload.memberToken);
    setMyId(payload.memberId);
    setIsDemo(Boolean(payload.demo));
    setSelectedUtcHour(null);
    if (!payload.demo) {
      saveSession({
        roomCode: payload.room.code,
        memberToken: payload.memberToken,
        memberId: payload.memberId,
      });
    } else {
      clearSession();
    }
  };

  const handleEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) {
      showToast("Please enter your name.", "error");
      return;
    }
    const loc = entryLocation ?? cityFromTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setBusy(true);
    try {
      if (entryMode === "create") {
        const res = await fetch("/api/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: userName.trim(),
            planetName: planetName.trim() || undefined,
            city: loc.city,
            country: loc.country,
            tz: loc.tz,
            flag: loc.flag,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not create room");
        enterRoomState({
          room: data.room,
          members: [data.member],
          memberToken: data.memberToken,
          memberId: data.member.id,
        });
        showToast(`Created room ${data.room.code}. Share it with friends!`, "success");
      } else {
        const code = roomCodeInput.trim().toUpperCase();
        if (code.length < 4) {
          showToast("Enter a valid shared room code.", "error");
          return;
        }
        const res = await fetch(`/api/rooms/${code}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: userName.trim(),
            city: loc.city,
            country: loc.country,
            tz: loc.tz,
            flag: loc.flag,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not join room");
        const snapshot = await fetch(`/api/rooms/${code}`).then((r) => r.json());
        enterRoomState({
          room: snapshot.room,
          members: snapshot.members,
          memberToken: data.memberToken,
          memberId: data.member.id,
        });
        showToast(`Joined room ${code}!`, "success");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Something went wrong", "error");
    } finally {
      setBusy(false);
    }
  };

  const launchDemo = () => {
    const loc = entryLocation ?? GLOBAL_CITIES[0]!;
    const name = userName.trim() || "You";
    const me: Member = {
      id: "demo-me",
      name,
      city: loc.city,
      country: loc.country,
      tz: loc.tz,
      flag: loc.flag,
      updatedAt: 1,
    };
    enterRoomState({
      room: {
        code: "PLANET",
        name: "Global Friends Demo Crew",
        lockedUtcHour: null,
        meetUrl: null,
      },
      members: [
        me,
        {
          id: "demo-2",
          name: "Liam",
          city: "London",
          country: "United Kingdom",
          tz: "Europe/London",
          flag: "🇬🇧",
          updatedAt: 2,
        },
        {
          id: "demo-3",
          name: "Maya",
          city: "New York",
          country: "United States",
          tz: "America/New_York",
          flag: "🇺🇸",
          updatedAt: 3,
        },
        {
          id: "demo-4",
          name: "Kenji",
          city: "Tokyo",
          country: "Japan",
          tz: "Asia/Tokyo",
          flag: "🇯🇵",
          updatedAt: 4,
        },
      ],
      memberToken: "demo",
      memberId: "demo-me",
      demo: true,
    });
    showToast("Demo room launched with 4 friends across the globe!", "success");
  };

  const leaveRoom = () => {
    clearSession();
    setRoom(null);
    setMembers([]);
    setMemberToken(null);
    setMyId(null);
    setIsDemo(false);
    setSelectedUtcHour(null);
    setVideoOpen(false);
    setShowJitsi(false);
    setMeetDraft("");
  };

  const myDisplayName = members.find((m) => m.id === myId)?.name || userName.trim() || "Friend";
  const jitsiUrl = room ? jitsiMeetingUrl(room.code, myDisplayName) : "";
  const jitsiShareUrl = room ? jitsiMeetingUrl(room.code) : "";
  const primaryVideoUrl = room?.meetUrl || jitsiShareUrl;

  const saveMeetUrl = async (raw: string | null) => {
    if (!room) return;
    if (isDemo) {
      setRoom({ ...room, meetUrl: raw });
      setMeetDraft(raw || "");
      showToast(raw ? "Google Meet link saved for this demo room." : "Google Meet link cleared.", "success");
      return;
    }
    setMeetBusy(true);
    try {
      const res = await fetch(`/api/rooms/${room.code}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-member-token": memberToken || "",
        },
        body: JSON.stringify({ meetUrl: raw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save Meet link");
      setRoom(data.room);
      setMeetDraft(data.room.meetUrl || "");
      showToast(raw ? "Google Meet link shared with the room!" : "Google Meet link cleared.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save Meet link", "error");
    } finally {
      setMeetBusy(false);
    }
  };

  useEffect(() => {
    if (room?.meetUrl) setMeetDraft(room.meetUrl);
  }, [room?.meetUrl]);

  const lockSelectedHour = async () => {
    if (selectedUtcHour === null || !room) return;
    if (isDemo) {
      setRoom({ ...room, lockedUtcHour: selectedUtcHour });
      showToast(`Locked ${String(selectedUtcHour).padStart(2, "0")}:00 UTC`, "success");
      return;
    }
    try {
      const res = await fetch(`/api/rooms/${room.code}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-member-token": memberToken || "",
        },
        body: JSON.stringify({ lockedUtcHour: selectedUtcHour }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to lock time");
      setRoom(data.room);
      showToast(`Locked ${String(selectedUtcHour).padStart(2, "0")}:00 UTC`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to lock", "error");
    }
  };

  const clearLockedCall = async () => {
    if (!room) return;
    if (isDemo) {
      setRoom({ ...room, lockedUtcHour: null });
      return;
    }
    try {
      const res = await fetch(`/api/rooms/${room.code}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-member-token": memberToken || "",
        },
        body: JSON.stringify({ lockedUtcHour: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to clear");
      setRoom(data.room);
      showToast("Cleared scheduled call time.", "info");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to clear", "error");
    }
  };

  const saveLocation = async () => {
    if (!modalLocation || !room || !myId) return;
    if (isDemo) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === myId
            ? {
                ...m,
                city: modalLocation.city,
                country: modalLocation.country,
                tz: modalLocation.tz,
                flag: modalLocation.flag,
                updatedAt: Date.now(),
              }
            : m,
        ),
      );
      setLocationOpen(false);
      showToast(`Location updated to ${modalLocation.city}`, "success");
      return;
    }
    try {
      const res = await fetch(`/api/rooms/${room.code}/members`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-member-token": memberToken || "",
        },
        body: JSON.stringify(modalLocation),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      setMembers((prev) => prev.map((m) => (m.id === data.member.id ? data.member : m)));
      setLocationOpen(false);
      showToast(`Location updated to ${modalLocation.city}`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update", "error");
    }
  };

  const confirmAddFriend = async () => {
    if (!friendName.trim() || !room) {
      showToast("Enter your friend's name.", "error");
      return;
    }
    if (isDemo) {
      const friend: Member = {
        id: `friend-${Date.now()}`,
        name: friendName.trim(),
        city: friendLocation.city,
        country: friendLocation.country,
        tz: friendLocation.tz,
        flag: friendLocation.flag,
        updatedAt: Date.now(),
      };
      setMembers((prev) => [...prev, friend]);
      setFriendOpen(false);
      setFriendName("");
      showToast(`Added ${friend.name}`, "success");
      return;
    }
    try {
      const res = await fetch(`/api/rooms/${room.code}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-member-token": memberToken || "",
        },
        body: JSON.stringify({
          name: friendName.trim(),
          city: friendLocation.city,
          country: friendLocation.country,
          tz: friendLocation.tz,
          flag: friendLocation.flag,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add friend");
      setMembers((prev) => [...prev, data.member]);
      setFriendOpen(false);
      setFriendName("");
      showToast(`Added ${data.member.name}`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to add", "error");
    }
  };

  const removeMember = async (id: string) => {
    if (!room) return;
    if (isDemo) {
      setMembers((prev) => prev.filter((m) => m.id !== id));
      return;
    }
    try {
      const res = await fetch(`/api/rooms/${room.code}/members/${id}`, {
        method: "DELETE",
        headers: { "x-member-token": memberToken || "" },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove");
      }
      setMembers((prev) => prev.filter((m) => m.id !== id));
      showToast("Removed member from room.", "info");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to remove", "error");
    }
  };

  const lockedSlot =
    room?.lockedUtcHour !== null && room?.lockedUtcHour !== undefined
      ? hourSlots.find((h) => h.utcHour === room.lockedUtcHour)
      : undefined;

  const downloadICS = () => {
    if (!room || room.lockedUtcHour === null || room.lockedUtcHour === undefined) return;
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), room.lockedUtcHour, 0, 0),
    );
    if (start.getTime() < now.getTime()) start.setUTCDate(start.getUTCDate() + 1);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Blue Planet//Global Scheduler//EN",
      "BEGIN:VEVENT",
      `UID:blue-planet-${room.code}-${Date.now()}@blueplanet.app`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:Blue Planet Catch-Up (${room.name})`,
      `DESCRIPTION:Global call scheduled via Blue Planet (Room Code: ${room.code}). Video: ${room.meetUrl || jitsiMeetingUrl(room.code)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `blue-planet-call-${room.code}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Calendar (.ics) invite downloaded!", "success");
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden />
          <div>
            <div className="brand-name">Blue Planet</div>
            <div className="brand-tag">Sync time zones. Find your golden window.</div>
          </div>
        </div>
        <div className="header-actions">
          {room && (
            <>
              <div className="pill">
                Room <strong>{room.code}</strong>
                <button
                  className="btn-ghost"
                  style={{ padding: "0.1rem 0.3rem" }}
                  onClick={() => {
                    copyText(room.code);
                    showToast("Room code copied!", "success");
                  }}
                >
                  Copy
                </button>
              </div>
              {!isDemo && <span className="pill">Live sync</span>}
              {isDemo && <span className="pill">Demo sandbox</span>}
              <button className="btn btn-danger" onClick={leaveRoom}>
                Switch room
              </button>
            </>
          )}
        </div>
      </header>

      {!room ? (
        <>
          <section className="hero">
            <div className="hero-media" aria-hidden />
            <div className="hero-content">
              <h1 className="hero-brand">Blue Planet</h1>
              <p className="hero-line">
                One shared code for friends around the world — clocks sync automatically, and we find
                the hour when nobody is asleep.
              </p>
              <div className="hero-cta">
                <button className="btn btn-primary" onClick={() => document.getElementById("entry")?.scrollIntoView({ behavior: "smooth" })}>
                  Create or join a room
                </button>
                <button className="btn btn-secondary" onClick={launchDemo}>
                  Try interactive demo
                </button>
              </div>
            </div>
          </section>

          <section id="entry" className="entry-panel">
            <div className="tabs">
              <button
                type="button"
                className={`tab ${entryMode === "join" ? "active" : ""}`}
                onClick={() => setEntryMode("join")}
              >
                Join with code
              </button>
              <button
                type="button"
                className={`tab ${entryMode === "create" ? "active" : ""}`}
                onClick={() => setEntryMode("create")}
              >
                Create new room
              </button>
            </div>

            <form onSubmit={handleEntry}>
              {entryMode === "join" ? (
                <div className="field">
                  <label htmlFor="room-code">Shared planet code</label>
                  <input
                    id="room-code"
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    placeholder="e.g. EARTH7"
                    maxLength={8}
                    style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.12em" }}
                  />
                </div>
              ) : (
                <div className="field">
                  <label htmlFor="planet-name">Group / planet name (optional)</label>
                  <input
                    id="planet-name"
                    value={planetName}
                    onChange={(e) => setPlanetName(e.target.value)}
                    placeholder="e.g. Uni Crew Catch-up"
                    maxLength={40}
                  />
                </div>
              )}

              <div className="field">
                <label htmlFor="user-name">Your name</label>
                <input
                  id="user-name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your display name"
                  maxLength={28}
                  required
                />
              </div>

              <div className="location-box">
                <div className="location-top">
                  <strong style={{ fontSize: "0.85rem", color: "var(--sea-deep)" }}>
                    Detected location & timezone
                  </strong>
                  <button type="button" className="btn btn-ghost" onClick={() => void detectGps("entry")}>
                    Use GPS
                  </button>
                </div>
                <div className="location-preview">
                  <div>
                    <div>
                      {entryLocation
                        ? `${entryLocation.flag} ${entryLocation.city}, ${entryLocation.country}`
                        : "Detecting…"}
                    </div>
                    <div className="muted" style={{ fontFamily: "var(--font-mono)" }}>
                      {entryLocation
                        ? `${entryLocation.tz} (${getTzShortName(now, entryLocation.tz)})`
                        : "UTC"}
                    </div>
                  </div>
                  <div className="time">
                    {entryLocation ? formatTimeInZone(now, entryLocation.tz) : "--:--"}
                  </div>
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Traveling or wrong city? Search & pick:</label>
                  <CitySearch
                    placeholder="Tokyo, London, New York, Sydney…"
                    onSelect={setEntryLocation}
                  />
                </div>
              </div>

              <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: "100%" }}>
                {busy
                  ? "Connecting…"
                  : entryMode === "join"
                    ? "Join Blue Planet room"
                    : "Create & launch room"}
              </button>
            </form>
          </section>
        </>
      ) : (
        <>
          <section className="banner section">
            <div>
              <h2 style={{ fontFamily: "var(--font-display)", margin: "0 0 0.25rem", letterSpacing: "-0.03em" }}>
                {room.name}
              </h2>
              <p className="muted" style={{ margin: 0 }}>
                Share code <strong style={{ fontFamily: "var(--font-mono)", color: "var(--sea-deep)" }}>{room.code}</strong> so friends’ clocks appear automatically.
              </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {room.meetUrl ? (
                <a className="btn btn-primary" href={room.meetUrl} target="_blank" rel="noreferrer">
                  Join Google Meet
                </a>
              ) : (
                <button className="btn btn-primary" onClick={() => setVideoOpen(true)}>
                  {videoOpen ? "Video panel open" : "Set up Google Meet"}
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setVideoOpen(true)}>
                Video settings
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  const me = members.find((m) => m.id === myId);
                  setModalLocation(
                    me
                      ? { city: me.city, country: me.country, tz: me.tz, flag: me.flag }
                      : entryLocation,
                  );
                  setLocationOpen(true);
                }}
              >
                Update my location
              </button>
              <button className="btn btn-secondary" onClick={() => setFriendOpen(true)}>
                Add friend manually
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  copyText(
                    [
                      `Join our Blue Planet room "${room.name}"!`,
                      `Shared Room Code: ${room.code}`,
                      `Video: ${primaryVideoUrl}`,
                      `Enter the code so we can sync time zones — or jump straight into the video link.`,
                    ].join("\n"),
                  );
                  showToast("Invite message copied!", "success");
                }}
              >
                Invite friends
              </button>
            </div>
          </section>

          {videoOpen && (
            <section className="video-panel section">
              <div className="video-panel-head">
                <div>
                  <h3 style={{ margin: 0, fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>
                    Google Meet
                  </h3>
                  <p className="muted" style={{ margin: "0.25rem 0 0" }}>
                    Create a Meet, paste the link once, and everyone in room{" "}
                    <strong style={{ fontFamily: "var(--font-mono)" }}>{room.code}</strong> can join the same call.
                  </p>
                </div>
                <button className="btn btn-ghost" onClick={() => setVideoOpen(false)}>
                  Hide
                </button>
              </div>

              <div className="meet-setup">
                <div className="meet-steps">
                  <a
                    className="btn btn-primary"
                    href="https://meet.google.com/new"
                    target="_blank"
                    rel="noreferrer"
                  >
                    1. Create Google Meet
                  </a>
                  <p className="muted" style={{ margin: "0.55rem 0 0.8rem", color: "rgba(245,251,255,0.72)" }}>
                    Opens Google Meet in a new tab. Copy the meeting link from your browser address bar
                    (e.g. meet.google.com/abc-defg-hij), then paste it below.
                  </p>
                  <label className="meet-label" htmlFor="meet-url-input">
                    2. Paste & share with the room
                  </label>
                  <div className="meet-row">
                    <input
                      id="meet-url-input"
                      value={meetDraft}
                      onChange={(e) => setMeetDraft(e.target.value)}
                      placeholder="https://meet.google.com/abc-defg-hij"
                      autoComplete="off"
                    />
                    <button
                      className="btn btn-secondary"
                      disabled={meetBusy || !meetDraft.trim()}
                      onClick={() => void saveMeetUrl(meetDraft.trim())}
                    >
                      {meetBusy ? "Saving…" : "Save for room"}
                    </button>
                  </div>
                </div>

                {room.meetUrl ? (
                  <div className="meet-ready">
                    <div>
                      <strong>Room Meet link</strong>
                      <div className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", wordBreak: "break-all" }}>
                        {room.meetUrl}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      <a className="btn btn-primary" href={room.meetUrl} target="_blank" rel="noreferrer">
                        Join Google Meet
                      </a>
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          copyText(room.meetUrl!);
                          showToast("Google Meet link copied!", "success");
                        }}
                      >
                        Copy link
                      </button>
                      <button
                        className="btn btn-ghost"
                        disabled={meetBusy}
                        onClick={() => void saveMeetUrl(null)}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="muted" style={{ margin: "0.9rem 0 0", color: "rgba(245,251,255,0.72)" }}>
                    No Google Meet link saved yet. After you paste one, friends who join this room will see it automatically.
                  </p>
                )}

                <div className="jitsi-fallback">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowJitsi((v) => !v)}
                  >
                    {showJitsi ? "Hide quick call (Jitsi)" : "Need a call without Google? Use free Jitsi"}
                  </button>
                  {showJitsi && (
                    <div className="jitsi-box">
                      <p className="muted" style={{ margin: "0 0 0.7rem", color: "rgba(245,251,255,0.72)" }}>
                        Instant backup meeting for this room code — no Google account required.
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.7rem" }}>
                        <a className="btn btn-secondary" href={jitsiUrl} target="_blank" rel="noreferrer">
                          Open Jitsi in new tab
                        </a>
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            copyText(jitsiShareUrl);
                            showToast("Jitsi link copied!", "success");
                          }}
                        >
                          Copy Jitsi link
                        </button>
                      </div>
                      <iframe
                        className="video-frame"
                        title={`Blue Planet Jitsi ${room.code}`}
                        src={jitsiUrl}
                        allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
                        allowFullScreen
                      />
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {lockedSlot && (
            <section className="banner locked-banner section">
              <div>
                <div className="muted" style={{ fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: "0.72rem" }}>
                  Scheduled group call
                </div>
                <h3 style={{ margin: "0.2rem 0", fontFamily: "var(--font-display)" }}>
                  Locked at {String(room.lockedUtcHour).padStart(2, "0")}:00 UTC ({lockedSlot.percentage}% match)
                </h3>
                <p className="muted" style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>
                  {lockedSlot.memberBreakdown
                    .map((b) => `${b.flag} ${b.name}: ${b.formattedTime} (${b.dayLabel})`)
                    .join("  |  ")}
                </p>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {room.meetUrl ? (
                  <a className="btn btn-primary" href={room.meetUrl} target="_blank" rel="noreferrer">
                    Join Google Meet
                  </a>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setVideoOpen(true);
                      showToast("Set a Google Meet link for the room, then friends can join.", "info");
                    }}
                  >
                    Set up Google Meet
                  </button>
                )}
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    copyText(
                      [
                        `Blue Planet Group Call: ${room.name}`,
                        `Room Code: ${room.code}`,
                        `Time: ${String(room.lockedUtcHour).padStart(2, "0")}:00 UTC`,
                        `Video: ${primaryVideoUrl}`,
                        "",
                        "Local Times for Everyone:",
                        ...lockedSlot.memberBreakdown.map(
                          (b) => `• ${b.flag} ${b.name} (${b.city}): ${b.formattedTime} — ${b.dayLabel}`,
                        ),
                      ].join("\n"),
                    );
                    showToast("Call schedule copied!", "success");
                  }}
                >
                  Copy calendar summary
                </button>
                <button className="btn btn-secondary" onClick={downloadICS}>
                  .ICS invite
                </button>
                <button className="btn btn-ghost" onClick={() => void clearLockedCall()}>
                  Clear
                </button>
              </div>
            </section>
          )}

          <section className="section">
            <div className="section-head">
              <h3>Connected friends ({members.length})</h3>
              <span className="muted" style={{ fontFamily: "var(--font-mono)" }}>
                UTC {now.toISOString().substring(11, 19)}
              </span>
            </div>
            <div className="members-grid">
              {members.map((m) => {
                const localHour = getHourInZone(now, m.tz);
                const status = getHourStatus(localHour);
                const isMe = m.id === myId;
                return (
                  <article key={m.id} className={`member-card ${isMe ? "me" : ""}`}>
                    <div className="member-top">
                      <div className="member-identity">
                        <div className="flag">{m.flag}</div>
                        <div>
                          <h4>
                            {m.name} {isMe ? <span className="badge ideal">YOU</span> : null}
                          </h4>
                          <div className="muted">
                            {m.city}, {m.country}
                          </div>
                        </div>
                      </div>
                      {!isMe && (
                        <button className="btn btn-ghost" onClick={() => void removeMember(m.id)}>
                          Remove
                        </button>
                      )}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end" }}>
                      <div>
                        <div className="member-time">{formatTimeInZone(now, m.tz)}</div>
                        <div className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>
                          {getDayLabelInZone(now, m.tz)} · {getTzShortName(now, m.tz)}
                        </div>
                      </div>
                      <span className={`badge ${status.tier}`}>{status.label.split(" ")[0]}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="section scheduler">
            <div className="panel">
              <div className="section-head">
                <div>
                  <h3>Golden windows</h3>
                  <p className="muted" style={{ margin: "0.2rem 0 0" }}>
                    Best call slots for everyone
                  </p>
                </div>
              </div>
              <div className="slot-list">
                {rankedSlots.slice(0, 4).map((slot, index) => {
                  const quality =
                    slot.sleepCount === 0
                      ? slot.stretchCount === 0
                        ? "Perfect golden slot"
                        : "Great overlap"
                      : `${slot.sleepCount} sleeping`;
                  return (
                    <button
                      key={slot.utcHour}
                      type="button"
                      className={`slot ${selectedUtcHour === slot.utcHour ? "selected" : ""}`}
                      onClick={() => setSelectedUtcHour(slot.utcHour)}
                    >
                      <div className="slot-meta">
                        <strong style={{ fontFamily: "var(--font-mono)" }}>
                          #{index + 1} · {String(slot.utcHour).padStart(2, "0")}:00 UTC
                        </strong>
                        <span className={`badge ${slot.sleepCount === 0 ? "ideal" : "stretch"}`}>
                          {quality} ({slot.percentage}%)
                        </span>
                      </div>
                      <div className="chip-row">
                        {slot.memberBreakdown.map((b) => (
                          <span key={b.id} className="chip">
                            {b.flag} {b.name} {b.formattedTime}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="panel">
              <div className="section-head">
                <div>
                  <h3>24-hour overlap timeline</h3>
                  <p className="muted" style={{ margin: "0.2rem 0 0" }}>
                    Click any hour to inspect everyone’s local time and lock a call.
                  </p>
                </div>
                <div className="legend">
                  <span>
                    <i className="swatch ideal" /> Ideal (9am–9pm)
                  </span>
                  <span>
                    <i className="swatch stretch" /> Stretch
                  </span>
                  <span>
                    <i className="swatch sleep" /> Sleeping
                  </span>
                </div>
              </div>

              {activeSlot && (
                <div className="inspector">
                  <div>
                    <strong>
                      Inspecting {String(activeSlot.utcHour).padStart(2, "0")}:00 UTC — match{" "}
                      {activeSlot.percentage}%
                    </strong>
                    <div className="muted" style={{ marginTop: "0.25rem" }}>
                      {activeSlot.memberBreakdown
                        .map((b) => `${b.name} (${b.city}): ${b.formattedTime}`)
                        .join("  ·  ")}
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={() => void lockSelectedHour()}>
                    Lock this call time
                  </button>
                </div>
              )}

              <div className="matrix-wrap">
                <div className="matrix">
                  <div className="matrix-row">
                    <div className="matrix-label muted">Member</div>
                    {hourSlots.map((h) => (
                      <button
                        key={`h-${h.utcHour}`}
                        type="button"
                        className={`cell ${h.utcHour === selectedUtcHour ? "selected" : "sleep"}`}
                        onClick={() => setSelectedUtcHour(h.utcHour)}
                      >
                        {String(h.utcHour).padStart(2, "0")}
                      </button>
                    ))}
                  </div>
                  {members.map((m) => (
                    <div key={`row-${m.id}`} className="matrix-row">
                      <div className="matrix-label">
                        {m.flag} {m.name}
                      </div>
                      {hourSlots.map((h) => {
                        const info = h.memberBreakdown.find((b) => b.id === m.id);
                        const tier = info?.status.tier ?? "sleep";
                        return (
                          <button
                            key={`${m.id}-${h.utcHour}`}
                            type="button"
                            title={`${m.name}: ${info?.formattedTime ?? ""}`}
                            className={`cell ${tier} ${h.utcHour === selectedUtcHour ? "selected" : ""}`}
                            onClick={() => setSelectedUtcHour(h.utcHour)}
                          >
                            {info?.localHour ?? 0}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                  <div className="matrix-row">
                    <div className="matrix-label" style={{ color: "var(--sea)" }}>
                      Overlap score
                    </div>
                    {hourSlots.map((h) => (
                      <button
                        key={`score-${h.utcHour}`}
                        type="button"
                        className={`cell ${h.sleepCount === 0 ? "ideal" : "sleep"} ${
                          h.utcHour === selectedUtcHour ? "selected" : ""
                        }`}
                        onClick={() => setSelectedUtcHour(h.utcHour)}
                      >
                        {h.percentage}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      <footer className="footer">Blue Planet · Connecting friends across every meridian</footer>

      {locationOpen && (
        <div className="modal-backdrop" onClick={() => setLocationOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Update your location</h3>
            <p className="muted">Auto-detect with your browser or search for any city worldwide.</p>
            <button
              className="btn btn-secondary"
              style={{ width: "100%", marginBottom: "0.8rem" }}
              onClick={() => void detectGps("modal")}
            >
              Auto-detect current city & timezone
            </button>
            <div className="field">
              <label>Search city</label>
              <CitySearch
                placeholder="Melbourne, Paris, Toronto…"
                onSelect={setModalLocation}
              />
            </div>
            <div className="location-preview">
              <div>
                <div>
                  {modalLocation
                    ? `${modalLocation.flag} ${modalLocation.city}, ${modalLocation.country}`
                    : "--"}
                </div>
                <div className="muted" style={{ fontFamily: "var(--font-mono)" }}>
                  {modalLocation?.tz ?? "--"}
                </div>
              </div>
              <div className="time">
                {modalLocation ? formatTimeInZone(now, modalLocation.tz) : "--:--"}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setLocationOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={() => void saveLocation()}>
                Save location
              </button>
            </div>
          </div>
        </div>
      )}

      {friendOpen && (
        <div className="modal-backdrop" onClick={() => setFriendOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add a friend’s location</h3>
            <p className="muted">
              Know where a friend is right now? Add them so they’re included in the call calculation.
            </p>
            <div className="field">
              <label htmlFor="friend-name">Friend’s name</label>
              <input
                id="friend-name"
                value={friendName}
                onChange={(e) => setFriendName(e.target.value)}
                maxLength={28}
                placeholder="e.g. Maya"
              />
            </div>
            <div className="field">
              <label>Friend’s city or country</label>
              <CitySearch
                placeholder="London, San Francisco, Singapore…"
                onSelect={setFriendLocation}
              />
            </div>
            <div className="location-preview">
              <div>
                <div>
                  {friendLocation.flag} {friendLocation.city}, {friendLocation.country}
                </div>
                <div className="muted" style={{ fontFamily: "var(--font-mono)" }}>
                  {friendLocation.tz}
                </div>
              </div>
              <div className="time">{formatTimeInZone(now, friendLocation.tz)}</div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setFriendOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={() => void confirmAddFriend()}>
                Add to planet
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
