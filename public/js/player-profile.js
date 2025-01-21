// public/js/player-profile.js

async function loadPlayerProfile() {
    try {
        // Get player ID from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const playerId = urlParams.get('id');
        
        console.log('Loading player profile for ID:', playerId);

        if (!playerId) {
            throw new Error('No player ID provided in the URL');
        }

        // Fetch player data
        const response = await fetch(`/api/players/${playerId}`);
        console.log('API Response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch player data');
        }

        const playerData = await response.json();
        console.log('Player data received:', playerData);

        // Update DOM elements
        document.getElementById('playerName').textContent = playerData.name;
        document.getElementById('playerTeam').textContent = playerData.team;
        document.getElementById('playerPosition').textContent = playerData.position;

        // Update current stats
        const currentStatsElement = document.getElementById('currentStats');
        if (playerData.position.includes('P')) {
            // Pitcher stats
            currentStatsElement.innerHTML = `
                <div class="stat-grid">
                    <div class="stat-item">
                        <label>Wins</label>
                        <span>${playerData.currentStats.wins}</span>
                    </div>
                    <div class="stat-item">
                        <label>Saves</label>
                        <span>${playerData.currentStats.saves}</span>
                    </div>
                    <div class="stat-item">
                        <label>Strikeouts</label>
                        <span>${playerData.currentStats.strikeouts}</span>
                    </div>
                    <div class="stat-item">
                        <label>ERA</label>
                        <span>${playerData.currentStats.era}</span>
                    </div>
                    <div class="stat-item">
                        <label>WHIP</label>
                        <span>${playerData.currentStats.whip}</span>
                    </div>
                </div>
            `;
        } else {
            // Hitter stats
            currentStatsElement.innerHTML = `
                <div class="stat-grid">
                    <div class="stat-item">
                        <label>Home Runs</label>
                        <span>${playerData.currentStats.homeRuns}</span>
                    </div>
                    <div class="stat-item">
                        <label>Runs</label>
                        <span>${playerData.currentStats.runs}</span>
                    </div>
                    <div class="stat-item">
                        <label>RBI</label>
                        <span>${playerData.currentStats.rbi}</span>
                    </div>
                    <div class="stat-item">
                        <label>Stolen Bases</label>
                        <span>${playerData.currentStats.stolenBases}</span>
                    </div>
                    <div class="stat-item">
                        <label>AVG</label>
                        <span>${playerData.currentStats.avg}</span>
                    </div>
                </div>
            `;
        }

        // Update metrics
        const advancedStatsElement = document.getElementById('advancedStats');
        advancedStatsElement.innerHTML = `
            <div class="stat-grid">
                <div class="stat-item">
                    <label>FG Score</label>
                    <span>${playerData.metrics.fgScore.toFixed(2)}</span>
                </div>
                <div class="stat-item">
                    <label>Statcast Score</label>
                    <span>${playerData.metrics.statcastScore.toFixed(2)}</span>
                </div>
                <div class="stat-item">
                    <label>Combined Score</label>
                    <span>${playerData.metrics.combinedScore.toFixed(2)}</span>
                </div>
                <div class="stat-item">
                    <label>Rank</label>
                    <span>#${playerData.rank}</span>
                </div>
                <div class="stat-item">
                    <label>Status</label>
                    <span>${playerData.availability}</span>
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error loading player profile:', error);
        const contentWrapper = document.querySelector('.content-wrapper');
        if (contentWrapper) {
            contentWrapper.innerHTML = `
                <div class="error-message">
                    <h2>Error Loading Player Profile</h2>
                    <p>${error.message}</p>
                    <a href="dashboard.html" class="button">Return to Dashboard</a>
                </div>
            `;
        }
    }
}

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', loadPlayerProfile);