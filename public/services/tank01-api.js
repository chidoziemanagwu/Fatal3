// public/services/tank01-api.js

class Tank01API {
    static BASE_URL = 'https://tank01-mlb-live-in-game-real-time-statistics.p.rapidapi.com';
    static API_KEY = 'eda340385emshdd4a114ddde5eeap131c54jsn5425f3315ea1'; // Replace with your actual API key
    static API_HOST = 'tank01-mlb-live-in-game-real-time-statistics.p.rapidapi.com';

    static async getPlayerInfo(playerName, getStats = false, statsSeason = null) {
        try {
            const url = new URL(`${this.BASE_URL}/getMLBPlayerInfo`);
            url.searchParams.append('playerName', playerName);
            url.searchParams.append('getStats', getStats.toString());
            if (statsSeason) {
                url.searchParams.append('statsSeason', statsSeason);
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'x-rapidapi-key': this.API_KEY,
                    'x-rapidapi-host': this.API_HOST
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch player info: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Tank01 API Response:', data); // Debugging log
            return data;
        } catch (error) {
            console.error('Error fetching player info from Tank01 API:', error);
            return null;
        }
    }
}

// Make it available globally
window.Tank01API = Tank01API;