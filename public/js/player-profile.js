// public/js/player-profile.js

class PlayerProfile {
    constructor() {
        this.playerData = null;
    }

    async loadPlayerProfile() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const playerName = urlParams.get('name');
            const playerId = urlParams.get('id');

            if (!playerName && !playerId) {
                throw new Error('No player name or ID provided');
            }

            const playerData = await Tank01API.getPlayerInfo(playerName || playerId);
            console.log('Tank01 Player Data:', playerData);

            if (!playerData || !playerData.body || !playerData.body[0]) {
                throw new Error('No player data found');
            }

            this.playerData = playerData.body[0];
            this.updateUI();
        } catch (error) {
            console.error('Error loading player profile:', error);
            this.handleError(error);
        }
    }

    updateUI() {
        const data = this.playerData;

        // Update name and jersey number
        document.getElementById('playerName').textContent = data.longName || data.fullName || 'N/A';
        document.getElementById('playerNumber').textContent = data.jerseyNum ? `#${data.jerseyNum}` : '#00';

        // Update info cards values
        const infoCards = document.querySelectorAll('.info-card');
        infoCards.forEach(card => {
            const label = card.querySelector('.label').textContent.toLowerCase();
            const valueElement = card.querySelector('.value');
            
            switch(label) {
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
        const playerImage = document.getElementById('playerImage');
        if (playerImage) {
            playerImage.src = data.mlbHeadshot || data.espnHeadshot || 'https://cdn-icons-png.flaticon.com/512/166/166366.png';
            playerImage.onerror = () => {
                playerImage.src = 'https://cdn-icons-png.flaticon.com/512/166/166366.png';
            };
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

        // Update injury section
        const injurySection = document.getElementById('playerInjury');
        if (injurySection) {
            if (data.injury && (data.injury.designation || data.injury.description)) {
                injurySection.innerHTML = `
                    <h3 style="color: #00FF00; margin-bottom: 15px;">Injury Status</h3>
                    <div class="injury-alert">
                        <p style="color: #FF0000; font-weight: bold;">${data.injury.designation || 'N/A'}</p>
                        <p style="color: #FF9999;">${data.injury.description || 'No details available'}</p>
                        ${data.injury.injReturnDate ? `<p style="color: #FFFF00;">Expected Return: ${data.injury.injReturnDate}</p>` : ''}
                    </div>
                `;
            } else {
                injurySection.innerHTML = `
                    <h3 style="color: #00FF00; margin-bottom: 15px;">Injury Status</h3>
                    <p class="healthy-status">No current injuries</p>
                `;
            }
        }

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

// Initialize the player profile when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const profile = new PlayerProfile();
    profile.loadPlayerProfile();
});

// Add global error handling
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('Global error:', {msg, url, lineNo, columnNo, error});
    const profile = new PlayerProfile();
    profile.handleError(error || new Error(msg));
    return false;
};