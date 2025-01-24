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
        // Convert playerId to string
        const playerIdString = String(playerId);
    
        const url = 'https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=batter&year=2024&position=&team=&filterType=bip&min=50&csv=true';
        const response = await axios.get(url);
        let records = Papa.parse(response.data, { header: true, skipEmptyLines: true }).data;
    
        console.log('Fetched Statcast Records:', records); // Debugging: Log the entire dataset
    
        // Find the specific player by ID
        const playerStats = records.find(player => player.player_id === playerIdString);
        if (!playerStats) {
            console.error(`No stats found for player ID: ${playerIdString}`);
            console.error('Available Player IDs:', records.map(player => player.player_id)); // Debugging: Log all available player IDs
            return null; // Return null if no stats found
        }
    
        // Parse all required stats, defaulting to 0 if not available
        const ba = parseFloat(playerStats.ba) || 0;           // Batting Average
        const est_ba = parseFloat(playerStats.est_ba) || 0;   // Expected BA
        const slg = parseFloat(playerStats.slg) || 0;         // Slugging
        const est_slg = parseFloat(playerStats.est_slg) || 0; // Expected SLG
        const est_woba = parseFloat(playerStats.est_woba) || 0; // Expected wOBA
    
        // Calculate Statcast Score using actual and expected stats
        const StatcastScore = (
            (ba * this.settings.HBAFactor) +              // Actual BA
            (est_ba * this.settings.HEstBAFactor) +       // Expected BA
            (slg * this.settings.HSLGFactor) +            // Actual SLG
            (est_slg * this.settings.HEstSLGFactor) +     // Expected SLG
            (est_woba * this.settings.HEstWOBARactor)     // Expected wOBA
        ) * this.settings.HStatcastWeight;              // Apply overall weight
    
        playerStats.score = StatcastScore; // Add the score to the player object
    
        return playerStats; // Return the specific player's stats
    }
    
    async fetchPitcherStatcast(playerId) {
        const url = 'https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=pitcher&year=2024&position=&team=&min=1&csv=true';
        const response = await axios.get(url);
        let records = Papa.parse(response.data, { header: true, skipEmptyLines: true }).data;
    
        // Find the specific player by ID
        const playerStats = records.find(player => player.player_id === playerId);
        if (!playerStats) {
            console.error(`No stats found for player ID: ${playerId}`);
            return null; // Return null if no stats found
        }
    
        // Parse all required stats, defaulting to 0 if not available
        const est_ba = parseFloat(playerStats.est_ba) || 0;     // Expected BA
        const slg = parseFloat(playerStats.slg) || 0;           // Actual SLG
        const est_slg = parseFloat(playerStats.est_slg) || 0;   // Expected SLG
        const woba = parseFloat(playerStats.woba) || 0;         // Actual wOBA
        const est_woba = parseFloat(playerStats.est_woba) || 0; // Expected wOBA
        const xera = parseFloat(playerStats.xera) || 0;         // Expected ERA
    
        // Calculate Statcast penalty (higher values are worse for pitchers)
        const StatcastPenalty = (
            (est_ba * this.settings.PEstBAFactor) +        // Expected BA
            (slg * this.settings.PSLGFactor) +             // Actual SLG
            (est_slg * this.settings.PEstSLGFactor) +      // Expected SLG
            (woba * this.settings.PWOBFactor) +            // Actual wOBA
            (est_woba * this.settings.PEstWOBAFactor) +    // Expected wOBA
            (xera * this.settings.PXERAFactor)             // Expected ERA
        ) * this.settings.PStatcastWeight;               // Apply overall weight
    
        playerStats.score = StatcastPenalty; // Add the score to the player object
    
        return playerStats; // Return the specific player's stats
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
    
            // Load data from multiple sources in parallel
            const [tank01Data, hfsData, pfsData] = await Promise.all([
                Tank01API.getPlayerInfo(playerName || playerId),
                fetch('/api/hfs').then(r => r.json()).catch(() => null),
                fetch('/api/pfs').then(r => r.json()).catch(() => null)
            ]);
    
            if (!tank01Data || !tank01Data.body || !tank01Data.body[0]) {
                throw new Error('No player data found');
            }
    
            // Extract mlbID from tank01Data
            const mlbID = tank01Data.body[0].mlbID;
    
            // Find player in HFS/PFS data
            const hfsPlayer = hfsData ? hfsData.find(p => p.playerid === playerId) : null;
            const pfsPlayer = pfsData ? pfsData.find(p => p.playerid === playerId) : null;
    
            // Combine all data sources
            this.playerData = {
                ...tank01Data.body[0],
                hfsData: hfsPlayer,
                pfsData: pfsPlayer
            };
    
            console.log('Player Data:', this.playerData); // Debug log
    
            // Check if the player is a hitter or pitcher and fetch Statcast data
            let statcastData;
            let isPitcher = !!this.playerData.pfsData; // Determine if the player is a pitcher
            if (this.playerData.hfsData) {
                // Player is a hitter
                statcastData = await this.fetchHitterStatcast(mlbID);
                console.log('Hitter Statcast Data:', statcastData);
            } else if (isPitcher) {
                // Player is a pitcher
                statcastData = await this.fetchPitcherStatcast(mlbID);
                console.log('Pitcher Statcast Data:', statcastData);
            } else {
                console.log('Player position not recognized.');
            }
    
            // Update the underlying metrics section with the fetched stats
            if (statcastData) {
                this.updateUnderlyingMetricsSection(statcastData, isPitcher);
            }
    
            this.updateUI();
            this.updateProjectionsSection(); // Load projections data directly from tank01Data
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
    
        // Define the keys and display names based on whether the player is a pitcher
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
    
        // Initialize HTML content
        let content = `<h3 class="section-title">Underlying Metrics</h3><div class="metrics-content">`;
    
        // Add only the specified stats to the content
        keysToDisplay.forEach(({ key, displayName }) => {
            const value = stats[key] || 'N/A'; // Use 'N/A' if the value is missing
            content += `
                <div class="metric-card">
                    <span class="metric-key">${displayName}</span>
                    <span class="metric-value">${value}</span>
                </div>
            `;
        });
    
        content += `</div>`;
        underlyingMetricsSection.innerHTML = content; // Update the section with the constructed content
    }

    async loadStatcastData(playerId) {
        try {
            // Construct the Statcast URL
            const statcastUrl = `https://baseballsavant.mlb.com/savant-player/${playerId}`;
            const response = await fetch(statcastUrl);
            const text = await response.text();

            // Parse the HTML to extract the relevant stats
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');

            // Extract relevant stats based on whether the player is a hitter or pitcher
            const isPitcher = !!this.playerData.pfsData; // Check if the player is a pitcher
            let stats = {};

            if (isPitcher) {
                // Extract pitcher stats
                stats = {
                    IP: this.extractStat(doc, 'IP'),
                    W: this.extractStat(doc, 'W'),
                    L: this.extractStat(doc, 'L'),
                    S: this.extractStat(doc, 'S'),
                    Holds: this.extractStat(doc, 'Holds'),
                    SO: this.extractStat(doc, 'SO'),
                    Hits: this.extractStat(doc, 'Hits'),
                    BB: this.extractStat(doc, 'BB'),
                    ER: this.extractStat(doc, 'ER')
                };
            } else {
                // Extract hitter stats
                stats = {
                    PA: this.extractStat(doc, 'PA'),
                    AVG: this.extractStat(doc, 'AVG'),
                    H: this.extractStat(doc, 'H'),
                    BB: this.extractStat(doc, 'BB'),
                    HR: this.extractStat(doc, 'HR'),
                    R: this.extractStat(doc, 'R'),
                    RBI: this.extractStat(doc, 'RBI'),
                    SB: this.extractStat(doc, 'SB'),
                    OPS: this.extractStat(doc, 'OPS')
                };
            }

            // Log the extracted stats to the console
            console.log('Extracted Statcast Stats:', stats);

            // Update the projections section with the fetched stats
            this.updateProjectionsSection(stats, isPitcher);
        } catch (error) {
            console.error('Error loading Statcast data:', error);
            this.handleError(error);
        }
    }



    extractStat(doc, statName) {
        // Define the selectors for each stat
        const selectors = {
            IP: 'td[data-stat="innings_pitched"]', // Replace with actual selector
            W: 'td[data-stat="wins"]', // Replace with actual selector
            L: 'td[data-stat="losses"]', // Replace with actual selector
            S: 'td[data-stat="saves"]', // Replace with actual selector
            Holds: 'td[data-stat="holds"]', // Replace with actual selector
            SO: 'td[data-stat="strikeouts"]', // Replace with actual selector
            Hits: 'td[data-stat="hits"]', // Replace with actual selector
            BB: 'td[data-stat="walks"]', // Replace with actual selector
            ER: 'td[data-stat="earned_runs"]', // Replace with actual selector
            PA: 'td[data-stat="plate_appearances"]', // Replace with actual selector
            AVG: 'td[data-stat="batting_average"]', // Replace with actual selector
            H: 'td[data-stat="hits"]', // Replace with actual selector
            HR: 'td[data-stat="home_runs"]', // Replace with actual selector
            R: 'td[data-stat="runs"]', // Replace with actual selector
            RBI: 'td[data-stat="runs_batted_in"]', // Replace with actual selector
            SB: 'td[data-stat="stolen_bases"]', // Replace with actual selector
            OPS: 'td[data-stat="on_base_plus_slugging"]' // Replace with actual selector
        };

        const statElement = doc.querySelector(selectors[statName]);
        return statElement ? statElement.textContent.trim() : 'N/A';
    }

    updateProjectionsSection() {
        const projectionsSection = document.getElementById('projectionsSection');
        if (!projectionsSection) return;

        // Access hitting and pitching stats directly from playerData
        const hittingStats = this.playerData.stats.Hitting || {};
        const pitchingStats = this.playerData.stats.Pitching || {};

        // Initialize HTML content
        let content = `<h3 class="section-title">Projections</h3><div class="projections-content">`;

        // Check for hitting stats
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

        // Check for pitching stats
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
            <button class="toggle-button" onclick="toggleSection('projectionsSection')">Collapse</button>
        </div>`;

        // Update the projections section with the constructed content
        projectionsSection.innerHTML = content;

        // Render graphs
        this.renderProjectionsGraph(hittingStats, pitchingStats);
        this.renderTrendGraph(hittingStats, pitchingStats);
    }

    renderProjectionsGraph(hittingStats, pitchingStats) {
        const ctx = document.getElementById('projectionsChart').getContext('2d');
        
        // Destroy existing chart if it exists
        if (this.projectionsChart) {
            this.projectionsChart.destroy();
        }

        const hittingLabels = Object.keys(hittingStats);
        const hittingValues = Object.values(hittingStats).map(value => typeof value === 'string' ? parseFloat(value) : value);

        // Prepare data for pitching stats if available
        const pitchingLabels = Object.keys(pitchingStats);
        const pitchingValues = Object.values(pitchingStats).map(value => typeof value === 'string' ? parseFloat(value) : value);

        // Combine hitting and pitching data for the graph
        const combinedLabels = [...hittingLabels, ...pitchingLabels];
        const combinedValues = [...hittingValues, ...pitchingValues];

        // Create datasets for hitting and pitching
        const datasets = [];
        if (hittingValues.length > 0) {
            datasets.push({
                label: 'Hitter Stats',
                data: hittingValues,
                backgroundColor: 'rgba(75, 192, 192, 0.2)', // Light teal for hitting
                borderColor: 'rgba(75, 192, 192, 1)', // Dark teal for hitting
                borderWidth: 1,
                type: 'bar'
            });
        }
        if (pitchingValues.length > 0) {
            datasets.push({
                label: 'Pitcher Stats',
                data: pitchingValues,
                backgroundColor: 'rgba(255, 99, 132, 0.2)', // Light pink for pitching
                borderColor: 'rgba(255, 99, 132, 1)', // Dark pink for pitching
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

        // Prepare data for hitting trends
        const hittingLabels = Object.keys(hittingStats);
        const hittingValues = Object.values(hittingStats).map(value => typeof value === 'string' ? parseFloat(value) : value);

        // Prepare data for pitching trends
        const pitchingLabels = Object.keys(pitchingStats);
        const pitchingValues = Object.values(pitchingStats).map(value => typeof value === 'string' ? parseFloat(value) : value);

        // Create datasets for hitting and pitching trends
        const datasets = [];
        if (hittingValues.length > 0) {
            datasets.push({
                label: 'Hitter Trends',
                data: hittingValues,
                fill: false,
                borderColor: 'rgba(75, 192, 192, 1)', // Dark teal for hitting trends
                tension: 0.1
            });
        }
        if (pitchingValues.length > 0) {
            datasets.push({
                label: 'Pitcher Trends',
                data: pitchingValues,
                fill: false,
                borderColor: 'rgba(255, 99, 132, 1)', // Dark pink for pitching trends
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

        // Update name and jersey number
        document.getElementById('playerName').textContent = data.longName || data.fullName || 'N/A';
        document.getElementById('playerNumber').textContent = data.jerseyNum ? `#${data.jerseyNum}` : '#00';

        // Remove empty divs
        this.removeEmptyDivs();

        // Update info cards values
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

        // Update player image
        this.updatePlayerImage();

        // Update other sections
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
            // Create the Statcast Profile link by replacing the base URL
            const statcastLink = this.playerData.mlbLink
                ? this.playerData.mlbLink.replace('https://www.mlb.com/player/', 'https://baseballsavant.mlb.com/savant-player/')
                : '#'; // Fallback if mlbLink is not available
    
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

// Section toggle function
function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;

    const content = section.querySelector('.projections-content') || section.querySelector('.underlying-metrics-content');
    const button = section.querySelector('.toggle-button');

    if (content.style.display === 'none') {
        content.style.display = 'block';
        button.textContent = 'Collapse';
    } else {
        content.style.display = 'none';
        button.textContent = 'Expand';
    }
}