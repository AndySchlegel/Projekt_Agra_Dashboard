/* =========================================================
   Agrar-Dashboard • app.js (v9, kommentiert)
   Features:
   - Open-Meteo Live-Daten (Heute, Morgen, 7-Tage)
   - Stadtsuche via Open-Meteo Geocoding
   - Produkt-Filter (Dropdown) mit Suche, Zähler, Alle/Keine
   - Produktkarten mit Status (grün/orange/rot) + Mini-Charts (Chart.js)
   - Hero-KPI (Ort + aktuelle Temperatur)
========================================================= */

/* ------------------------- 0) Startzustand ------------------------- */
// Fallback-Startkoordinaten (Berlin), bis der Nutzer sucht
let LAT = 52.5200;
let LON = 13.4050;
let CURRENT_LOCATION_NAME = "Berlin";

/* ------------------------- 1) DOM-Referenzen ----------------------- */
// Alle DOM-Elemente zentral sammeln, damit Selektoren nicht verstreut sind
const els = {
    // Wetter Heute
    today: {
        desc: document.getElementById("today-desc"),
        temp: document.getElementById("today-temp"),
        precip: document.getElementById("today-precip"),
        pop: document.getElementById("today-pop"),
        rh: document.getElementById("today-rh"),
        updated: document.getElementById("today-updated"),
    },
    // Wetter Morgen
    tomorrow: {
        desc: document.getElementById("tomorrow-desc"),
        temp: document.getElementById("tomorrow-temp"),
        precip: document.getElementById("tomorrow-precip"),
        pop: document.getElementById("tomorrow-pop"),
        rh: document.getElementById("tomorrow-rh"),
    },
    // 7-Tage-Container
    grid: document.getElementById("forecast-grid"),

    // Stadtsuche
    cityForm: document.getElementById("city-form"),
    cityInput: document.getElementById("city-input"),
    cityStatus: document.getElementById("city-status"),

    // Produkt-Filter (Dropdown)
    productList: document.getElementById("product-list"),
    productSearch: document.getElementById("product-search"),
    productCount: document.getElementById("product-count"),
    btnAll: document.getElementById("btn-all"),
    btnNone: document.getElementById("btn-none"),

    // Produktkarten-Grid
    cardsGrid: document.getElementById("cards-grid"),

    // Hero-KPI
    kpiLoc: document.getElementById("kpi-location"),
    kpiTemp: document.getElementById("kpi-temp"),
};

/* ------------------------- 2) Hilfsfunktionen ---------------------- */
// Einheitliche Zahlenausgabe (mit Einheit) + Fallback „–“
const fmt = (n, unit = "") =>
    n == null || Number.isNaN(n)
        ? `–${unit ? " " + unit : ""}`
        : `${(Math.round(n * 10) / 10).toLocaleString("de-DE")}${unit ? " " + unit : ""}`;

