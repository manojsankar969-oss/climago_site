# Climago | Luxury Weather

A premium weather application that provides real-time insights, smart advice, and local tourist attractions using the OpenWeather and Overpass APIs.

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- API Keys:
    - **OpenWeather API Key**: [Get it here](https://openweathermap.org/api)
    - **Google Gemini API Key**: (Optional, for AI summaries) [Get it here](https://aistudio.google.com/)

### Installation
1. Clone the repository or download the source code.
2. Install the necessary dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables:
   - Create a file named `.env` in the root directory.
   - Add your API keys to the `.env` file:
     ```env
     OPENWEATHER_API_KEY=your_openweather_key_here
     GOOGLE_API_KEY=your_gemini_key_here
     PORT=3000
     ```

### Running the App
1. Start the backend server:
   ```bash
   npm start
   ```
2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## ✨ Features
- **Luxury UI**: Glassmorphic design with premium typography.
- **Smart Comfort Score**: A unique 0-10 metric based on temperature, humidity, and wind.
- **Tourist Highlights**: Shows popular nearby attractions using the Overpass API.
- **Daily Narrative**: A breakdown of the day into Morning, Afternoon, Evening, and Night.
- **AQI & UV Index**: Real-time environmental monitoring.
- **AI Insights**: Professional-grade weather summaries powered by Gemini 1.5 Flash.

## 🛠️ Tech Stack
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express
- **APIs**: OpenWeather (Weather, Forecast, AQI, UV), Overpass (Tourist Points), Google Gemini (AI Summaries)

## 📄 License
MIT License - Feel free to use and modify for your own projects!

