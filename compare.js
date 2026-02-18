import { trackCompare } from './firebase.js';

// ─── DOM Elements ──────────────────────────────────────
const cityAInput = document.getElementById('cityA');
const cityBInput = document.getElementById('cityB');
const compareBtn = document.getElementById('compareBtn');
const compareResults = document.getElementById('compareResults');
const compareError = document.getElementById('compareError');
const cardA = document.getElementById('cardA');
const cardB = document.getElementById('cardB');
const statsComparison = document.getElementById('statsComparison');
const verdictContent = document.getElementById('verdictContent');

// ─── Event Listeners ───────────────────────────────────
compareBtn.addEventListener('click', runComparison);

cityAInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') cityBInput.focus();
});
cityBInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runComparison();
});

// ─── Main Comparison Flow ──────────────────────────────
async function runComparison() {
    const cityA = cityAInput.value.trim();
    const cityB = cityBInput.value.trim();

    if (!cityA || !cityB) {
        showError('Please enter both city names.');
        return;
    }

    hideError();
    compareResults.classList.add('hidden');
    compareBtn.disabled = true;
    compareBtn.querySelector('span').textContent = 'Analyzing...';

    try {
        trackCompare(cityA, cityB);

        // Fetch weather for both cities in parallel
        const [weatherA, weatherB] = await Promise.all([
            fetchWeather(cityA),
            fetchWeather(cityB)
        ]);

        // Fetch AQI for both cities
        const [aqiA, aqiB] = await Promise.all([
            fetchAQI(weatherA.coord.lat, weatherA.coord.lon),
            fetchAQI(weatherB.coord.lat, weatherB.coord.lon)
        ]);

        const aqiValA = (aqiA && aqiA.list) ? aqiA.list[0].main.aqi : 0;
        const aqiValB = (aqiB && aqiB.list) ? aqiB.list[0].main.aqi : 0;

        // Render weather cards
        renderWeatherCard(cardA, weatherA, aqiValA);
        renderWeatherCard(cardB, weatherB, aqiValB);

        // Render stats comparison
        renderStatsComparison(weatherA, weatherB, aqiValA, aqiValB);

        // Show results
        compareResults.classList.remove('hidden');

        // Fetch AI verdict
        fetchVerdict(weatherA, weatherB, aqiValA, aqiValB);

    } catch (e) {
        showError(e.message || 'Failed to compare. Check city names and try again.');
    } finally {
        compareBtn.disabled = false;
        compareBtn.querySelector('span').textContent = 'Compare Now';
    }
}

// ─── API Calls ─────────────────────────────────────────
async function fetchWeather(city) {
    const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
    if (!res.ok) throw new Error(`Could not find "${city}"`);
    return res.json();
}

async function fetchAQI(lat, lon) {
    try {
        const res = await fetch(`/api/aqi?lat=${lat}&lon=${lon}`);
        return res.json();
    } catch { return null; }
}

// ─── Render Weather Card ───────────────────────────────
function renderWeatherCard(container, data, aqiVal) {
    const iconUrl = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
    const aqiMap = { 1: 'Good', 2: 'Fair', 3: 'Moderate', 4: 'Poor', 5: 'Very Poor' };
    const aqiColor = { 1: '#03dac6', 2: '#81c784', 3: '#ffeb3b', 4: '#ff9800', 5: '#cf6679' };
    const score = scoreWeather(data);

    container.innerHTML = `
        <div class="card-glass compare-city-card">
            <div class="compare-city-header">
                <h3>${data.name}, ${data.sys.country}</h3>
                <div class="compare-score" style="color: ${score >= 7 ? '#03dac6' : score >= 4 ? '#ffeb3b' : '#cf6679'}">
                    ${score.toFixed(1)}<span>/10</span>
                </div>
            </div>

            <div class="compare-weather-main">
                <img src="${iconUrl}" alt="${data.weather[0].description}" class="compare-icon" />
                <div class="compare-temp">${Math.round(data.main.temp)}°C</div>
                <div class="compare-desc">${capitalize(data.weather[0].description)}</div>
            </div>

            <div class="compare-details-grid">
                <div class="compare-detail">
                    <span class="detail-label">Feels Like</span>
                    <span class="detail-value">${Math.round(data.main.feels_like)}°C</span>
                </div>
                <div class="compare-detail">
                    <span class="detail-label">Humidity</span>
                    <span class="detail-value">${data.main.humidity}%</span>
                </div>
                <div class="compare-detail">
                    <span class="detail-label">Wind</span>
                    <span class="detail-value">${data.wind.speed} m/s</span>
                </div>
                <div class="compare-detail">
                    <span class="detail-label">Pressure</span>
                    <span class="detail-value">${data.main.pressure} hPa</span>
                </div>
                <div class="compare-detail">
                    <span class="detail-label">Visibility</span>
                    <span class="detail-value">${(data.visibility / 1000).toFixed(1)} km</span>
                </div>
                <div class="compare-detail">
                    <span class="detail-label">Air Quality</span>
                    <span class="detail-value" style="color: ${aqiColor[aqiVal] || 'inherit'}">${aqiMap[aqiVal] || 'N/A'}</span>
                </div>
            </div>
        </div>
    `;
}

