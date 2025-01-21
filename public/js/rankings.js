document.addEventListener('DOMContentLoaded', async () => {
    const leagueId = new URLSearchParams(window.location.search).get('id');
    const response = await fetch(`/api/league/${leagueId}/rankings`);
    const rankings = await response.json();
  
    const table = document.getElementById('overallRankings');
    rankings.forEach((rank) => {
      const row = table.insertRow();
      row.insertCell(0).textContent = rank.rank;
      row.insertCell(1).textContent = rank.team_id;
      row.insertCell(2).textContent = rank.score;
    });
  });