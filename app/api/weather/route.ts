// app/api/weather/route.ts
// ─── Server-only Route Handler ────────────────────────────────────────────────
// Proxies OpenWeatherMap requests so the API key stays server-side only.

import { NextRequest } from 'next/server';

export interface WeatherData {
  city: string;
  country: string;
  temperature: number;      // Celsius
  feelsLike: number;
  humidity: number;         // %
  windSpeed: number;        // m/s
  description: string;      // e.g. "clear sky"
  icon: string;             // OWM icon code e.g. "01d"
  iconUrl: string;          // full https URL
  alerts: string[];         // human-readable weather warnings
  forecast: ForecastDay[];  // 7-day daily forecast
}

export interface ForecastDay {
  date: string;    // "YYYY-MM-DD"
  tempMin: number;
  tempMax: number;
  description: string;
  icon: string;
  iconUrl: string;
}

// ─── Fallback Mock Weather ─────────────────────────────────────────────────────

function buildMockWeather(city: string): WeatherData {
  const today = new Date();
  const forecast: ForecastDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      date: d.toISOString().split('T')[0],
      tempMin: 18 + Math.round(Math.random() * 4),
      tempMax: 26 + Math.round(Math.random() * 6),
      description: ['clear sky', 'few clouds', 'partly cloudy', 'light rain'][i % 4],
      icon: ['01d', '02d', '03d', '10d'][i % 4],
      iconUrl: `https://openweathermap.org/img/wn/${['01d', '02d', '03d', '10d'][i % 4]}@2x.png`,
    };
  });

  return {
    city,
    country: 'XX',
    temperature: 24,
    feelsLike: 25,
    humidity: 65,
    windSpeed: 3.5,
    description: 'clear sky',
    icon: '01d',
    iconUrl: 'https://openweathermap.org/img/wn/01d@2x.png',
    alerts: [],
    forecast,
  };
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const city = searchParams.get('city');

  if (!city) {
    return Response.json({ error: 'city query parameter is required.' }, { status: 400 });
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;

  // ── No API key → return mock data ────────────────────────────────────────
  if (!apiKey || apiKey === 'your_openweather_api_key_here') {
    console.warn('[TravelMate] OPENWEATHER_API_KEY not set — returning mock weather.');
    return Response.json(buildMockWeather(city));
  }

  try {
    // ── Current weather ───────────────────────────────────────────────────
    const [currentRes, forecastRes] = await Promise.all([
      fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`,
      ),
      fetch(
        `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&cnt=56`,
      ),
    ]);

    if (!currentRes.ok) {
      console.error('[TravelMate] OWM current weather error:', currentRes.status);
      return Response.json(buildMockWeather(city));
    }

    const current = await currentRes.json();
    const forecastRaw = forecastRes.ok ? await forecastRes.json() : null;

    // Aggregate OWM 3-hour forecast into daily buckets
    const dailyMap = new Map<string, { mins: number[]; maxs: number[]; desc: string; icon: string }>();
    if (forecastRaw?.list) {
      for (const entry of forecastRaw.list) {
        const dateKey = entry.dt_txt.split(' ')[0];
        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, { mins: [], maxs: [], desc: entry.weather[0].description, icon: entry.weather[0].icon });
        }
        const d = dailyMap.get(dateKey)!;
        d.mins.push(entry.main.temp_min);
        d.maxs.push(entry.main.temp_max);
      }
    }

    const forecast: ForecastDay[] = Array.from(dailyMap.entries())
      .slice(0, 7)
      .map(([date, d]) => ({
        date,
        tempMin: Math.round(Math.min(...d.mins)),
        tempMax: Math.round(Math.max(...d.maxs)),
        description: d.desc,
        icon: d.icon,
        iconUrl: `https://openweathermap.org/img/wn/${d.icon}@2x.png`,
      }));

    // Build weather alerts from extreme conditions
    const alerts: string[] = [];
    const temp = Math.round(current.main.temp);
    const wind = current.wind.speed;
    const humidity = current.main.humidity;
    if (temp >= 35) alerts.push(`⚠️ Extreme heat warning: ${temp}°C. Stay hydrated and avoid midday sun.`);
    if (temp <= 0) alerts.push(`❄️ Freezing temperatures: ${temp}°C. Pack heavy winter clothing.`);
    if (wind >= 10) alerts.push(`💨 Strong winds: ${wind} m/s. Secure loose items when outdoors.`);
    if (humidity >= 85) alerts.push(`💧 High humidity: ${humidity}%. Expect muggy conditions.`);
    if (current.weather?.[0]?.main === 'Rain') alerts.push('🌧️ Rain expected. Pack a compact umbrella.');
    if (current.weather?.[0]?.main === 'Thunderstorm') alerts.push('⛈️ Thunderstorm advisory. Avoid open areas.');

    const weatherData: WeatherData = {
      city: current.name,
      country: current.sys.country,
      temperature: temp,
      feelsLike: Math.round(current.main.feels_like),
      humidity,
      windSpeed: Math.round(wind * 10) / 10,
      description: current.weather?.[0]?.description ?? '',
      icon: current.weather?.[0]?.icon ?? '01d',
      iconUrl: `https://openweathermap.org/img/wn/${current.weather?.[0]?.icon ?? '01d'}@2x.png`,
      alerts,
      forecast,
    };

    return Response.json(weatherData);
  } catch (error) {
    console.error('[TravelMate] /api/weather unexpected error:', error);
    return Response.json(buildMockWeather(city));
  }
}
