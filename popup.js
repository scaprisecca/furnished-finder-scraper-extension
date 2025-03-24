document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup DOM loaded');
  const scrapeButton = document.getElementById('scrapeButton');
  const statusDiv = document.getElementById('status');
  const errorDiv = document.getElementById('error');
  const errorMessage = document.getElementById('error-message');

  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Popup received message:', message);
    if (message.type === 'SCRAPING_STARTED') {
      showStatus();
    } else if (message.type === 'SCRAPING_COMPLETED') {
      hideStatus();
      window.close(); // Close popup after successful scraping
    } else if (message.type === 'SCRAPING_ERROR') {
      hideStatus();
      showError(message.error);
    }
    // Always return true to indicate we will send a response asynchronously
    return true;
  });

  scrapeButton.addEventListener('click', async () => {
    console.log('Scrape button clicked');
    try {
      // Get the current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('Current tab:', tab);
      
      if (!tab.url.includes('furnishedfinder.com')) {
        showError('Please navigate to a Furnished Finder search results page first.');
        return;
      }

      // Send message to background script to start scraping
      console.log('Sending START_SCRAPING message to background script');
      chrome.runtime.sendMessage({ 
        type: 'START_SCRAPING',
        tabId: tab.id
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error:', chrome.runtime.lastError);
          showError('Failed to start scraping. Please try again.');
          hideStatus();
          return;
        }
        console.log('Response from background script:', response);
      });

      showStatus();
    } catch (error) {
      console.error('Error in popup:', error);
      showError('Failed to start scraping. Please try again.');
      hideStatus();
    }
  });

  function showStatus() {
    console.log('Showing status');
    statusDiv.classList.remove('hidden');
    scrapeButton.disabled = true;
    scrapeButton.classList.add('opacity-50', 'cursor-not-allowed');
    errorDiv.classList.add('hidden');
  }

  function hideStatus() {
    console.log('Hiding status');
    statusDiv.classList.add('hidden');
    scrapeButton.disabled = false;
    scrapeButton.classList.remove('opacity-50', 'cursor-not-allowed');
  }

  function showError(message) {
    console.log('Showing error:', message);
    errorMessage.textContent = message;
    errorDiv.classList.remove('hidden');
  }
}); 