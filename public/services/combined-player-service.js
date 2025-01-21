// public/services/combined-player-service.js

class CombinedPlayerService {
    static async getPlayerData(playerName, playerId) {
        try {
            // Fetch data from all sources in parallel
            const [tankData, hfsResponse, pfsResponse] = await Promise.all([
                Tank01API.getPlayerInfo(playerName), // Fetch Tank01API data
                fetch('/api/hfs'),                  // Fetch HFS data
                fetch('/api/pfs')                   // Fetch PFS data
            ]);

            // Check if HFS and PFS responses are valid
            if (!hfsResponse.ok || !pfsResponse.ok) {
                throw new Error('Failed to fetch HFS or PFS data');
            }

            const hfsData = await hfsResponse.json();
            const pfsData = await pfsResponse.json();

            // Find the player in HFS or PFS datasets
            const player = [...hfsData, ...pfsData].find(p =>
                (playerId && String(p.playerid) === String(playerId)) ||
                (playerName && p.name.toLowerCase() === playerName.toLowerCase())
            );

            if (!player) {
                console.log('Player not found in HFS or PFS data');
                return null;
            }

            // Combine the data from Tank01API, HFS, and PFS
            return this.combinePlayerData(tankData[0], player, hfsData, pfsData);
        } catch (error) {
            console.error('Error fetching combined player data:', error);
            return null;
        }
    }

    static combinePlayerData(tankData, player, hfsData, pfsData) {
        return {
            basic: {
                name: tankData?.longName || player.name,
                team: tankData?.team || player.team || 'N/A',
                teamAbv: tankData?.teamAbv || 'N/A',
                position: tankData?.pos || player.Pos || 'N/A',
                jerseyNumber: tankData?.jerseyNum || 'N/A',
                bats: tankData?.bat || 'N/A',
                throws: tankData?.throw || 'N/A',
                height: tankData?.height || 'N/A',
                weight: tankData?.weight || 'N/A',
                birthDate: tankData?.bDay || 'N/A',
                status: tankData?.espnStatus || 'N/A',
                injury: tankData?.injury || 'N/A'
            },
            images: {
                mlbHeadshot: tankData?.mlbHeadshot || null,
                espnHeadshot: tankData?.espnHeadshot || null
            },
            links: {
                mlb: tankData?.mlbLink || null,
                espn: tankData?.espnLink || null,
                yahoo: tankData?.yahooLink || null,
                fantasyPros: tankData?.fantasyProsLink || null
            },
            ids: {
                mlb: tankData?.mlbID || null,
                espn: tankData?.espnID || null,
                yahoo: tankData?.yahooPlayerID || null,
                fantasypros: tankData?.fantasyProsPlayerID || null
            },
            stats: {
                // Combine stats from HFS and PFS
                ...player,
                ...hfsData?.stats,
                ...pfsData?.stats
            },
            metrics: {
                fgScore: player.fgScore || 0,
                statcastScore: player.statcastScore || 0,
                combinedScore: player.combinedScore || 0
            },
            availability: player.Availability || 'Unknown',
            rank: player.Rank || 'N/A'
        };
    }
}

// Make it available globally
window.CombinedPlayerService = CombinedPlayerService;