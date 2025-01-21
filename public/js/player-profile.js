document.addEventListener('DOMContentLoaded', async () => {
    const playerId = new URLSearchParams(window.location.search).get('id');
    const response = await fetch(`/api/player/${playerId}`);
    const player = await response.json();
  
    document.getElementById('playerName').textContent = player.name;
    document.getElementById('playerTeam').textContent = `Team: ${player.team}`;
    document.getElementById('playerPosition').textContent = `Position: ${player.position}`;
    document.getElementById('currentStats').textContent = JSON.stringify(player.stats, null, 2);
  });