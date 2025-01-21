// public/js/subscription.js
async function checkSubscriptionStatus() {
    try {
      const response = await fetch('/api/subscription/status');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching subscription status:', error);
      return { 
        status: 'error', 
        plan: null, 
        error: error.message 
      };
    }
  }
  
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const status = await checkSubscriptionStatus();
      console.log('Subscription status:', status);
      // Handle the subscription status
      if (status.error) {
        console.error('Subscription error:', status.error);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  });