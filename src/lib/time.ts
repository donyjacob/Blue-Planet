export type HourTier = "ideal" | "stretch" | "sleep";

export function formatTimeInZone(date: Date, tz: string, includeSeconds = false): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      ...(includeSeconds ? { second: "2-digit" } : {}),
      hour12: true,
    }).format(date);
  } catch {
    return "--:--";
  }
}

export function getHourInZone(date: Date, tz: string): number {
  try {
    const hourStr = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    }).format(date);
    const h = parseInt(hourStr, 10);
    return h === 24 ? 0 : h;
  } catch {
    return date.getUTCHours();
  }
}

export function getDayLabelInZone(date: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return "";
  }
}

export function getTzShortName(date: Date, tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(date);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return "UTC";
  }
}

export function getHourStatus(hour: number): {
  label: string;
  tier: HourTier;
} {
  if (hour >= 9 && hour <= 17) {
    return { label: "Daytime / Work", tier: "ideal" };
  }
  if (hour >= 18 && hour <= 21) {
    return { label: "Evening Social", tier: "ideal" };
  }
  if ((hour >= 7 && hour <= 8) || (hour >= 22 && hour <= 23)) {
    return {
      label: hour < 12 ? "Early Morning" : "Late Evening",
      tier: "stretch",
    };
  }
  return { label: "Sleeping Hours", tier: "sleep" };
}