// ─── Stats Comparison Bars ─────────────────────────────
function renderStatsComparison(a, b, aqiA, aqiB) {
    const metrics = [
        { label: 'Temperature', valA: a.main.temp, valB: b.main.temp, unit: '°C', max: 50 },
        { label: 'Humidity', valA: a.main.humidity, valB: b.main.humidity, unit: '%', max: 100 },
        { label: 'Wind Speed', valA: a.wind.speed, valB: b.wind.speed, unit: ' m/s', max: 30 },
        { label: 'Pressure', valA: a.main.pressure, valB: b.main.pressure, unit: ' hPa', max: 1100 },
        { label: 'Comfort Score', valA: scoreWeather(a), valB: scoreWeather(b), unit: '/10', max: 10 },
    ];

    statsComparison.innerHTML = `
        <div class="card-glass stats-card">
            <span class="section-label">Side-by-Side Metrics</span>
            <div class="stats-bars">
                ${metrics.map(m => {
        const pctA = Math.min(100, Math.max(5, (Math.abs(m.valA) / m.max) * 100));
        const pctB = Math.min(100, Math.max(5, (Math.abs(m.valB) / m.max) * 100));
        const better = m.label === 'Comfort Score' ?
            (m.valA > m.valB ? 'A' : m.valB > m.valA ? 'B' : 'tie') : 'tie';
        return `
                        <div class="stat-row">
                            <div class="stat-label">${m.label}</div>
                            <div class="stat-bars-container">
                                <div class="stat-bar-wrapper">
                                    <div class="stat-bar stat-bar-a ${better === 'A' ? 'winner' : ''}" style="width:${pctA}%"></div>
                                    <span class="stat-value">${typeof m.valA === 'number' ? (m.valA % 1 ? m.valA.toFixed(1) : m.valA) : m.valA}${m.unit}</span>
                                </div>
                                <div class="stat-bar-wrapper reverse">
                                    <div class="stat-bar stat-bar-b ${better === 'B' ? 'winner' : ''}" style="width:${pctB}%"></div>
                                    <span class="stat-value">${typeof m.valB === 'number' ? (m.valB % 1 ? m.valB.toFixed(1) : m.valB) : m.valB}${m.unit}</span>
                                </div>
                            </div>
                        </div>
                    `;
    }).join('')}
            </div>
            <div class="stats-legend">
                <span class="legend-a">${a.name}</span>
                <span class="legend-b">${b.name}</span>
            </div>
        </div>
    `;
}

// ─── AI Verdict ────────────────────────────────────────
async function fetchVerdict(weatherA, weatherB, aqiA, aqiB) {
    verdictContent.innerHTML = `
        <div class="advisor-loading">
            <div class="pulse-dot"></div>
            <span>AI is analyzing both cities...</span>
        </div>
    `;

    try {
        const res = await fetch('/api/compare-verdict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cityA: {
                    name: weatherA.name,
                    temp: Math.round(weatherA.main.temp),
                    humidity: weatherA.main.humidity,
                    wind: weatherA.wind.speed,
                    condition: weatherA.weather[0].description,
                    aqi: aqiA
                },
                cityB: {
                    name: weatherB.name,
                    temp: Math.round(weatherB.main.temp),
                    humidity: weatherB.main.humidity,
                    wind: weatherB.wind.speed,
                    condition: weatherB.weather[0].description,
                    aqi: aqiB
                }
            })
        });

        const result = await res.json();
        if (result.verdict) {
            renderVerdict(result.verdict, weatherA.name, weatherB.name);
        } else {
            throw new Error(result.error || 'No verdict');
        }
    } catch (e) {
        console.error('Verdict error:', e);
        verdictContent.innerHTML = `
            <div class="card-glass" style="text-align:center; opacity:0.7; padding:2rem;">
                <p>AI verdict is temporarily unavailable. Compare the metrics above to make your decision.</p>
            </div>
        `;
    }
}

function renderVerdict(text, nameA, nameB) {
    // Parse structured response
    let comparison = '', winner = '', reason = '';

    const compMatch = text.match(/COMPARISON:\s*(.+?)(?=WINNER:|$)/s);
    const winMatch = text.match(/WINNER:\s*(.+?)(?=REASON:|$)/s);
    const reasonMatch = text.match(/REASON:\s*(.+?)$/s);

    if (compMatch) comparison = compMatch[1].trim();
    if (winMatch) winner = winMatch[1].trim();
    if (reasonMatch) reason = reasonMatch[1].trim();

    // Fallback: if structured parsing fails, show raw text
    if (!winner) {
        verdictContent.innerHTML = `
            <div class="card-glass verdict-card">
                <div class="verdict-text">${text.replace(/\n/g, '<br>')}</div>
            </div>
        `;
        return;
    }

    verdictContent.innerHTML = `
        <div class="verdict-card card-glass">
            <div class="verdict-comparison">
                <p>${comparison}</p>
            </div>

            <div class="verdict-winner-section">
                <div class="trophy-icon">🏆</div>
                <div class="winner-name">${winner}</div>
                <div class="winner-reason">${reason}</div>
            </div>
        </div>
    `;
}

// ─── Utilities ─────────────────────────────────────────
function scoreWeather(data) {
    let score = 5;
    const temp = data.main.temp;
    const hum = data.main.humidity;

    if (temp >= 18 && temp <= 26) score += 3;
    else if (temp >= 10 && temp < 18) score += 1;
    else if (temp > 26 && temp <= 32) score += 1;

    if (hum >= 30 && hum <= 60) score += 2;
    if (temp > 35 || temp < 0) score -= 3;
    if (hum > 80) score -= 1;
    if (data.weather[0].main.match(/Rain|Snow|Thunder/)) score -= 2;

    return Math.min(10, Math.max(0, score));
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function showError(msg) {
    compareError.textContent = msg;
    compareError.classList.remove('hidden');
}

function hideError() {
    compareError.classList.add('hidden');
}
