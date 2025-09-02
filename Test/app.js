// ---- Minimaler Open-Meteo Test ohne API-Key ----

const els = {
  today: {
    icon: document.getElementById('today-icon'),
    desc: document.getElementById('today-desc'),
    temp: document.getElementById('today-temp'),
    precip: document.getElementById('today-precip'),
    pop: document.getElementById('today-pop'),
    rh: document.getElementById('today-rh'),
    updated: document.getElementById('today-updated'),
  },
  tomorrow: {
    icon: document.getElementById('tomorrow-icon'),
    desc: document.getElementById('tomorrow-desc'),
    temp: document.getElementById('tomorrow-temp'),
    precip: document.getElementById('tomorrow-precip'),
    pop: document.getElementById('tomorrow-pop'),
    rh: document.getElementById('tomorrow-rh'),
  },
  grid: document.getElementById('forecast-grid'),
  lastUrl: document.getElementById('last-url'),
  form: document.getElementById('loc-form'),
  lat: document.getElementById('lat'),
  lon: document.getElementById('lon'),
};

// WMO Code -> Icon & Text (vereinfacht)
const WMO = {
  0:  { icon: '☀️', text: 'Klar' },
  1:  { icon: '🌤️', text: 'Meist sonnig' },
  2:  { icon: '⛅', text: 'Wolkig' },
  3:  { icon: '☁️', text: 'Bedeckt' },
  45: { icon: '🌫️', text: 'Nebel' },
  48: { icon: '🌫️', text: 'Reifnebel' },
  51: { icon: '🌦️', text: 'Niesel' },
  53: { icon: '🌦️', text: 'Niesel' },
  55: { icon: '🌧️', text: 'Starker Niesel' },
  61: { icon: '🌧️', text: 'Regen' },
  63: { icon: '🌧️', text: 'Regen' },
  65: { icon: '🌧️', text: 'Starker Regen' },
  66: { icon: '🌧️', text: 'Gefrierender Regen' },
  67: { icon: '🌧️', text: 'Gefr. starker Regen' },
  71: { icon: '🌨️', text: 'Schnee' },
  73: { icon: '🌨️', text: 'Schnee' },
  75: { icon: '❄️', text: 'Starker Schnee' },
  77: { icon: '❄️', text: 'Schneekörner' },
  80: { icon: '🌦️', text: 'Regen-Schauer' },
  81: { icon: '🌧️', text: 'Regen-Schauer' },
  82: { icon: '⛈️', text: 'Starker Schauer' },
  85: { icon: '🌨️', text: 'Schneeschauer' },
  86: { icon: '🌨️', text: 'Starke Schneeschauer' },
  95: { icon: '⛈️', text: 'Gewitter' },
  96: { icon: '⛈️', text: 'Gewitter mit Hagel' },
  99: { icon: '⛈️', text: 'Gewitter mit Hagel' },
};
const wmoToIcon = code => (WMO[code]?.icon ?? '❓');
const wmoToText = code => (WMO[code]?.text ?? `WMO ${code}`);

function fmt(n, unit='') {
  if (n == null || Number.isNaN(n)) return '–' + (unit ? ' ' + unit : '');
  return `${(Math.round(n * 10) / 10).toLocaleString('de-DE')}${unit ? ' ' + unit : ''}`;
}
function toISODate(date){ return date.toISOString().slice(0,10); }

async function load(lat, lon) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    timezone: tz,
    current: 'temperature_2m,relative_humidity_2m,precipitation,weather_code',
    hourly: 'temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max',
    forecast_days: '7'
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  els.lastUrl.textContent = url;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  render(data);
}