// Aktualisiert die sichtbare Standort-Anzeige (Kachel + Hero-KPI)
function updateStatus(lat, lon, name = CURRENT_LOCATION_NAME) {
    CURRENT_LOCATION_NAME = name;
    if (els.cityStatus)
        els.cityStatus.textContent = `Aktueller Standort: ${name} (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
    if (els.kpiLoc) els.kpiLoc.textContent = name;
}

// WMO → Klartext + Icon (simplifiziert)
const WMO_TEXT = {
    0: "Klar", 1: "Meist sonnig", 2: "Wolkig", 3: "Bedeckt",
    45: "Nebel", 48: "Reifnebel",
    51: "Niesel", 53: "Niesel", 55: "Starker Niesel",
    61: "Regen", 63: "Regen", 65: "Starker Regen",
    66: "Gefrierender Regen", 67: "Gefr. starker Regen",
    71: "Schnee", 73: "Schnee", 75: "Starker Schnee",
    77: "Schneekörner",
    80: "Regenschauer", 81: "Regenschauer", 82: "Starker Schauer",
    85: "Schneeschauer", 86: "Starke Schneeschauer",
    95: "Gewitter", 96: "Gewitter/Hagel", 99: "Gewitter/Hagel",
};
const WMO_ICON = {
    0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️", 45: "🌫️", 48: "🌫️",
    51: "🌦️", 53: "🌦️", 55: "🌧️", 61: "🌧️", 63: "🌧️", 65: "🌧️",
    66: "🌧️", 67: "🌧️", 71: "🌨️", 73: "🌨️", 75: "❄️", 77: "❄️",
    80: "🌦️", 81: "🌧️", 82: "⛈️", 85: "🌨️", 86: "🌨️", 95: "⛈️", 96: "⛈️", 99: "⛈️",
};

/* ------------------------- 3) Wetter laden/rendern ----------------- */
/** Lädt die Wetterdaten für (lat, lon) von Open-Meteo */
async function loadWeather(lat, lon) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const qs = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        timezone: tz,
        current: "temperature_2m,relative_humidity_2m,precipitation,weather_code",
        hourly: "precipitation_probability,relative_humidity_2m",
        daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
        forecast_days: "7",
    });
    const url = `https://api.open-meteo.com/v1/forecast?${qs}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    const data = await res.json();

    // UI aktualisieren
    renderToday(data);
    renderTomorrow(data);
    render7Day(data);

    // Daten für Karten/Charts vormerken
    window.__latestCurrent = data.current;
    window.__daily = data.daily;
    window.__avgRH = buildDailyAvgRH(data);

    // Produktkarten neu zeichnen
    refreshCards();

    // Standortzeile sicher aktualisieren
    updateStatus(LAT, LON);
}

/** Rendert die „Heute“-Kachel */
function renderToday(data) {
    const c = data.current;

    // Regenwahrscheinlichkeit aus stündlichen Daten (aktuelle Stunde)
    const nowISO = new Date().toISOString().slice(0, 13);
    const idx = data.hourly.time.findIndex((t) => t.startsWith(nowISO));
    const pop = idx >= 0 ? data.hourly.precipitation_probability[idx] : null;

    els.today.desc.textContent = `${WMO_ICON[c.weather_code] ?? ""} ${WMO_TEXT[c.weather_code] ?? "–"}`;
    els.today.temp.textContent = fmt(c.temperature_2m, "°C");
    els.today.precip.textContent = fmt(c.precipitation, "mm");
    els.today.pop.textContent = fmt(pop, "%");
    els.today.rh.textContent = fmt(c.relative_humidity_2m, "%");
    els.today.updated.textContent = `Aktualisiert: ${new Date().toLocaleString("de-DE")}`;

    // Hero-KPI: aktuelle Temperatur
    if (els.kpiTemp) els.kpiTemp.textContent = fmt(c.temperature_2m, "°C");
}

/** Rendert die „Morgen“-Kachel */
function renderTomorrow(data) {
    const d = data.daily;
    const w = d.weather_code?.[1];

    els.tomorrow.desc.textContent = `${WMO_ICON[w] ?? ""} ${WMO_TEXT[w] ?? "–"}`;
    els.tomorrow.temp.textContent = `${fmt(d.temperature_2m_min?.[1], "°C")} / ${fmt(d.temperature_2m_max?.[1], "°C")}`;
    els.tomorrow.precip.textContent = fmt(d.precipitation_sum?.[1], "mm");
    els.tomorrow.pop.textContent = fmt(d.precipitation_probability_max?.[1], "%");

    // Ø Luftfeuchte für morgen (aus hourly aggregiert)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const iso = tomorrow.toISOString().slice(0, 10);

    const idxs = data.hourly.time.map((t, i) => (t.startsWith(iso) ? i : null)).filter((i) => i != null);
    const rhAvg = idxs.length
        ? idxs.reduce((sum, i) => sum + (data.hourly.relative_humidity_2m[i] ?? 0), 0) / idxs.length
        : null;

    els.tomorrow.rh.textContent = fmt(rhAvg, "%");
}

