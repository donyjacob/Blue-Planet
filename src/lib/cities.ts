export type City = {
  city: string;
  country: string;
  tz: string;
  flag: string;
};

export const GLOBAL_CITIES: City[] = [
  { city: "Melbourne", country: "Australia", tz: "Australia/Melbourne", flag: "🇦🇺" },
  { city: "Sydney", country: "Australia", tz: "Australia/Sydney", flag: "🇦🇺" },
  { city: "Brisbane", country: "Australia", tz: "Australia/Brisbane", flag: "🇦🇺" },
  { city: "Perth", country: "Australia", tz: "Australia/Perth", flag: "🇦🇺" },
  { city: "Auckland", country: "New Zealand", tz: "Pacific/Auckland", flag: "🇳🇿" },
  { city: "Tokyo", country: "Japan", tz: "Asia/Tokyo", flag: "🇯🇵" },
  { city: "Seoul", country: "South Korea", tz: "Asia/Seoul", flag: "🇰🇷" },
  { city: "Singapore", country: "Singapore", tz: "Asia/Singapore", flag: "🇸🇬" },
  { city: "Hong Kong", country: "China", tz: "Asia/Hong_Kong", flag: "🇭🇰" },
  { city: "Shanghai", country: "China", tz: "Asia/Shanghai", flag: "🇨🇳" },
  { city: "Taipei", country: "Taiwan", tz: "Asia/Taipei", flag: "🇹🇼" },
  { city: "Manila", country: "Philippines", tz: "Asia/Manila", flag: "🇵🇭" },
  { city: "Bangkok", country: "Thailand", tz: "Asia/Bangkok", flag: "🇹🇭" },
  { city: "Jakarta", country: "Indonesia", tz: "Asia/Jakarta", flag: "🇮🇩" },
  { city: "Kuala Lumpur", country: "Malaysia", tz: "Asia/Kuala_Lumpur", flag: "🇲🇾" },
  { city: "Mumbai", country: "India", tz: "Asia/Kolkata", flag: "🇮🇳" },
  { city: "Bengaluru", country: "India", tz: "Asia/Kolkata", flag: "🇮🇳" },
  { city: "New Delhi", country: "India", tz: "Asia/Kolkata", flag: "🇮🇳" },
  { city: "Dubai", country: "United Arab Emirates", tz: "Asia/Dubai", flag: "🇦🇪" },
  { city: "Riyadh", country: "Saudi Arabia", tz: "Asia/Riyadh", flag: "🇸🇦" },
  { city: "Istanbul", country: "Turkey", tz: "Europe/Istanbul", flag: "🇹🇷" },
  { city: "Cairo", country: "Egypt", tz: "Africa/Cairo", flag: "🇪🇬" },
  { city: "Johannesburg", country: "South Africa", tz: "Africa/Johannesburg", flag: "🇿🇦" },
  { city: "Lagos", country: "Nigeria", tz: "Africa/Lagos", flag: "🇳🇬" },
  { city: "Nairobi", country: "Kenya", tz: "Africa/Nairobi", flag: "🇰🇪" },
  { city: "London", country: "United Kingdom", tz: "Europe/London", flag: "🇬🇧" },
  { city: "Dublin", country: "Ireland", tz: "Europe/Dublin", flag: "🇮🇪" },
  { city: "Paris", country: "France", tz: "Europe/Paris", flag: "🇫🇷" },
  { city: "Berlin", country: "Germany", tz: "Europe/Berlin", flag: "🇩🇪" },
  { city: "Amsterdam", country: "Netherlands", tz: "Europe/Amsterdam", flag: "🇳🇱" },
  { city: "Madrid", country: "Spain", tz: "Europe/Madrid", flag: "🇪🇸" },
  { city: "Rome", country: "Italy", tz: "Europe/Rome", flag: "🇮🇹" },
  { city: "Zurich", country: "Switzerland", tz: "Europe/Zurich", flag: "🇨🇭" },
  { city: "Stockholm", country: "Sweden", tz: "Europe/Stockholm", flag: "🇸🇪" },
  { city: "Warsaw", country: "Poland", tz: "Europe/Warsaw", flag: "🇵🇱" },
  { city: "Athens", country: "Greece", tz: "Europe/Athens", flag: "🇬🇷" },
  { city: "Lisbon", country: "Portugal", tz: "Europe/Lisbon", flag: "🇵🇹" },
  { city: "Reykjavik", country: "Iceland", tz: "Atlantic/Reykjavik", flag: "🇮🇸" },
  { city: "São Paulo", country: "Brazil", tz: "America/Sao_Paulo", flag: "🇧🇷" },
  { city: "Buenos Aires", country: "Argentina", tz: "America/Argentina/Buenos_Aires", flag: "🇦🇷" },
  { city: "Santiago", country: "Chile", tz: "America/Santiago", flag: "🇨🇱" },
  { city: "Bogotá", country: "Colombia", tz: "America/Bogota", flag: "🇨🇴" },
  { city: "Lima", country: "Peru", tz: "America/Lima", flag: "🇵🇪" },
  { city: "Mexico City", country: "Mexico", tz: "America/Mexico_City", flag: "🇲🇽" },
  { city: "New York", country: "United States", tz: "America/New_York", flag: "🇺🇸" },
  { city: "Boston", country: "United States", tz: "America/New_York", flag: "🇺🇸" },
  { city: "Miami", country: "United States", tz: "America/New_York", flag: "🇺🇸" },
  { city: "Toronto", country: "Canada", tz: "America/Toronto", flag: "🇨🇦" },
  { city: "Chicago", country: "United States", tz: "America/Chicago", flag: "🇺🇸" },
  { city: "Austin", country: "United States", tz: "America/Chicago", flag: "🇺🇸" },
  { city: "Denver", country: "United States", tz: "America/Denver", flag: "🇺🇸" },
  { city: "Los Angeles", country: "United States", tz: "America/Los_Angeles", flag: "🇺🇸" },
  { city: "San Francisco", country: "United States", tz: "America/Los_Angeles", flag: "🇺🇸" },
  { city: "Seattle", country: "United States", tz: "America/Los_Angeles", flag: "🇺🇸" },
  { city: "Vancouver", country: "Canada", tz: "America/Vancouver", flag: "🇨🇦" },
  { city: "Anchorage", country: "United States", tz: "America/Anchorage", flag: "🇺🇸" },
  { city: "Honolulu", country: "United States", tz: "Pacific/Honolulu", flag: "🇺🇸" },
];

export function cityFromTimezone(tz: string): City {
  const exact = GLOBAL_CITIES.find((c) => c.tz.toLowerCase() === tz.toLowerCase());
  if (exact) return { ...exact };
  const parts = tz.split("/");
  const rawCity = (parts[parts.length - 1] || tz).replace(/_/g, " ");
  return {
    city: rawCity,
    country: parts[0] || "Earth",
    tz,
    flag: "🌍",
  };
}
