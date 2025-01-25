class PlayerProfile {
    constructor() {
        this.playerData = null;
        this.projectionsChart = null;
        this.trendChart = null;
        this.loadingOverlay = this.createLoadingOverlay();
        document.body.appendChild(this.loadingOverlay);

        this.settings = {
            RWeight: 1,
            HRWeight: 3,
            HWeight: 1,
            SBWeight: 1,
            BBWeight: 1,
            RBIWeight: 1,
            KWeight: 1,
            HFGFactor: 1,
            HBAFactor: 130,
            HEstBAFactor: 260,
            HSLGFactor: 80,
            HEstSLGFactor: 180,
            HEstWOBARactor: 150,
            HStatcastWeight: 0.8,
            HFGWeight: 1,
            HPAFactor: 0.08,
            HKpctFactor: 100,
            HBABIPFactor: 80,
            HwOBAFactor: 100,
            HOPSFactor: 60,
            HSpdFactor: 4,
            HSoftWeight: 1,

            PSVWeight: 5,
            PWWeight: 5,
            PSOWeight: 1,
            PIPWeight: 3,
            PHWeight: 1,
            PLWeight: 5,
            PERWeight: 2,
            PBBWeight: 1,
            PHoldWeight: 0,
            PFGFactor: 2,
            PERAFactor: 13,
            PWHIPFactor: 40,
            PAVGFactor: 250,
            PTBFFactor: 0.03,
            PK9Factor: 6,
            PBB9Factor: 12,
            PHR9Factor: 30,
            PFGWeight: 2,

            PEstBAFactor: 260,
            PSLGFactor: 40,
            PEstSLGFactor: 80,
            PWOBFactor: 50,
            PEstWOBAFactor: 120,
            PXERAFactor: 10,
            PStatcastWeight: 1
        };
    }

    createLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading Player Data...</div>
        `;
        overlay.style.display = 'none';
        return overlay;
    }

    showLoading() {
        this.loadingOverlay.style.display = 'flex';
    }

    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }

    async fetchHitterStatcast(playerId) {
        const playerIdString = String(playerId);
        const url = 'https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=batter&year=2024&position=&team=&filterType=bip&min=50&csv=true';

        try {
            const response = await axios.get(url);
            if (response.status !== 200) {
                throw new Error(`Failed to fetch data: ${response.statusText}`);
            }
            let records = Papa.parse(response.data, { header: true, skipEmptyLines: true }).data;

            const playerStats = records.find(player => player.player_id === playerIdString);
            if (!playerStats) {
                console.error(`No stats found for player ID: ${playerIdString}`);
                console.error('Available Player IDs:', records.map(player => player.player_id));
                return null;
            }

            // Parse all required stats, defaulting to 0 if not available
            const ba = parseFloat(playerStats.ba) || 0;
            const est_ba = parseFloat(playerStats.est_ba) || 0;
            const slg = parseFloat(playerStats.slg) || 0;
            const est_slg = parseFloat(playerStats.est_slg) || 0;
            const est_woba = parseFloat(playerStats.est_woba) || 0;

            const StatcastScore = (
                (ba * this.settings.HBAFactor) +
                (est_ba * this.settings.HEstBAFactor) +
                (slg * this.settings.HSLGFactor) +
                (est_slg * this.settings.HEstSLGFactor) +
                (est_woba * this.settings.HEstWOBARactor)
            ) * this.settings.HStatcastWeight;

            playerStats.score = StatcastScore;
            return playerStats;
        } catch (error) {
            console.error('Error fetching hitter Statcast data:', error);
            this.handleError(error);
            return null; // Return null if an error occurs
        }
    }

    async fetchPitcherStatcast(playerId) {
        const url = 'https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=pitcher&year=2024&position=&team=&min=1&csv=true';

        try {
            const response = await axios.get(url);
            if (response.status !== 200) {
                throw new Error(`Failed to fetch data: ${response.statusText}`);
            }
            let records = Papa.parse(response.data, { header: true, skipEmptyLines: true }).data;

            const playerStats = records.find(player => player.player_id === playerId);
            if (!playerStats) {
                console.error(`No stats found for player ID: ${playerId}`);
                return null;
            }

            const est_ba = parseFloat(playerStats.est_ba) || 0;
            const slg = parseFloat(playerStats.slg) || 0;
            const est_slg = parseFloat(playerStats.est_slg) || 0;
            const woba = parseFloat(playerStats.woba) || 0;
            const est_woba = parseFloat(playerStats.est_woba) || 0;
            const xera = parseFloat(playerStats.xera) || 0;

            const StatcastPenalty = (
                (est_ba * this.settings.PEstBAFactor) +
                (slg * this.settings.PSLGFactor) +
                (est_slg * this.settings.PEstSLGFactor) +
                (woba * this.settings.PWOBFactor) +
                (est_woba * this.settings.PEstWOBAFactor) +
                (xera * this.settings.PXERAFactor)
            ) * this.settings.PStatcastWeight;

            playerStats.score = StatcastPenalty;
            return playerStats;
        } catch (error) {
            console.error('Error fetching pitcher Statcast data:', error);
            this.handleError(error);
            return null; // Return null if an error occurs
        }
    }

    async loadPlayerProfile() {
        this.showLoading();
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const playerName = urlParams.get('name');
            const playerId = urlParams.get('id');

            if (!playerName && !playerId) {
                throw new Error('No player name or ID provided');
            }

            const [tank01Data, hfsData, pfsData] = await Promise.all([
                Tank01API.getPlayerInfo(playerName || playerId),
                fetch('/api/hfs').then(r => r.json()).catch(() => null),
                fetch('/api/pfs').then(r => r.json()).catch(() => null)
            ]);

            if (!tank01Data || !tank01Data.body || !tank01Data.body[0]) {
                throw new Error('No player data found');
            }

            const mlbID = tank01Data.body[0].mlbID;
            const hfsPlayer = hfsData ? hfsData.find(p => p.playerid === playerId) : null;
            const pfsPlayer = pfsData ? pfsData.find(p => p.playerid === playerId) : null;

            this.playerData = {
                ...tank01Data.body[0],
                hfsData: hfsPlayer,
                pfsData: pfsPlayer
            };

            let statcastData;
            let isPitcher = !!this.playerData.pfsData;
            if (this.playerData.hfsData) {
                statcastData = await this.fetchHitterStatcast(mlbID);
            } else if (isPitcher) {
                statcastData = await this.fetchPitcherStatcast(mlbID);
            } else {
                console.log('Player position not recognized.');
            }

            if (statcastData) {
                this.updateUnderlyingMetricsSection(statcastData, isPitcher);
            }

            this.updateUI();
            this.updateProjectionsSection();
        } catch (error) {
            console.error('Error loading player profile:', error);
            this.handleError(error);
        } finally {
            this.hideLoading();
        }
    }

    updateUnderlyingMetricsSection(stats, isPitcher = false) {
        const underlyingMetricsSection = document.getElementById('underlyingMetricsSection');
        if (!underlyingMetricsSection) return;

        const keysToDisplay = isPitcher
            ? [
                { key: 'est_ba', displayName: 'xBA' },
                { key: 'est_slg', displayName: 'xSLG' },
                { key: 'est_woba', displayName: 'xwOBA' },
                { key: 'xera', displayName: 'xERA' },
                { key: 'score', displayName: 'Score' }
            ]
            : [
                { key: 'est_ba', displayName: 'xBA' },
                { key: 'est_slg', displayName: 'xSLG' },
                { key: 'est_woba', displayName: 'xwOBA' },
                { key: 'score', displayName: 'Score' }
            ];

        let content = `<h3 class="section-title">Underlying Metrics</h3><div class="metrics-content">`;

        keysToDisplay.forEach(({ key, displayName }) => {
            const value = stats[key] || 'N/A';
            content += `
                <div class="metric-card">
                    <span class="metric-key">${displayName}</span>
                    <span class="metric-value">${value}</span>
                </div>
            `;
        });

        content += `</div>`;
        underlyingMetricsSection.innerHTML = content;
    }

    updateProjectionsSection() {
        const projectionsSection = document.getElementById('projectionsSection');
        if (!projectionsSection) return;

        const hittingStats = this.playerData.stats.Hitting || {};
        const pitchingStats = this.playerData.stats.Pitching || {};

        let content = `<h3 class="section-title">Projections</h3><div class="projections-content">`;

        if (Object.keys(hittingStats).length > 0) {
            content += `<h4>Hitter Projections</h4><div class="stats-cards">`;
            Object.entries(hittingStats).forEach(([key, value]) => {
                content += `
                    <div class="projection-card">
                        <span class="stat-key">${key}</span>
                        <span class="stat-value">${value || 'N/A'}</span>
                    </div>
                `;
            });
            content += `</div>`;
        } else {
            content += `<p>No hitting projection data available</p>`;
        }

        if (Object.keys(pitchingStats).length > 0) {
            content += `<h4>Pitcher Projections</h4><div class="stats-cards">`;
            Object.entries(pitchingStats).forEach(([key, value]) => {
                content += `
                    <div class="projection-card">
                        <span class="stat-key">${key}</span>
                        <span class="stat-value">${value || 'N/A'}</span>
                    </div>
                `;
            });
            content += `</div>`;
        } else {
            content += `<p>No pitching projection data available</p>`;
        }

        content += `
            <div class="graphs-container">
                <canvas id="projectionsChart"></canvas>
                <canvas id="trendChart"></canvas>
            </div>
        </div>`;

        projectionsSection.innerHTML = content;

        this.renderProjectionsGraph(hittingStats, pitchingStats);
        this.renderTrendGraph(hittingStats, pitchingStats);
    }

    renderProjectionsGraph(hittingStats, pitchingStats) {
        const ctx = document.getElementById('projectionsChart').getContext('2d');
        
        if (this.projectionsChart) {
            this.projectionsChart.destroy();
        }

        const hittingLabels = Object.keys(hittingStats);
        const hittingValues = Object.values(hittingStats).map(value => typeof value === 'string' ? parseFloat(value) : value);

        const pitchingLabels = Object.keys(pitchingStats);
        const pitchingValues = Object.values(pitchingStats).map(value => typeof value === 'string' ? parseFloat(value) : value);

        const combinedLabels = [...hittingLabels, ...pitchingLabels];
        const combinedValues = [...hittingValues, ...pitchingValues];

        const datasets = [];
        if (hittingValues.length > 0) {
            datasets.push({
                label: 'Hitter Stats',
                data: hittingValues,
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1,
                type: 'bar'
            });
        }
        if (pitchingValues.length > 0) {
            datasets.push({
                label: 'Pitcher Stats',
                data: pitchingValues,
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1,
                type: 'bar'
            });
        }

        this.projectionsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: combinedLabels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Projections'
                    },
                    legend: {
                        display: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#fff'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#fff'
                        }
                    }
                }
            }
        });
    }

    renderTrendGraph(hittingStats, pitchingStats) {
        const ctx = document.getElementById('trendChart').getContext('2d');
        
        if (this.trendChart) {
            this.trendChart.destroy();
        }

        const hittingLabels = Object.keys(hittingStats);
        const hittingValues = Object.values(hittingStats).map(value => typeof value === 'string' ? parseFloat(value) : value);

        const pitchingLabels = Object.keys(pitchingStats);
        const pitchingValues = Object.values(pitchingStats).map(value => typeof value === 'string' ? parseFloat(value) : value);

        const datasets = [];
        if (hittingValues.length > 0) {
            datasets.push({
                label: 'Hitter Trends',
                data: hittingValues,
                fill: false,
                borderColor: 'rgba(75, 192, 192, 1)',
                tension: 0.1
            });
        }
        if (pitchingValues.length > 0) {
            datasets.push({
                label: 'Pitcher Trends',
                data: pitchingValues,
                fill: false,
                borderColor: 'rgba(255, 99, 132, 1)',
                tension: 0.1
            });
        }

        this.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [...hittingLabels, ...pitchingLabels],
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Trends'
                    },
                    legend: {
                        display: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#fff'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#fff'
                        }
                    }
                }
            }
        });
    }

    updateUI() {
        const data = this.playerData;

        document.getElementById('playerName').textContent = data.longName || data.fullName || 'N/A';
        document.getElementById('playerNumber').textContent = data.jerseyNum ? `#${data.jerseyNum}` : '#00';

        this.removeEmptyDivs();

        const infoCards = document.querySelectorAll('.info-card');
        infoCards.forEach(card => {
            const label = card.querySelector('.label').textContent.toLowerCase();
            const valueElement = card.querySelector('.value');

            switch (label) {
                case 'position':
                    valueElement.textContent = data.pos || 'N/A';
                    break;
                case 'team':
                    valueElement.textContent = data.team || 'N/A';
                    break;
                case 'bats/throws':
                    valueElement.textContent = `${data.bat || 'N/A'}/${data.throw || 'N/A'}`;
                    break;
                case 'height/weight':
                    valueElement.textContent = `${data.height || 'N/A'}, ${data.weight || 'N/A'}lb`;
                    break;
                case 'born':
                    valueElement.textContent = data.bDay || 'N/A';
                    break;
            }
        });

        this.updatePlayerImage();
        this.updateLinksSection();
        this.updateProjectionsSection();
    }

    updatePlayerImage() {
        const playerImage = document.getElementById('playerImage');
        if (playerImage) {
            playerImage.style.opacity = '0.5';
            const newImage = new Image();
            newImage.onload = () => {
                playerImage.src = newImage.src;
                playerImage.style.opacity = '1';
            };
            newImage.onerror = () => {
                playerImage.src = 'https://cdn-icons-png.flaticon.com/512/166/166366.png';
                playerImage.style.opacity = '1';
            };
            newImage.src = this.playerData.mlbHeadshot || 
                          this.playerData.espnHeadshot || 
                          'https://cdn-icons-png.flaticon.com/512/166/166366.png';
        }
    }

    updateLinksSection() {
        const linksSection = document.getElementById('playerLinks');
        if (linksSection) {
            const statcastLink = this.playerData.mlbLink
                ? this.playerData.mlbLink.replace('https://www.mlb.com/player/', 'https://baseballsavant.mlb.com/savant-player/')
                : '#';

            linksSection.innerHTML = `
                <h3 style="color: #00FF00; margin-bottom: 15px;">External Links</h3>
                <div class="player-links">
                    ${this.playerData.mlbLink ? `<a href="${this.playerData.mlbLink}" target="_blank" class="btn-primary">MLB Profile</a>` : ''}
                    ${this.playerData.espnLink ? `<a href="${this.playerData.espnLink}" target="_blank" class="btn-primary">ESPN Profile</a>` : ''}
                    ${this.playerData.yahooLink ? `<a href="${this.playerData.yahooLink}" target="_blank" class="btn-primary">Yahoo Profile</a>` : ''}
                    <a href="${statcastLink}" target="_blank" class="btn-primary">Statcast Profile</a>
                </div>
            `;
        }
    }

    removeEmptyDivs() {
        const emptyDivs = document.querySelectorAll('.content-wrapper > div:empty');
        emptyDivs.forEach(div => div.remove());
    }

    handleError(error) {
        const errorContainer = document.getElementById('errorContainer');
        if (errorContainer) {
            errorContainer.innerHTML = `
                <div class="alert-danger">
                    <h4 style="color: #FF0000; margin: 0 0 10px 0;">Error Loading Player Profile</h4>
                    <p style="margin: 0;">${error.message}</p>
                </div>
            `;
        }
    }
}

// Initialize the player profile when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const profile = new PlayerProfile();
    profile.loadPlayerProfile();
});

// Global error handling
window.onerror = function (msg, url, lineNo, columnNo, error) {
    console.error('Global error:', { msg, url, lineNo, columnNo, error });
    const profile = new PlayerProfile();
    profile.handleError(error || new Error(msg));
    return false;
};