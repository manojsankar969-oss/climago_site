// ─── Environment Setup ──────────────────────────────────────────────
// Load environment variables from .env file for secure API key management
require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json()); // Enable JSON body parsing for POST requests
app.use(express.static(path.join(__dirname))); // Serve static frontend files (HTML, CSS, JS)

// ─── API Keys ────────────────────────────────────────────────────────
// Securely loaded from process.env to prevent exposure in client-side code
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY; // For general AI features (Travel Advisor, Compare)
// const GOOGLE_AI_SUMMARY_KEY = process.env.GOOGLE_AI_SUMMARY_KEY; // REMOVED: Using single key
const WEATHER_API_KEY = process.env.OPENWEATHER_API_KEY; // For OpenWeatherMap data

// ─── Firebase Configuration Endpoint ─────────────────────────────────
// Sends Firebase config to client-side without hardcoding secrets in HTML/JS
app.get('/api/firebase-config', (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
  });
});

// ─── Weather Data Proxy ──────────────────────────────────────────────
// Fetches current weather data from OpenWeatherMap
// Hides API key from client by acting as a middleman
app.get('/api/weather', async (req, res) => {
  const { city, lat, lon } = req.query;
  if (!WEATHER_API_KEY) return res.status(500).json({ error: 'Weather API key missing' });

  let url = '';
  // Construct URL based on either city name or coordinates
  if (city) {
    url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${WEATHER_API_KEY}`;
  } else if (lat && lon) {
    url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${WEATHER_API_KEY}`;
  } else {
    return res.status(400).json({ error: 'City or coordinates required' });
  }

  try {
    const response = await fetch(url);
    const data = await response.json();
    // Forward upstream status code if error
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Weather API error' });
  }
});

// ─── Forecast Proxy ──────────────────────────────────────────────────
// Fetches 5-day forecast data
app.get('/api/forecast', async (req, res) => {
  const { city } = req.query;
  if (!city) return res.status(400).json({ error: 'City is required' });

  const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&units=metric&appid=${WEATHER_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Forecast API error' });
  }
});

// ─── Air Quality Proxy ───────────────────────────────────────────────
// Fetches AQI data based on coordinates
app.get('/api/aqi', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'Coordinates required' });

  const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'AQI API error' });
  }
});

// ─── City Search Proxy ───────────────────────────────────────────────
// Provides city suggestions (geocoding) for autocomplete
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });

  const url = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=5&appid=${WEATHER_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Search API error' });
  }
});