/** Rendert die 7-Tage-Übersicht */
function render7Day(data) {
    const d = data.daily;
    els.grid.innerHTML = "";
    d.time.forEach((t, i) => {
        const date = new Date(t);
        const el = document.createElement("div");
        el.className = "day";
        el.innerHTML = `
      <div class="name">${date.toLocaleDateString("de-DE", { weekday: "short" })}</div>
      <div class="icon" aria-hidden="true">${WMO_ICON[d.weather_code[i]] ?? "❓"}</div>
      <div class="t">${fmt(d.temperature_2m_min[i], "°C")} / ${fmt(d.temperature_2m_max[i], "°C")}</div>
      <div class="t" style="font-size:12px;color:#5c6b77;">Regen: ${fmt(d.precipitation_sum[i], "mm")} • W'keit: ${fmt(d.precipitation_probability_max[i], "%")}</div>
    `;
        els.grid.appendChild(el);
    });
}

/* ------------------------- 4) Aggregation ØRH (Charts) -------------- */
/** Bildet pro Tag die durchschnittliche relative Luftfeuchte aus stündlichen Werten */
function buildDailyAvgRH(data) {
    const map = new Map(); // 'YYYY-MM-DD' -> {sum,count}
    const times = data.hourly.time;
    const rhs = data.hourly.relative_humidity_2m;

    for (let i = 0; i < times.length; i++) {
        const day = times[i].slice(0, 10);
        const val = rhs?.[i];
        if (val == null) continue;
        const e = map.get(day) || { sum: 0, count: 0 };
        e.sum += val; e.count += 1;
        map.set(day, e);
    }
    return data.daily.time.map((d) => {
        const e = map.get(d);
        return e ? e.sum / e.count : null;
    });
}

/* ------------------------- 5) Stadtsuche (Geocoding) ---------------- */
async function geocodeCity(q) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=de&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Geocoding fehlgeschlagen");
    const data = await res.json();
    const hit = data?.results?.[0];
    if (!hit) return null;
    return { lat: hit.latitude, lon: hit.longitude, name: `${hit.name}${hit.country ? ", " + hit.country : ""}` };
}

els.cityForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = els.cityInput?.value?.trim();
    if (!q) { alert("Bitte Stadt eingeben."); return; }
    if (els.cityStatus) els.cityStatus.textContent = `Suche „${q}“…`;
    try {
        const loc = await geocodeCity(q);
        if (!loc) {
            if (els.cityStatus) els.cityStatus.textContent = `Keine Treffer für „${q}“.`;
            return;
        }
        LAT = loc.lat; LON = loc.lon;
        updateStatus(LAT, LON, loc.name);  // Name sofort sichtbar
        await loadWeather(LAT, LON);       // und Daten nachladen
    } catch (err) {
        console.error(err);
        if (els.cityStatus) els.cityStatus.textContent = "Fehler bei der Suche.";
    }
});

/* ------------------------- 6) Produkt-Logik ------------------------- */
// Fach-Parameter pro Kultur (aus deinen Tabellenanforderungen)
const CROPS = [
    { key: "weizen", name: "Weizen", rhMax: 60, tMin: 22, tMax: 26, note: "Unter 18 % Kornfeuchte, sonst Qualitätsverluste." },
    { key: "mais", name: "Mais", rhMax: 20, tMin: 15, tMax: 30, note: "Bei hoher Luftfeuchte steigt Schimmelrisiko." },
    { key: "raps", name: "Raps", rhMax: 40, tMin: 20, tMax: 25, note: "Sehr empfindlich – Auswuchsgefahr bei Feuchte." },
    { key: "gerste", name: "Gerste", rhMax: 17, tMin: 18, tMax: 24, note: "Malzqualität leidet bei zu hoher Feuchte." },
    { key: "kartoffeln", name: "Kartoffeln", rhMax: 75, tMin: 10, tMax: 18, note: "Schalenfestigkeit wichtig, Hitze = Fäulnisrisiko." },
    { key: "zuckerrueben", name: "Zuckerrüben", rhMax: 80, tMin: 8, tMax: 15, note: "Kühl ernten, sonst Lagerverluste." },
    { key: "sonnenblumen", name: "Sonnenblumen", rhMax: 15, tMin: 22, tMax: 28, note: "Ölqualität sinkt bei hoher Kornfeuchte." },
];
// „Akzeptabel“-Toleranzen (global, simpel – kann je Kultur verfeinert werden)
const TOL = { temp: 2, rh: 10 };

