class PlayerProfile {
    constructor() {
        this.playerData = null;
        this.projectionsChart = null;
        this.trendChart = null;
        this.loadingOverlay = this.createLoadingOverlay();
        document.body.appendChild(this.loadingOverlay);
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
            this.updateUI();
        } catch (error) {
            console.error('Error loading player profile:', error);
            this.handleError(error);
        } finally {
            this.hideLoading();
        }
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
                case 'last game':
                    valueElement.textContent = data.lastGamePlayed || 'N/A';
                    break;
            }
        });

        // Update player image
        this.updatePlayerImage();

        // Update other sections
        this.updateLinksSection();
        this.updateProjectionsSection();
        this.updateIdsSection();
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
            linksSection.innerHTML = `
                <h3 style="color: #00FF00; margin-bottom: 15px;">External Links</h3>
                <div class="player-links">
                    ${this.playerData.mlbLink ? `<a href="${this.playerData.mlbLink}" target="_blank" class="btn-primary">MLB Profile</a>` : ''}
                    ${this.playerData.espnLink ? `<a href="${this.playerData.espnLink}" target="_blank" class="btn-primary">ESPN Profile</a>` : ''}
                    ${this.playerData.yahooLink ? `<a href="${this.playerData.yahooLink}" target="_blank" class="btn-primary">Yahoo Profile</a>` : ''}
                    ${this.playerData.fantasyProsLink ? `<a href="${this.playerData.fantasyProsLink}" target="_blank" class="btn-primary">FantasyPros Profile</a>` : ''}
                </div>
            `;
        }
    }

    updateProjectionsSection() {
        const projectionsSection = document.getElementById('projectionsSection');
        if (!projectionsSection) return;

        const { hfsData, pfsData } = this.playerData;
        const isPitcher = !!pfsData;
        const playerData = isPitcher ? pfsData : hfsData;

        if (!playerData) {
            projectionsSection.innerHTML = `
                <h3 class="section-title">Projections</h3>
                <div class="projections-content">
                    <p>No projection data available</p>
                </div>
            `;
            return;
        }

        // Filter relevant stats
        const statsData = Object.entries(playerData)
            .filter(([key]) => {
                const excludeFields = ['playerid', 'name', 'Pos', 'team', 'Availability', 'Rank', 'PositionRank'];
                return !excludeFields.includes(key);
            });

        // Update HTML structure
        projectionsSection.innerHTML = `
            <h3 class="section-title">Projections</h3>
            <div class="projections-content">
                <h4>${isPitcher ? 'Pitcher' : 'Hitter'} Projections</h4>
                <div class="stats-cards">
                    ${statsData.map(([key, value]) => `
                        <div class="projection-card">
                            <span class="stat-key">${key}</span>
                            <span class="stat-value">${value}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="graphs-container">
                    <canvas id="projectionsChart"></canvas>
                    <canvas id="trendChart"></canvas>
                </div>
            </div>
            <button class="toggle-button" onclick="toggleSection('projectionsSection')">Collapse</button>
        `;

        // Render graphs
        this.renderProjectionsGraph(statsData, isPitcher);
        this.renderTrendGraph(statsData, isPitcher);
    }
    renderProjectionsGraph(statsData, isPitcher) {
        const ctx = document.getElementById('projectionsChart').getContext('2d');
        
        // Destroy existing chart if it exists
        if (this.projectionsChart) {
            this.projectionsChart.destroy();
        }

        const labels = statsData.map(([key]) => key);
        const values = statsData.map(([_, value]) => typeof value === 'string' ? parseFloat(value) : value);

        this.projectionsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: `${isPitcher ? 'Pitcher' : 'Hitter'} Stats`,
                    data: values,
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `${isPitcher ? 'Pitcher' : 'Hitter'} Projections`
                    },
                    legend: {
                        display: false
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

    renderTrendGraph(statsData, isPitcher) {
        const ctx = document.getElementById('trendChart').getContext('2d');
        
        if (this.trendChart) {
            this.trendChart.destroy();
        }

        // For demonstration, using the same data but as a line chart
        // In a real application, you might want to use historical data
        const labels = statsData.map(([key]) => key);
        const values = statsData.map(([_, value]) => typeof value === 'string' ? parseFloat(value) : value);

        this.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `${isPitcher ? 'Pitcher' : 'Hitter'} Trends`,
                    data: values,
                    fill: false,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `${isPitcher ? 'Pitcher' : 'Hitter'} Trends`
                    },
                    legend: {
                        display: false
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

    updateIdsSection() {
        const idsSection = document.getElementById('playerIds');
        if (idsSection) {
            idsSection.innerHTML = `
                <h3 style="color: #00FF00; margin-bottom: 15px;">Player IDs</h3>
                <div class="info-cards">
                    ${this.createIdCard('MLB ID', this.playerData.mlbID)}
                    ${this.createIdCard('ESPN ID', this.playerData.espnID)}
                    ${this.createIdCard('CBS ID', this.playerData.cbsPlayerID)}
                    ${this.createIdCard('Yahoo ID', this.playerData.yahooPlayerID)}
                    ${this.createIdCard('Fantasy Pros ID', this.playerData.fantasyProsPlayerID)}
                    ${this.createIdCard('RotoWire ID', this.playerData.rotoWirePlayerID)}
                    ${this.createIdCard('Sleeper Bot ID', this.playerData.sleeperBotID)}
                    ${this.createIdCard('MLB ID Full', this.playerData.mlbIDFull)}
                    ${this.createIdCard('RotoWire ID Full', this.playerData.rotoWirePlayerIDFull)}
                    ${this.createIdCard('Player ID', this.playerData.playerID)}
                </div>
            `;
        }
    }

    createIdCard(label, value) {
        return `
            <div class="info-card">
                <span class="label">${label}</span>
                <span class="value">${value || 'N/A'}</span>
            </div>
        `;
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

    const content = section.querySelector('.projections-content');
    const button = section.querySelector('.toggle-button');

    if (content.style.display === 'none') {
        content.style.display = 'block';
        button.textContent = 'Collapse';
    } else {
        content.style.display = 'none';
        button.textContent = 'Expand';
    }
}