// ─── UV Index Proxy ──────────────────────────────────────────────────
// Fetches UV index (tries OneCall 3.0, falls back if needed)
app.get('/api/uv', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'Coords required' });

  // Using OneCall API to get UV data
  const url = `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly,daily,alerts&units=metric&appid=${WEATHER_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'UV API error' });
  }
});

// ─── Overpass API Helper (Tourism Data) ──────────────────────────────
// Fetches nearby tourist attractions (museums, parks, castles) using OpenStreetMap data via Overpass API
async function fetchAttributes(lat, lon) {
  // Query looks for nodes/ways tagged with tourism, historic, or leisure within 10km
  const query = `
    [out:json][timeout:25];
    (
      node["tourism"~"attraction|museum|viewpoint|gallery|theme_park|zoo"](around:10000,${lat},${lon});
      way["tourism"~"attraction|museum|viewpoint|gallery|theme_park|zoo"](around:10000,${lat},${lon});
      node["historic"~"monument|castle|ruins"](around:10000,${lat},${lon});
      way["historic"~"monument|castle|ruins"](around:10000,${lat},${lon});
      node["leisure"="park"](around:10000,${lat},${lon});
    );
    out center 15;
    `;

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query
    });

    if (!response.ok) throw new Error('Overpass API failed');
    const data = await response.json();

    // Process and filter results to return clean objects
    return data.elements.map(el => {
      const t = el.tags || {};
      const name = t.name || t.description || 'Unknown Landmark';
      const typeRaw = t.tourism || t.historic || t.leisure || 'attraction';

      let type = 'outdoor';
      if (typeRaw.includes('museum') || typeRaw.includes('gallery') || typeRaw.includes('theatre')) type = 'indoor';

      const pLat = el.lat || (el.center && el.center.lat);
      const pLon = el.lon || (el.center && el.center.lon);

      // Calculate distance from user's city center
      let dist = 0;
      if (pLat && pLon) {
        dist = getDistanceFromLatLonInKm(lat, lon, pLat, pLon);
      }

      return {
        name: name,
        type: type,
        desc: capitalize(typeRaw.replace(/_/g, ' ')),
        dist: dist ? dist.toFixed(1) : null
      };
    }).filter(p => p.name !== 'Unknown Landmark').slice(0, 6); // Limit to 6 results
  } catch (e) {
    console.error('Overpass Error:', e.message);
    return [];
  }
}

// ─── Helper: Haversine Distance Calculation ──────────────────────────
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
    ;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180)
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── AI Integration (Gemini 2.0 Flash) ───────────────────────────────

// Helper to call Google Gemini API
async function callGemini(prompt, apiKey = GOOGLE_API_KEY) {
  // Graceful fail if no key is present or is a placeholder
  if (!apiKey || apiKey.startsWith('PLACEHOLDER')) {
    throw new Error('AI features disabled (No API Key)');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Gemini API Error');
  }

  // Extract text from Gemini response structure
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No content generated';
}

// Endpoint: AI Weather Summary
// Uses dedicated GOOGLE_AI_SUMMARY_KEY
app.post('/ai', async (req, res) => {
  const prompt = req.body.prompt;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  try {
    // Use the main API key for summaries
    const text = await callGemini(prompt);
    res.json({ reply: text });
  } catch (e) {
    console.error('AI Error:', e.message);
    res.status(500).json({ error: String(e.message) });
  }
});

// ─── AI Response Cache (In-Memory) ───────────────────────────────────
// Caches AI responses for 15 minutes to save API quota and speed up repeated requests
const aiCache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes in milliseconds

function getCached(key) {
  const entry = aiCache.get(key);
  if (!entry) return null;
  // Expire cache if older than TTL
  if (Date.now() - entry.ts > CACHE_TTL) {
    aiCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  aiCache.set(key, { data, ts: Date.now() });
}

// ─── AI Travel Advisor Endpoint ──────────────────────────────────────
// Generates a structured travel guide based on current weather
app.post('/api/travel-advice', async (req, res) => {
  const { city, temp, humidity, wind, condition, airQuality } = req.body;
  if (!city) return res.status(400).json({ error: 'City is required' });

  // Check cache first
  const cacheKey = `travel_${city.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json({ advice: cached });

  const aqiMap = { 1: 'Good', 2: 'Fair', 3: 'Moderate', 4: 'Poor', 5: 'Very Poor' };
  const aqiLabel = aqiMap[airQuality] || 'Unknown';

  // Structured prompt to enforce specific output format for easier client-side parsing
  const prompt = `For the city "${city}" (currently ${temp}°C, ${condition}, AQI: ${aqiLabel}), give me a SHORT travel guide in this exact format:

PLACES:
1. [Place Name] - [One line why to visit, max 12 words]
2. [Place Name] - [One line why to visit, max 12 words]
3. [Place Name] - [One line why to visit, max 12 words]
4. [Place Name] - [One line why to visit, max 12 words]
5. [Place Name] - [One line why to visit, max 12 words]

NEARBY:
1. [Destination] - [Distance, one line description]
2. [Destination] - [Distance, one line description]

WEAR: [One short sentence about what to wear today]

EAT: [One famous local dish to try and where]

ALERT: [One health/safety tip based on current weather, or "None" if conditions are pleasant]

Keep every answer ultra-short. No markdown formatting. No asterisks.`;

  try {
    const text = await callGemini(prompt);
    setCache(cacheKey, text); // Cache the result
    res.json({ advice: text });
  } catch (e) {
    console.error('Travel Advice Error:', e.message);
    res.status(500).json({ error: String(e.message) });
  }
});