/** Ermittelt Ampel-Status anhand aktueller Temp/RH + Sollwerte der Kultur */
function calcStatus(tempC, rhPct, crop) {
    if (rhPct <= crop.rhMax && tempC >= crop.tMin && tempC <= crop.tMax) {
        return { cls: "green", text: "Erntebereit" };
    }
    const nearTemp = tempC >= crop.tMin - TOL.temp && tempC <= crop.tMax + TOL.temp;
    const nearRh = rhPct <= crop.rhMax + TOL.rh;
    if (nearTemp && nearRh) {
        return { cls: "orange", text: "Akzeptabel" };
    }
    return { cls: "red", text: "Problematisch" };
}

/* ------------------------- 7) Produkt-Filter (Dropdown) ------------- */
function getSelectedKeys() {
    const boxes = els.productList?.querySelectorAll('input[type="checkbox"]') ?? [];
    const keys = [];
    boxes.forEach((b) => { if (b.checked) keys.push(b.dataset.key); });
    return keys;
}

function updateSelectedCount() {
    const n = getSelectedKeys().length;
    if (els.productCount) els.productCount.textContent = `${n} ausgewählt`;
}

/** Baut die Checkbox-Liste neu auf (berücksichtigt Suche + vorhandene Auswahl) */
function renderProductFilter() {
    if (!els.productList) return;
    const prev = new Set(getSelectedKeys());       // Auswahl merken
    els.productList.innerHTML = "";

    const q = (els.productSearch?.value || "").toLowerCase().trim();
    CROPS.filter(c => !q || c.name.toLowerCase().includes(q))
        .forEach(c => {
            const li = document.createElement("li");
            const checked = prev.size === 0 ? true : prev.has(c.key); // Default: alles an
            li.innerHTML = `
            <input type="checkbox" id="cb-${c.key}" data-key="${c.key}" ${checked ? "checked" : ""}>
            <label for="cb-${c.key}">${c.name}</label>
          `;
            els.productList.appendChild(li);
        });

    updateSelectedCount();
}

// Filter-Events
els.productSearch?.addEventListener("input", renderProductFilter);
els.productList?.addEventListener("change", () => { updateSelectedCount(); refreshCards(); });

// „Alle“ / „Keine“
els.btnAll?.addEventListener("click", () => {
    els.productList?.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    updateSelectedCount(); refreshCards();
});
els.btnNone?.addEventListener("click", () => {
    els.productList?.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    updateSelectedCount(); refreshCards();
});

/* ------------------------- 8) Produktkarten + Charts ---------------- */
// Chart-Instanzen registrieren, damit beim Neu-Rendern sauber zerstört wird
const __charts = new Map();

/** Zeichnet das Linien-Diagramm je Kultur (Temp min/max, ØRH, Soll-Guides) */
function drawCropChart(canvasId, daily, avgRH, crop) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || typeof Chart === "undefined") return;

    // Alte Instanz entsorgen
    if (__charts.has(canvasId)) { __charts.get(canvasId).destroy(); __charts.delete(canvasId); }

    const labels = daily.time.map(t => new Date(t).toLocaleDateString("de-DE", { weekday: "short" }));
    const tMin = daily.temperature_2m_min;
    const tMax = daily.temperature_2m_max;

    const tMinLine = new Array(labels.length).fill(crop.tMin);
    const tMaxLine = new Array(labels.length).fill(crop.tMax);
    const rhMaxLine = new Array(labels.length).fill(crop.rhMax);

    const chart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                { label: "Temp max", data: tMax, tension: .3, borderWidth: 2, pointRadius: 0 },
                { label: "Temp min", data: tMin, tension: .3, borderWidth: 2, pointRadius: 0 },
                { label: "Ø LF", data: avgRH, yAxisID: "yRH", tension: .3, borderWidth: 2, pointRadius: 0 },
                // Guidelines (gestrichelt)
                { label: "tMax Opt", data: tMaxLine, borderDash: [6, 6], borderWidth: 1, pointRadius: 0 },
                { label: "tMin Opt", data: tMinLine, borderDash: [6, 6], borderWidth: 1, pointRadius: 0 },
                { label: "RH Max", data: rhMaxLine, yAxisID: "yRH", borderDash: [6, 6], borderWidth: 1, pointRadius: 0 },
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "nearest", intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label(ctx) {
                            const isRH = ctx.dataset.yAxisID === "yRH";
                            const val = Math.round(ctx.parsed.y * 10) / 10;
                            return `${ctx.dataset.label}: ${val}${isRH ? " %" : " °C"}`;
                        }
                    }
                }
            },
            scales: {
                y: { title: { display: true, text: "°C" }, ticks: { maxTicksLimit: 5 } },
                yRH: {
                    position: "right", title: { display: true, text: "% RH" },
                    min: 0, max: 100, grid: { drawOnChartArea: false }, ticks: { maxTicksLimit: 5 }
                }
            }
        }
    });

    __charts.set(canvasId, chart);
}

