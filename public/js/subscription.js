document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.select-plan').forEach((button) => {
      button.addEventListener('click', async () => {
        const plan = button.dataset.plan;
        const response = await fetch('/api/subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 1, plan }), // Replace with actual user ID
        });
        const result = await response.json();
        alert(result.status);
      });
    });
  });