// ─── AI Compare Verdict Endpoint ─────────────────────────────────────
// Compares two cities and renders a verdict
app.post('/api/compare-verdict', async (req, res) => {
  const { cityA, cityB } = req.body;
  if (!cityA || !cityB) return res.status(400).json({ error: 'Both cities required' });

  const cacheKey = `compare_${cityA.name.toLowerCase()}_${cityB.name.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json({ verdict: cached });

  const aqiMap = { 1: 'Good', 2: 'Fair', 3: 'Moderate', 4: 'Poor', 5: 'Very Poor' };

  const prompt = `You are a travel decision assistant. Compare the following two cities based on weather, comfort, air quality, and travel suitability. Then clearly recommend which city is better to visit today and why.

City A: ${cityA.name}
- Temperature: ${cityA.temp}°C, Humidity: ${cityA.humidity}%, Wind: ${cityA.wind} m/s
- Condition: ${cityA.condition}
- Air Quality: ${aqiMap[cityA.aqi] || 'Unknown'} (Index: ${cityA.aqi || 'N/A'})

City B: ${cityB.name}
- Temperature: ${cityB.temp}°C, Humidity: ${cityB.humidity}%, Wind: ${cityB.wind} m/s
- Condition: ${cityB.condition}
- Air Quality: ${aqiMap[cityB.aqi] || 'Unknown'} (Index: ${cityB.aqi || 'N/A'})

Provide:
1. Short comparison summary (2-3 sentences)
2. Winner city for travel today
3. One-line reason why

Format your response as:
COMPARISON: [your comparison summary]
WINNER: [city name]
REASON: [one-line reason]`;

  try {
    const text = await callGemini(prompt);
    setCache(cacheKey, text);
    res.json({ verdict: text });
  } catch (e) {
    console.error('Compare Verdict Error:', e.message);
    res.status(500).json({ error: String(e.message) });
  }
});

// ─── Curated Places & Essentials Endpoint ────────────────────────────
// Combines Overpass API data (attractions) with rule-based gear recommendations
app.post('/api/places', async (req, res) => {
  const { city, lat, lon, temp, condition, aqi, uv } = req.body;

  let places = [];
  if (lat && lon) {
    places = await fetchAttributes(lat, lon); // Fetch from Overpass
  }

  // Rule-based Gear Logic (No AI needed, fast and reliable)
  const gear = [];

  if (uv && uv > 5) {
    gear.push({ item: 'Sunscreen', reason: 'High UV index' });
    gear.push({ item: 'Hat/Sunglasses', reason: 'Sun protection' });
  }

  const cond = (condition || '').toLowerCase();
  if (cond.includes('rain') || cond.includes('drizzle') || cond.includes('thunder')) {
    gear.push({ item: 'Umbrella', reason: 'Rain expected' });
  }
  if (cond.includes('snow')) {
    gear.push({ item: 'Boots', reason: 'Snowy conditions' });
  }

  if (temp < 15) gear.push({ item: 'Coat/Jacket', reason: 'Chilly temperatures' });
  else if (temp > 30) gear.push({ item: 'Water Bottle', reason: 'Stay hydrated in heat' });

  // If no specific gear found, add generic recommendation
  if (gear.length === 0) gear.push({ item: 'Comfortable Shoes', reason: 'Good for walking' });

  res.json({ places, gear });
});

// ─── Compare Page Route ──────────────────────────────────────────────
// Serves the dedicated comparison HTML page
app.get('/compare', (req, res) => {
  res.sendFile(path.join(__dirname, 'compare.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Climago server running on http://localhost:${PORT}`));
