import { NextResponse } from "next/server";
import { resolveMarketFromRequest } from "@/lib/market";

function normalizePostalCode(raw) {
  return String(raw || "").replace(/[^0-9]/g, "").slice(0, 5);
}

function getCountryCode(market) {
  return String(market || "").toLowerCase() === "de" ? "de" : "hu";
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const postalCode = normalizePostalCode(searchParams.get("postalCode"));
    const city = String(searchParams.get("city") || "").trim();
    const market = searchParams.get("market") || resolveMarketFromRequest(request);

    if (!/^\d{4,5}$/.test(postalCode)) {
      return NextResponse.json({ error: "Érvénytelen irányítószám." }, { status: 400 });
    }

    const countryCode = getCountryCode(market);
    const query = city ? `${postalCode} ${city}` : postalCode;

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", query);
    url.searchParams.set("countrycodes", countryCode);
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "1");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

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
      return NextResponse.json({ error: "Geokódolási szolgáltatás hiba." }, { status: 502 });
    }

    const rows = await response.json();
    const first = Array.isArray(rows) ? rows[0] : null;

    if (!first || first.lat == null || first.lon == null) {
      return NextResponse.json({ error: "Nem található koordináta ehhez az irányítószámhoz." }, { status: 404 });
    }

    const lat = Number(first.lat);
    const lng = Number(first.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: "Érvénytelen koordináta a geokódolásból." }, { status: 502 });
    }

    return NextResponse.json({
      postalCode,
      countryCode,
      lat,
      lng,
      displayName: first.display_name || null,
      provider: "nominatim",
    });
  } catch (error) {
    const isAbort = error?.name === "AbortError";
    return NextResponse.json(
      { error: isAbort ? "A geokódolás időtúllépés miatt megszakadt." : "Geokódolási hiba." },
      { status: isAbort ? 504 : 500 }
    );
  }
}