function render(data){
  // HEUTE (current + stündliche POP)
  const nowIdx = findCurrentHourIndex(data.hourly.time);
  const cur = data.current;
  const popNow = data.hourly.precipitation_probability?.[nowIdx];
  const wcode = cur.weather_code;

  els.today.icon.textContent = wmoToIcon(wcode);
  els.today.desc.textContent = wmoToText(wcode);
  els.today.temp.textContent = fmt(cur.temperature_2m, '°C');
  els.today.precip.textContent = fmt(cur.precipitation, 'mm');
  els.today.pop.textContent = fmt(popNow, '%');
  els.today.rh.textContent = fmt(cur.relative_humidity_2m, '%');
  els.today.updated.textContent = `Aktualisiert: ${new Date().toLocaleString('de-DE')}`;

  // MORGEN (daily + stündliche Ø RH)
  const rhTomorrow = avgRelativeHumidityForDay(data.hourly.time, data.hourly.relative_humidity_2m, 1);
  const wcodeTomorrow = data.daily.weather_code?.[1];
  els.tomorrow.icon.textContent = wmoToIcon(wcodeTomorrow);
  els.tomorrow.desc.textContent = wmoToText(wcodeTomorrow);
  const tmin = data.daily.temperature_2m_min?.[1];
  const tmax = data.daily.temperature_2m_max?.[1];
  const psum = data.daily.precipitation_sum?.[1];
  const popMax = data.daily.precipitation_probability_max?.[1];
  els.tomorrow.temp.textContent = `${fmt(tmin, '°C')} / ${fmt(tmax, '°C')}`;
  els.tomorrow.precip.textContent = fmt(psum, 'mm');
  els.tomorrow.pop.textContent = fmt(popMax, '%');
  els.tomorrow.rh.textContent = fmt(rhTomorrow, '%');

  // 7-Tage
  render7Day(data.daily);
}

function findCurrentHourIndex(times){
  const now = new Date();
  // times sind ISO Strings; exakte Übereinstimmung mit voller Stunde
  const idx = times.findIndex(t => {
    const d = new Date(t);
    return d.getUTCFullYear() === now.getUTCFullYear() &&
           d.getUTCMonth() === now.getUTCMonth() &&
           d.getUTCDate() === now.getUTCDate() &&
           d.getUTCHours() === now.getUTCHours();
  });
  return Math.max(0, idx);
}

function avgRelativeHumidityForDay(times, values, dayOffset){
  if (!times || !values) return null;
  const today = new Date();
  const target = new Date(today);
  target.setDate(today.getDate() + dayOffset);
  const targetISO = toISODate(target);

  const indices = times
    .map((t, i) => ({ i, d: t.slice(0,10) }))
    .filter(x => x.d === targetISO)
    .map(x => x.i);

  if (!indices.length) return null;
  const sum = indices.reduce((acc, i) => acc + (values[i] ?? 0), 0);
  return sum / indices.length;
}

function render7Day(daily){
  els.grid.innerHTML = '';
  const days = daily.time;
  for (let i=0; i<days.length; i++){
    const date = new Date(days[i]);
    const el = document.createElement('div');
    el.className = 'day';

    const wcode = daily.weather_code?.[i];
    const icon = wmoToIcon(wcode);
    const desc = wmoToText(wcode);
    const tmin = daily.temperature_2m_min?.[i];
    const tmax = daily.temperature_2m_max?.[i];
    const psum = daily.precipitation_sum?.[i];
    const pop = daily.precipitation_probability_max?.[i];

    const riskBadgeClass =
      pop >= 70 ? 'badge bad' :
      pop >= 40 ? 'badge warn' : 'badge good';

    el.innerHTML = `
      <div class="date">${date.toLocaleDateString('de-DE', { weekday:'short', day:'2-digit', month:'2-digit' })}</div>
      <div class="icon" aria-hidden="true">${icon}</div>
      <div class="t">${fmt(tmin,'°C')} / ${fmt(tmax,'°C')}</div>
      <div class="desc">${desc}</div>
      <div class="row">
        <span class="badge ${riskBadgeClass}">Regenw.: ${fmt(pop,'%')}</span>
      </div>
      <div class="row">Niederschlag: <strong>${fmt(psum,'mm')}</strong></div>
    `;
    els.grid.appendChild(el);
  }
}

// Init + Standort-Form
els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const lat = parseFloat(els.lat.value);
  const lon = parseFloat(els.lon.value);
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    alert('Bitte gültige Koordinaten eingeben.');
    return;
  }
  load(lat, lon).catch(err => {
    console.error(err);
    alert('Fehler beim Laden der Wetterdaten. Details in der Konsole.');
  });
});

// Erste Ladung (Berlin)
load(parseFloat(els.lat.value), parseFloat(els.lon.value)).catch(console.error);
