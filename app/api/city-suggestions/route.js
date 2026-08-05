import { NextResponse } from "next/server";
import { resolveMarketFromRequest } from "@/lib/market";
import huPostalCodes from "hu-postal-codes/postal-codes.json";

function normalizeQuery(raw) {
  return String(raw || "").trim();
}

function getCountryCode(market) {
  return String(market || "").toLowerCase() === "de" ? "de" : "hu";
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getHuLocalSuggestions(query) {
  const q = normalizeText(query);
  if (q.length < 2) return [];

  const rows = Array.isArray(huPostalCodes) ? huPostalCodes : [];
  const scored = [];

  for (const row of rows) {
    const city = String(row?.city || "").trim();
    const zipRaw = row?.zip;
    if (!city || zipRaw == null) continue;

    const postalCode = String(zipRaw).replace(/[^0-9]/g, "").slice(0, 4);
    if (postalCode.length !== 4) continue;

    const cityNorm = normalizeText(city);
    const regionNorm = normalizeText(row?.region || "");

    const matchesCity = cityNorm.includes(q);
    const matchesRegion = regionNorm.includes(q);
    const matchesZip = postalCode.startsWith(q);
    if (!matchesCity && !matchesRegion && !matchesZip) continue;

    const startsWith = matchesCity && cityNorm.startsWith(q);
    const score = startsWith ? 0 : matchesCity ? 1 : matchesZip ? 2 : 3;

    scored.push({
      city,
      postalCode,
      region: row?.region || null,
      score,
      cityLen: city.length,
    });
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    if (a.cityLen !== b.cityLen) return a.cityLen - b.cityLen;
    return a.city.localeCompare(b.city, "hu");
  });

  const unique = new Map();
  for (const item of scored) {
    const key = `${item.city.toLowerCase()}::${item.postalCode}`;
    if (unique.has(key)) continue;
    unique.set(key, {
      city: item.city,
      postalCode: item.postalCode,
      region: item.region,
      displayName: item.region
        ? `${item.postalCode} ${item.city} (${item.region})`
        : `${item.postalCode} ${item.city}`,
    });
    if (unique.size >= 12) break;
  }

  return Array.from(unique.values());
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

    if (countryCode === "hu") {
      const localSuggestions = getHuLocalSuggestions(q);
      if (localSuggestions.length > 0) {
        return NextResponse.json({ suggestions: localSuggestions });
      }
    }

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
