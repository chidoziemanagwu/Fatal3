// public/js/rankings.js
document.addEventListener('DOMContentLoaded', async () => {
    const leagueSelect = document.getElementById('leagueSelect');
    const rankingsTable = document.getElementById('overallRankings');
    
    // First load available leagues
    try {
        const leaguesResponse = await fetch('/leagues');
        const leagues = await leaguesResponse.json();
        
        // Populate league select dropdown
        leagues.forEach(league => {
            const option = document.createElement('option');
            option.value = league.id;
            option.textContent = league.name;
            leagueSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading leagues:', error);
    }

    async function loadRankings(leagueId) {
        if (!leagueId) {
            rankingsTable.innerHTML = '<tr><td colspan="3">Please select a league</td></tr>';
            return;
        }

        try {
            const response = await fetch(`/api/league/${leagueId}/rankings`);
            if (!response.ok) {
                throw new Error('Failed to fetch rankings');
            }
            
            const rankings = await response.json();
            
            // Clear existing table content
            rankingsTable.innerHTML = `
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Team</th>
                        <th>Score</th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;

            const tbody = rankingsTable.querySelector('tbody');
            
            if (!rankings || rankings.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3">No rankings available</td></tr>';
                return;
            }

            rankings.forEach(rank => {
                const row = tbody.insertRow();
                row.insertCell(0).textContent = rank.rank || 'N/A';
                row.insertCell(1).textContent = rank.team_name || 'Unknown Team';
                row.insertCell(2).textContent = rank.score ? rank.score.toFixed(2) : 'N/A';
            });
        } catch (error) {
            console.error('Error loading rankings:', error);
            rankingsTable.innerHTML = `<tr><td colspan="3">Error loading rankings: ${error.message}</td></tr>`;
        }
    }

    // Add event listener for league selection
    leagueSelect.addEventListener('change', (e) => {
        loadRankings(e.target.value);
    });

    // Load rankings for initial league if one is selected
    if (leagueSelect.value) {
        loadRankings(leagueSelect.value);
    }
});