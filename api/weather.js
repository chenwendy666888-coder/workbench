// api/weather.js —— Open-Meteo 代理（无需 API key）
// 入参: ?city=上海  或  ?lat=31.23&lon=121.47
// 出参: { location, temp, humidity, wind, code, desc, icon, daily:[...], fetchedAt }

const WMO = {
  0: ['晴', '☀️'], 1: ['大致晴朗', '🌤️'], 2: ['局部多云', '⛅'], 3: ['阴', '☁️'],
  45: ['雾', '🌫️'], 48: ['雾凇', '🌫️'],
  51: ['小毛毛雨', '🌦️'], 53: ['毛毛雨', '🌦️'], 55: ['大毛毛雨', '🌧️'],
  61: ['小雨', '🌦️'], 63: ['中雨', '🌧️'], 65: ['大雨', '🌧️'],
  66: ['冻雨', '🌧️'], 67: ['强冻雨', '🌧️'],
  71: ['小雪', '🌨️'], 73: ['中雪', '🌨️'], 75: ['大雪', '❄️'], 77: ['雪粒', '🌨️'],
  80: ['阵雨', '🌦️'], 81: ['强阵雨', '🌧️'], 82: ['暴雨', '⛈️'],
  85: ['阵雪', '🌨️'], 86: ['强阵雪', '❄️'],
  95: ['雷阵雨', '⛈️'], 96: ['雷阵雨伴冰雹', '⛈️'], 99: ['强雷暴冰雹', '⛈️'],
};

const cache = globalThis.__weatherCache || (globalThis.__weatherCache = new Map());
const CACHE_TTL = 10 * 60 * 1000;

const wmo = (code) => WMO[code] || ['未知', '🌡️'];

export default async function handler(req, res) {
  try {
    const q = req.query || {};
    let city = q.city, lat = q.lat, lon = q.lon;
    if ((city === undefined || lat === undefined) && req.url) {
      try { const u = new URL(req.url, 'http://localhost'); city = city ?? u.searchParams.get('city'); lat = lat ?? u.searchParams.get('lat'); lon = lon ?? u.searchParams.get('lon'); } catch (e) {}
    }

    let latitude, longitude, locationName;
    if (city) {
      const geoRes = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=zh&format=json&name=' + encodeURIComponent(city));
      const geo = await geoRes.json();
      if (!geo.results || !geo.results.length) {
        return res.status(404).json({ error: `找不到城市: ${city}` });
      }
      const g = geo.results[0];
      latitude = g.latitude; longitude = g.longitude;
      locationName = g.name + (g.country ? `, ${g.country}` : '');
    } else if (lat && lon) {
      latitude = lat; longitude = lon; locationName = '当前位置';
    } else {
      return res.status(400).json({ error: '需要 city 或 lat&lon 参数' });
    }

    const key = `${latitude},${longitude}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < CACHE_TTL) return res.status(200).json(hit.v);

    const fcRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`
    );
    const fc = await fcRes.json();
    const cur = fc.current;
    const [desc, icon] = wmo(cur.weather_code);
    const daily = (fc.daily?.time || []).slice(0, 7).map((d, i) => {
      const [dd, di] = wmo(fc.daily.weather_code[i]);
      return { date: d, max: fc.daily.temperature_2m_max[i], min: fc.daily.temperature_2m_min[i], code: fc.daily.weather_code[i], desc: dd, icon: di };
    });
    const payload = {
      location: locationName,
      temp: Math.round(cur.temperature_2m),
      humidity: cur.relative_humidity_2m,
      wind: cur.wind_speed_10m,
      code: cur.weather_code, desc, icon, daily,
      fetchedAt: Date.now(),
    };
    cache.set(key, { t: Date.now(), v: payload });
    res.status(200).json(payload);
  } catch (e) {
    res.status(500).json({ error: '天气获取失败', detail: String(e) });
  }
}