/** Baut Karten je ausgewählter Kultur – inkl. farbigem Status-Rahmen und Chart */
function renderCardsFromData(currentData) {
    if (!els.cardsGrid) return;

    const tempC = currentData?.temperature_2m;
    const rhPct = currentData?.relative_humidity_2m;

    const selected = new Set(getSelectedKeys());
    els.cardsGrid.innerHTML = "";

    const daily = window.__daily;
    const avgRH = window.__avgRH;

    CROPS.filter(c => selected.has(c.key)).forEach(crop => {
        const st = calcStatus(tempC, rhPct, crop);
        const canvasId = `chart-${crop.key}`;

        const card = document.createElement("div");
        card.className = `pcard status-${st.cls}`; // farbiger Rahmen via CSS
        card.innerHTML = `
      <div class="head">
        <div class="pname">${crop.name}</div>
        <div class="pstatus ${st.cls}">${st.text}</div>
      </div>
      <div class="pkv">
        <div class="item"><div class="label">Optimale Temp.</div><div class="value">${crop.tMin}–${crop.tMax} °C</div></div>
        <div class="item"><div class="label">Max. Luftfeuchte</div><div class="value">≤ ${crop.rhMax} %</div></div>
        <div class="item"><div class="label">Aktuelle Temp.</div><div class="value">${fmt(tempC, "°C")}</div></div>
        <div class="item"><div class="label">Aktuelle Luftfeuchte</div><div class="value">${fmt(rhPct, "%")}</div></div>
      </div>
      <div class="note">Erntehinweis: ${crop.note}</div>
      <div class="chart-wrap"><canvas id="${canvasId}" aria-label="Verlauf ${crop.name}"></canvas></div>
    `;
        els.cardsGrid.appendChild(card);

        if (daily && avgRH) drawCropChart(canvasId, daily, avgRH, crop);
    });
}

/** Re-Render der Karten, wenn Filter ändert oder neue Daten da sind */
function refreshCards() {
    if (!window.__latestCurrent) return;
    renderCardsFromData(window.__latestCurrent);
}

/* ------------------------- 9) Initialisierung ----------------------- */
(function init() {
    // Produkt-Filter initial aufbauen
    renderProductFilter();
    updateSelectedCount();

    // Neutralen Status setzen
    updateStatus(LAT, LON, CURRENT_LOCATION_NAME);

    // Wetterdaten laden
    loadWeather(LAT, LON).catch((err) => {
        console.error(err);
        alert("Fehler beim Laden der Wetterdaten (Details in der Konsole).");
    });
})();
/* ====== Auto-Refresh Wetter (optional) ====== */
// Intervall in Millisekunden (z. B. 15 Min)
const REFRESH_MS = 15 * 60 * 1000;
let refreshTimer = null;

// nur 1 aktiver Request gleichzeitig
let isFetching = false;
async function safeReload() {
    if (isFetching) return;
    try {
        isFetching = true;
        await loadWeather(LAT, LON);
    } finally {
        isFetching = false;
    }
}

// Timer starten/stoppen je nach Tab-Sichtbarkeit
function startAutoRefresh() {
    stopAutoRefresh();
    refreshTimer = setInterval(safeReload, REFRESH_MS);
}
function stopAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
}
document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAutoRefresh();
    else { safeReload(); startAutoRefresh(); } // sofort aktualisieren, dann weiter laufen lassen
});

// beim ersten Laden aktivieren
startAutoRefresh();
