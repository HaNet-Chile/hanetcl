const { cityById } = require("./cities");

// The weather of the day for the summary (schedule.js), from MET Norway's
// Locationforecast (api.met.no): free, no key, also for commercial use, with
// credit (CC BY 4.0, "Datos del clima: MET Norway", shown in Configuraciones).
// Their terms ask for a User-Agent that names the app, at most 4 decimals in
// the coordinates, and to reuse an answer until its Expires header.
// Only the city's coordinates leave HaNet: nothing about the person.

const ENDPOINT = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
const USER_AGENT = "HaNet/1.0 (+https://hanet.muxp.art)";
const TIME_ZONE = "America/Santiago";
// The part of the day the summary speaks of: until the evening.
const DAY_ENDS_AT = 20;
const TIMEOUT_MS = 4000;
const HOUR = 60 * 60 * 1000;

// What each MET symbol is called, and how much it matters: the summary names
// the most notable weather of the day (rain beats clouds, clouds beat sun).
const SYMBOLS = {
  clearsky: { label: "despejado", rank: 0 },
  fair: { label: "mayormente despejado", rank: 1 },
  partlycloudy: { label: "parcialmente nublado", rank: 2 },
  cloudy: { label: "nublado", rank: 3 },
  fog: { label: "con neblina", rank: 4 },
  lightrainshowers: { label: "con chubascos débiles", rank: 5, wet: true },
  rainshowers: { label: "con chubascos", rank: 6, wet: true },
  heavyrainshowers: { label: "con chubascos fuertes", rank: 8, wet: true },
  lightrain: { label: "con llovizna", rank: 5, wet: true },
  rain: { label: "con lluvia", rank: 7, wet: true },
  heavyrain: { label: "con lluvia fuerte", rank: 9, wet: true },
  lightsleetshowers: { label: "con aguanieve", rank: 10, wet: true },
  sleetshowers: { label: "con aguanieve", rank: 10, wet: true },
  heavysleetshowers: { label: "con aguanieve", rank: 10, wet: true },
  lightsleet: { label: "con aguanieve", rank: 10, wet: true },
  sleet: { label: "con aguanieve", rank: 10, wet: true },
  heavysleet: { label: "con aguanieve", rank: 10, wet: true },
  lightsnowshowers: { label: "con nieve", rank: 11, wet: true },
  snowshowers: { label: "con nieve", rank: 11, wet: true },
  heavysnowshowers: { label: "con nieve", rank: 11, wet: true },
  lightsnow: { label: "con nieve", rank: 11, wet: true },
  snow: { label: "con nieve", rank: 11, wet: true },
  heavysnow: { label: "con nieve", rank: 11, wet: true },
};

// One answer per city, kept until MET says it expires (per instance).
const cache = new Map();

function chileHour(ms) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hour12: false }).format(new Date(ms))) % 24;
}

function chileDate(ms) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}

function symbolOf(code) {
  // "lightrain_day", "clearsky_night", "rainandthunder"…
  const base = String(code || "").replace(/_(day|night|polartwilight)$/, "");
  if (base.includes("thunder")) return { label: "con tormenta eléctrica", rank: 12, wet: true };
  return SYMBOLS[base] || null;
}

/**
 * The day's weather from a Locationforecast answer: the lowest and highest
 * temperature and the most notable sky, from `now` until the evening.
 * Null when the answer has nothing for that part of the day.
 */
function dayWeather(forecast, now) {
  const today = chileDate(now);
  const hours = (forecast?.properties?.timeseries || []).filter(entry => {
    const at = Date.parse(entry.time);
    // From the hour that is under way, for today only, until the evening.
    return at >= now - HOUR && chileDate(at) === today && chileHour(at) < DAY_ENDS_AT;
  });
  const temperatures = hours.map(entry => entry.data?.instant?.details?.air_temperature).filter(Number.isFinite);
  if (!temperatures.length) return null;
  const symbols = hours.map(entry => symbolOf(entry.data?.next_1_hours?.summary?.symbol_code)).filter(Boolean);
  // One wet hour is not a rainy day: the rain counts from two hours.
  const wet = symbols.filter(symbol => symbol.wet);
  const pool = wet.length >= 2 ? wet : symbols.filter(symbol => !symbol.wet);
  const sky = pool.reduce((best, symbol) => (!best || symbol.rank > best.rank ? symbol : best), null);
  return {
    min: Math.round(Math.min(...temperatures)),
    max: Math.round(Math.max(...temperatures)),
    sky: sky?.label || null,
  };
}

/** "Temuco: con lluvia, 8° a 13°", or null. */
function weatherLine(cityName, weather) {
  if (!weather) return null;
  const range = weather.min === weather.max ? `${weather.max}°` : `${weather.min}° a ${weather.max}°`;
  return weather.sky ? `${cityName}: ${weather.sky}, ${range}` : `${cityName}: ${range}`;
}

async function fetchForecast(city) {
  const cached = cache.get(city.id);
  if (cached && cached.expires > Date.now()) return cached.forecast;
  const url = `${ENDPOINT}?lat=${city.lat.toFixed(4)}&lon=${city.lon.toFixed(4)}`;
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`MET ${response.status}`);
  const forecast = await response.json();
  const expires = Date.parse(response.headers.get("expires") || "") || Date.now() + 30 * 60 * 1000;
  cache.set(city.id, { forecast, expires });
  return forecast;
}

/**
 * The weather line of an institution's city for the summary, or null when it
 * has no city or the forecast does not answer: the summary goes out anyway.
 */
async function weatherFor(cityId, now = Date.now()) {
  const city = cityById(cityId);
  if (!city) return null;
  try {
    return weatherLine(city.name, dayWeather(await fetchForecast(city), now));
  } catch (error) {
    console.warn("weatherFor", city.id, error.message);
    return null;
  }
}

module.exports = { weatherFor, dayWeather, weatherLine, symbolOf };
