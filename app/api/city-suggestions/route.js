import { NextResponse } from "next/server";
import { resolveMarketFromRequest } from "@/lib/market";

function normalizeQuery(raw) {
  return String(raw || "").trim();
}

function getCountryCode(market) {
  return String(market || "").toLowerCase() === "de" ? "de" : "hu";
}

function pickCityName(row) {
  const address = row?.address || {};
  return (
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.county ||
    ""
  );
}

function pickPostalCode(row) {
  const address = row?.address || {};
  return String(address.postcode || "").replace(/[^0-9]/g, "").slice(0, 5);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = normalizeQuery(searchParams.get("q"));
    const market = searchParams.get("market") || resolveMarketFromRequest(request);

    if (q.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const countryCode = getCountryCode(market);

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", q);
    url.searchParams.set("countrycodes", countryCode);
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "10");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "User-Agent": "Pharmagister/1.0 (support@pharmagister.hu)",
        "Accept-Language": countryCode === "de" ? "de" : "hu",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json({ error: "Település keresés sikertelen." }, { status: 502 });
    }

    const rows = await response.json();
    const unique = new Map();

    for (const row of Array.isArray(rows) ? rows : []) {
      const city = pickCityName(row);
      const postalCode = pickPostalCode(row);
      if (!city || !postalCode) continue;

      const key = `${city.toLowerCase()}::${postalCode}`;
      if (!unique.has(key)) {
        unique.set(key, {
          city,
          postalCode,
          displayName: row.display_name || `${postalCode} ${city}`,
        });
      }

      if (unique.size >= 8) break;
    }

    return NextResponse.json({ suggestions: Array.from(unique.values()) });
  } catch (error) {
    const isAbort = error?.name === "AbortError";
    return NextResponse.json(
      { error: isAbort ? "Település keresés időtúllépés." : "Település keresési hiba." },
      { status: isAbort ? 504 : 500 }
    );
  }
}
