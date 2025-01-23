class PlayerProfile {
    constructor() {
        this.playerData = null;
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
                hfsData: hfsPlayer || null,
                pfsData: pfsPlayer || null
            };

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

        // Update player image with loading state
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
            newImage.src = data.mlbHeadshot || data.espnHeadshot || 'https://cdn-icons-png.flaticon.com/512/166/166366.png';
        }

        // Update links section
        const linksSection = document.getElementById('playerLinks');
        if (linksSection) {
            linksSection.innerHTML = `
                <h3 style="color: #00FF00; margin-bottom: 15px;">External Links</h3>
                <div class="player-links">
                    ${data.mlbLink ? `<a href="${data.mlbLink}" target="_blank" class="btn-primary">MLB Profile</a>` : ''}
                    ${data.espnLink ? `<a href="${data.espnLink}" target="_blank" class="btn-primary">ESPN Profile</a>` : ''}
                    ${data.yahooLink ? `<a href="${data.yahooLink}" target="_blank" class="btn-primary">Yahoo Profile</a>` : ''}
                    ${data.fantasyProsLink ? `<a href="${data.fantasyProsLink}" target="_blank" class="btn-primary">FantasyPros Profile</a>` : ''}
                </div>
            `;
        }

        // Update projections section
        this.updateProjectionsSection();

        // Update IDs section
        const idsSection = document.getElementById('playerIds');
        if (idsSection) {
            idsSection.innerHTML = `
                <h3 style="color: #00FF00; margin-bottom: 15px;">Player IDs</h3>
                <div class="info-cards">
                    ${this.createIdCard('MLB ID', data.mlbID)}
                    ${this.createIdCard('ESPN ID', data.espnID)}
                    ${this.createIdCard('CBS ID', data.cbsPlayerID)}
                    ${this.createIdCard('Yahoo ID', data.yahooPlayerID)}
                    ${this.createIdCard('Fantasy Pros ID', data.fantasyProsPlayerID)}
                    ${this.createIdCard('RotoWire ID', data.rotoWirePlayerID)}
                    ${this.createIdCard('Sleeper Bot ID', data.sleeperBotID)}
                    ${this.createIdCard('MLB ID Full', data.mlbIDFull)}
                    ${this.createIdCard('RotoWire ID Full', data.rotoWirePlayerIDFull)}
                    ${this.createIdCard('Player ID', data.playerID)}
                </div>
            `;
        }
    }

    removeEmptyDivs() {
        const emptyDivs = document.querySelectorAll('.content-wrapper > div:empty');
        emptyDivs.forEach(div => div.remove());
    }

    updateProjectionsSection() {
        const projectionsSection = document.getElementById('projectionsSection');
        if (!projectionsSection) return;
    
        const { hfsData, pfsData } = this.playerData;
        const playerData = hfsData || pfsData; // Use whichever data exists
    
        if (!playerData) {
            projectionsSection.innerHTML = `
                <h3 class="section-title">Projections</h3>
                <div class="projections-content">
                    <p>No projection data available</p>
                </div>
            `;
            return;
        }
    
        const isPitcher = pfsData !== null;
        
        projectionsSection.innerHTML = `
            <h3 class="section-title">Projections</h3>
            <div class="projections-content">
                <h4>${isPitcher ? 'Pitcher' : 'Hitter'} Projections</h4>
                <div class="projection-cards">
                    ${Object.entries(playerData)
                        .filter(([key]) => {
                            // Filter out non-stat fields
                            const excludeFields = ['playerid', 'name', 'Pos', 'team', 'Availability', 'Rank', 'PositionRank'];
                            return !excludeFields.includes(key);
                        })
                        .map(([key, value]) => `
                            <div class="projection-card">
                                <span class="stat-key">${key}</span>
                                <span class="stat-value">${value}</span>
                            </div>
                        `).join('')}
                </div>
            </div>
            <button class="toggle-button" onclick="toggleSection('projectionsSection')">Collapse</button>
        `;
    }

    createProjectionCard(title, data) {
        return `
            <div class="projection-card">
                <h4>${title}</h4>
                <div class="projection-stats">
                    ${Object.entries(data).map(([key, value]) => `
                        <div class="stat-item">
                            <span class="stat-key">${key}</span>
                            <span class="stat-value">${value}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    createIdCard(label, value) {
        return `
            <div class="info-card">
                <span class="label">${label}</span>
                <span class="value">${value || 'N/A'}</span>
            </div>
        `;
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

// Utility function to toggle sections
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

// Initialize the player profile when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const profile = new PlayerProfile();
    profile.loadPlayerProfile();
});

// Add global error handling
window.onerror = function (msg, url, lineNo, columnNo, error) {
    console.error('Global error:', { msg, url, lineNo, columnNo, error });
    const profile = new PlayerProfile();
    profile.handleError(error || new Error(msg));
    return false;
};