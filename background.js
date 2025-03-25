// Function to convert data to CSV format
const convertToCSV = (data) => {
  const headers = [
    'Property Title',
    'Price',
    'Beds',
    'Baths',
    'Property Type',
    'Property URL'
  ];

  const rows = data.map(item => [
    item.propertyTitle,
    item.price,
    item.beds,
    item.baths,
    item.propertyType,
    item.propertyUrl
  ].map(field => `"${String(field).replace(/"/g, '""')}"`));

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
};

// Function to show notifications
const showNotification = (title, message) => {
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png') || '',
      title: title,
      message: message
    });
  } catch (error) {
    console.error('Error showing notification:', error);
  }
};

// Function to download images
const downloadImages = async (images) => {
  try {
    for (const image of images) {
      try {
        await chrome.downloads.download({
          url: image.url,
          filename: image.filename,
          saveAs: false
        });
      } catch (error) {
        console.error(`Error downloading image ${image.url}:`, error);
        // Continue with next image even if one fails
      }
    }
    return true;
  } catch (error) {
    console.error('Error in downloadImages:', error);
    return false;
  }
};

// Function to inject content script
const injectContentScript = async (tabId) => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content_script.js']
    });
    return true;
  } catch (error) {
    console.error('Error injecting content script:', error);
    return false;
  }
};

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background script received message:', message);
  
  if (message.type === 'START_SCRAPING') {
    console.log('Starting scraping process for tab:', message.tabId);
    
    // Inject content script if not already injected
    injectContentScript(message.tabId)
      .then(injected => {
        if (!injected) {
          sendResponse({ success: false, error: 'Failed to inject content script' });
          return;
        }
        
        // Send message to content script to start scraping
        chrome.tabs.sendMessage(message.tabId, { type: 'SCRAPE_PAGE' })
          .then(() => {
            sendResponse({ success: true });
            // Notify popup that scraping has started
            chrome.runtime.sendMessage({ type: 'SCRAPING_STARTED' });
          })
          .catch(error => {
            console.error('Error sending message to content script:', error);
            sendResponse({ success: false, error: 'Failed to communicate with the page' });
          });
      })
      .catch(error => {
        console.error('Error in START_SCRAPING handler:', error);
        sendResponse({ success: false, error: 'An unexpected error occurred' });
      });
    
    // Return true to indicate we will send a response asynchronously
    return true;
  } else if (message.type === 'SCRAPING_RESULTS') {
    console.log('Received scraping results:', message.data);
    
    try {
      // Process the scraped data
      const csvData = convertToCSV(message.data);
      console.log('CSV data generated:', csvData);
      
      // Create a data URL for the CSV content
      const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvData);
      
      // Download using chrome.downloads API
      chrome.downloads.download({
        url: dataUrl,
        filename: 'furnished_finder_listings.csv',
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('Download error:', chrome.runtime.lastError);
          chrome.runtime.sendMessage({ 
            type: 'SCRAPING_ERROR', 
            error: 'Failed to download CSV file: ' + chrome.runtime.lastError.message 
          });
        } else {
          console.log('Download started with ID:', downloadId);
          // Notify popup that scraping is completed
          chrome.runtime.sendMessage({ type: 'SCRAPING_COMPLETED' });
        }
      });
      
      // Send response back to content script
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error processing results:', error);
      chrome.runtime.sendMessage({ 
        type: 'SCRAPING_ERROR', 
        error: 'Failed to process results: ' + error.message 
      });
      sendResponse({ success: false, error: error.message });
    }
    return true;
  } else if (message.type === 'SCRAPING_ERROR') {
    console.error('Scraping error:', message.error);
    showNotification('Scraping Error', message.error);
    // Notify popup about the error
    chrome.runtime.sendMessage({ type: 'SCRAPING_ERROR', error: message.error });
    sendResponse({ received: true });
    return true;
  }
  return true;
});

// Listen for extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Check if we're on a Furnished Finder page
    if (!tab.url.includes('furnishedfinder.com')) {
      showNotification('Error', 'Please navigate to a Furnished Finder search results page');
      return;
    }

    // Inject content script if not already injected
    const injected = await injectContentScript(tab.id);
    if (!injected) {
      showNotification('Error', 'Failed to inject content script. Please refresh the page and try again.');
      return;
    }

    // Send message to content script to start scraping
    chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_PAGE' })
      .catch(error => {
        console.error('Error sending message to content script:', error);
        showNotification('Error', 'Failed to communicate with the page. Please refresh and try again.');
      });
  } catch (error) {
    console.error('Error in extension icon click handler:', error);
    showNotification('Error', 'An unexpected error occurred. Please try again.');
  }
});

// Function to process data to CSV format
function processDataToCSV(data) {
  const headers = ['Property Title', 'URL', 'Price', 'Beds', 'Baths', 'Address', 'Property Type', 'Square Feet'];
  const rows = data.map(item => [
    item.propertyTitle,
    item.propertyUrl,
    item.price,
    item.beds,
    item.baths,
    item.address,
    item.propertyType,
    item.sqft
  ]);

  return [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
} 