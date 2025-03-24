// Prevent multiple script injections
if (window.hasOwnProperty('furnishedFinderScraperInitialized')) {
  console.log('Content script already initialized');
} else {
  window.furnishedFinderScraperInitialized = true;

  // Function to wait for elements to load
  const waitForElement = (selectors, timeout = 30000) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      console.log(`Waiting for elements: ${selectors.join(', ')}`);

      const checkElement = () => {
        // Try each selector
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            console.log(`Found element with selector: ${selector}`);
            resolve(element);
            return;
          }
        }

        if (Date.now() - startTime > timeout) {
          console.error(`Timeout waiting for elements: ${selectors.join(', ')}`);
          reject(new Error(`Timeout waiting for elements: ${selectors.join(', ')}`));
          return;
        }

        requestAnimationFrame(checkElement);
      };

      checkElement();
    });
  };

  // Function to extract text content safely
  const extractText = (element, selectors) => {
    try {
      for (const selector of selectors) {
        const el = element.querySelector(selector);
        if (el) {
          return el.textContent.trim();
        }
      }
      return 'N/A';
    } catch (error) {
      console.error(`Error extracting text for selectors ${selectors.join(', ')}:`, error);
      return 'N/A';
    }
  };

  // Function to scrape a single property listing
  const scrapePropertyListing = (listing) => {
    try {
      // Get property link and title
      const linkElement = listing.closest('a[data-testid="native-link"]');
      const propertyUrl = linkElement ? new URL(linkElement.href).href : 'N/A';
      
      // Get title from the property card div's data-testid
      const propertyTitle = listing.getAttribute('data-testid')?.replace('property-card-', '') || 'N/A';

      // Get price - look for price in multiple locations
      const priceElement = listing.querySelector('[data-testid="price"], .text-black');
      const priceText = priceElement ? priceElement.textContent.trim() : '';
      const price = priceText.replace(/[^0-9.]/g, '') || 'N/A';

      // Get address - look for address in multiple locations
      const addressElement = listing.querySelector('[data-testid="address"], .text-grey-dark');
      const address = addressElement ? addressElement.textContent.trim() : 'N/A';

      // Get property type and details - look for details text
      const detailsElement = listing.querySelector('.text-grey-dark');
      const detailsText = detailsElement ? detailsElement.textContent.trim() : '';
      
      // Extract property type from details text
      const propertyType = detailsText.split('•')[0]?.trim() || 'N/A';

      // Get beds and baths from the details text
      const bedsMatch = detailsText.match(/(\d+)\s*bed/i);
      const bathsMatch = detailsText.match(/(\d+)\s*bath/i);
      const beds = bedsMatch ? bedsMatch[1] : 'N/A';
      const baths = bathsMatch ? bathsMatch[1] : 'N/A';

      // Get square footage if available
      const sqftMatch = detailsText.match(/(\d+)\s*sqft/i);
      const sqft = sqftMatch ? sqftMatch[1] : 'N/A';

      // Log the extracted data for debugging
      console.log('Extracted listing data:', {
        propertyTitle,
        propertyUrl,
        price,
        beds,
        baths,
        address,
        propertyType,
        sqft,
        detailsText
      });

      return {
        propertyTitle,
        propertyUrl,
        price,
        beds,
        baths,
        address,
        propertyType,
        sqft
      };
    } catch (error) {
      console.error('Error scraping property listing:', error);
      return null;
    }
  };

  // Main scraping function
  const scrapeListings = async () => {
    try {
      console.log('Starting to scrape listings...');
      console.log('Current URL:', window.location.href);
      console.log('Page title:', document.title);
      
      // Wait for the listings container to load
      const listingsContainer = await waitForElement(['#serp_default_view']);
      
      // Get all property listings directly from the container
      // Each listing is wrapped in an <a> tag with data-testid="native-link"
      const listings = Array.from(listingsContainer.querySelectorAll('a[data-testid="native-link"] > div[data-testid^="property-card-"]'));
      
      console.log('Found listings:', listings.length);
      if (!listings.length) {
        throw new Error('No property listings found on the page');
      }

      // Log the HTML structure for debugging
      console.log('Property cards container HTML:', listingsContainer.innerHTML);

      console.log(`Found ${listings.length} listings`);

      // Scrape each listing
      const scrapedData = listings
        .map(listing => {
          const data = scrapePropertyListing(listing);
          console.log('Scraped listing data:', data);
          return data;
        })
        .filter(data => data !== null);

      console.log(`Successfully scraped ${scrapedData.length} listings`);
      return scrapedData;
    } catch (error) {
      console.error('Failed to scrape listings:', error);
      throw new Error(`Failed to scrape listings: ${error.message}`);
    }
  };

  // Function to handle messages
  function handleMessage(message, sender, sendResponse) {
    if (message.type === 'SCRAPE_PAGE') {
      console.log('Received SCRAPE_PAGE message');
      scrapeListings()
        .then(data => {
          console.log('Scraping completed successfully');
          // Send data back both ways to ensure delivery
          chrome.runtime.sendMessage({
            type: 'SCRAPING_RESULTS',
            data
          }, response => {
            console.log('Background script response:', response);
            // Also send response directly to the original sender
            sendResponse({ success: true, type: 'SCRAPING_RESULTS', data });
          });
        })
        .catch(error => {
          console.error('Scraping failed:', error);
          chrome.runtime.sendMessage({
            type: 'SCRAPING_ERROR',
            error: error.message
          }, response => {
            console.log('Background script error response:', response);
            sendResponse({ success: false, type: 'SCRAPING_ERROR', error: error.message });
          });
        });
      return true; // Keep the message channel open for async response
    }
  }

  // Set up message listener
  chrome.runtime.onMessage.addListener(handleMessage);
} 