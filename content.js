// content.js - Updated for Floating Window
let floatingWindow = null;
let isDragging = false;
let currentX;
let currentY;
let initialX;
let initialY;

// Listen for messages from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Instroom] Received message:', request.message);
  
  if (request.message === "get_profile_url") {
    const profileUrl = window.location.href;
    const profilePicUrl = getProfilePicUrlFromPage();
    const userId = getUserIdFromPage();
    chrome.runtime.sendMessage({
      message: "profile_url",
      url: profileUrl,
      profilePicUrl: profilePicUrl,
      userId: userId,
    });
  } else if (request.message === "profile_data") {
    console.log('[Instroom] Displaying profile data:', request.data);
    displayProfileData(request.data);
  } else if (request.message === "profile_data_error") {
    console.error('[Instroom] Profile data error:', request.error);
    displayError(request.error);
  } else if (request.message === "post_stats_data") {
    console.log('[Instroom] Displaying post stats:', request.data);
    displayPostStats(request.data);
  } else if (request.message === "post_stats_error") {
    console.error('[Instroom] Post stats error:', request.error);
    displayPostStats({ totalLikes: "Error", totalComments: "Error" });
  } else if (request.message === "reels_stats_data") {
    console.log('[Instroom] Displaying reels stats:', request.data);
    displayReelsStats(request.data);
  } else if (request.message === "usage_limit_reached") {
    console.warn('[Instroom] Usage limit reached');
    displayError(request.error);
  } else if (request.message === "remaining_credits") {
    updateRemainingCredits(request.remaining);
  }
  
  return true; // Keep the message channel open for async responses
});

function getUserIdFromPage() {
  try {
    const metaTag = document.querySelector('meta[property="al:ios:url"]');
    if (metaTag) {
      const content = metaTag.getAttribute('content');
      const match = content.match(/user\?id=(\d+)/);
      if (match && match[1]) {
        return match[1];
      }
    }
  } catch (e) {
    console.error("Error extracting user ID:", e);
  }
  return null;
}

function getProfilePicUrlFromPage() {
  try {
    // Try multiple selectors to find the profile picture
    const selectors = [
      'main header img',
      'header img[alt*="profile"]',
      'header img[data-testid="user-avatar"]',
      'header div[role="button"] img',
      'header canvas + img'
    ];
    
    for (const selector of selectors) {
      const imgElement = document.querySelector(selector);
      if (imgElement && imgElement.src && imgElement.src.startsWith('http')) {
        return imgElement.src;
      }
    }
  } catch (e) {
    console.error("Error extracting profile picture URL:", e);
  }
  return null;
}

// Create floating window
function createFloatingWindow() {
  if (floatingWindow) return; // Already exists

  floatingWindow = document.createElement('div');
  floatingWindow.id = 'instroom-floating-window';
  floatingWindow.innerHTML = `
    <div class="instroom-drag-handle">
      <img src="${chrome.runtime.getURL('images/Instroom Logo 16x16.png')}" class="instroom-logo" alt="Instroom" />
      <span class="instroom-title">Instroom</span>
      <button class="instroom-close-btn">×</button>
    </div>
    <div class="instroom-content">
      <div id="instroom-loading" class="instroom-loading">
        <div class="instroom-spinner"></div>
        <span>Loading...</span>
      </div>
      <div id="instroom-error" class="instroom-error" style="display: none;"></div>
      <div id="instroom-profile-data" style="display: none">
        <div class="instroom-profile-header">
          <img id="instroom-profile-pic" class="instroom-profile-pic" src="${chrome.runtime.getURL('images/instroomLogo.png')}" alt="Profile" />
          <div class="instroom-profile-info">
            <div class="instroom-username" id="instroom-username">Loading...</div>
            <div class="instroom-email" id="instroom-email">—</div>
          </div>
        </div>
        <div class="instroom-stats">
          <div class="instroom-stat-row">
            <span class="instroom-stat-label">Followers</span>
            <span class="instroom-stat-value" id="instroom-followers">—</span>
          </div>
          <div class="instroom-stat-row">
            <span class="instroom-stat-label">Engagement</span>
            <span class="instroom-stat-value instroom-highlight" id="instroom-engagement-rate">—</span>
          </div>
          <div class="instroom-stat-row">
            <span class="instroom-stat-label">Avg. Likes</span>
            <span class="instroom-stat-value" id="instroom-average-likes">—</span>
          </div>
          <div class="instroom-stat-row">
            <span class="instroom-stat-label">Avg. Comments</span>
            <span class="instroom-stat-value" id="instroom-average-comments">—</span>
          </div>
          <div class="instroom-stat-row">
            <span class="instroom-stat-label">Avg. Views</span>
            <span class="instroom-stat-value" id="instroom-average-reel-plays">—</span>
          </div>
          <div class="instroom-stat-row">
            <span class="instroom-stat-label">Location</span>
            <span class="instroom-stat-value" id="instroom-country">—</span>
          </div>
        </div>
        <div class="instroom-footer">
          <span class="instroom-credits-label">Credits:</span>
          <span class="instroom-credits-value" id="instroom-remaining-credits">—</span>
        </div>
      </div>
    </div>
  `;

  // Add styles
  injectStyles();
  
  document.body.appendChild(floatingWindow);

  // Add drag functionality
  const dragHandle = floatingWindow.querySelector('.instroom-drag-handle');
  dragHandle.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);

  // Close button
  floatingWindow.querySelector('.instroom-close-btn').addEventListener('click', () => {
    floatingWindow.style.display = 'none';
  });

  // Load initial position from storage
  chrome.storage.local.get(['windowPosition'], (result) => {
    if (result.windowPosition) {
      floatingWindow.style.left = result.windowPosition.x + 'px';
      floatingWindow.style.top = result.windowPosition.y + 'px';
    }
  });

  // Fetch profile data
  fetchProfileData();
}

// Drag functions
function dragStart(e) {
  if (e.target.classList.contains('instroom-close-btn')) return;
  
  initialX = e.clientX - currentX;
  initialY = e.clientY - currentY;

  if (e.target.closest('.instroom-drag-handle')) {
    isDragging = true;
  }
}

function drag(e) {
  if (isDragging) {
    e.preventDefault();
    currentX = e.clientX - initialX;
    currentY = e.clientY - initialY;

    floatingWindow.style.left = currentX + 'px';
    floatingWindow.style.top = currentY + 'px';
  }
}

function dragEnd(e) {
  if (isDragging) {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;

    // Save position
    chrome.storage.local.set({
      windowPosition: { x: currentX, y: currentY }
    });
  }
}

// Fetch profile data
function fetchProfileData() {
  console.log('[Instroom] Starting to fetch profile data...');
  
  chrome.storage.local.get(["usageCount", "lastReset"], (result) => {
    const MAX_USAGE = 1000;
    let usageCount = result.usageCount || 0;
    const remaining = MAX_USAGE - usageCount;
    updateRemainingCredits(remaining);

    const profileUrl = window.location.href;
    const profilePicUrl = getProfilePicUrlFromPage();
    const userId = getUserIdFromPage();
    
    console.log('[Instroom] Profile URL:', profileUrl);
    console.log('[Instroom] Profile Pic URL:', profilePicUrl);
    console.log('[Instroom] User ID:', userId);
    
    chrome.runtime.sendMessage({
      message: "profile_url",
      url: profileUrl,
      profilePicUrl: profilePicUrl,
      userId: userId,
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Instroom] Error sending message:', chrome.runtime.lastError);
        displayError('Failed to connect to extension background. Please refresh the page.');
      }
    });
  });
}

// Display functions
function formatNumber(num) {
  if (typeof num !== 'number' || isNaN(num)) {
    return "N/A";
  }
  if (num < 1000) {
    return num.toString();
  }
  if (num < 1000000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  if (num < 1000000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
}

let followersCountForEngagement = null;

function displayProfileData(data) {
  const loadingDiv = document.getElementById('instroom-loading');
  const profileDataDiv = document.getElementById('instroom-profile-data');
  
  loadingDiv.style.display = 'none';
  profileDataDiv.style.display = 'block';
  
  document.getElementById('instroom-username').textContent = data.username || "N/A";
  document.getElementById('instroom-email').textContent = data.email || "N/A";
  document.getElementById('instroom-followers').textContent = formatNumber(data.followers_count);
  document.getElementById('instroom-country').textContent = data.location || "N/A";
  document.getElementById('instroom-engagement-rate').textContent = data.engagement_rate || "N/A";
  
  const profilePic = document.getElementById('instroom-profile-pic');
  if (data.profilePicUrl) {
    profilePic.src = data.profilePicUrl;
  }

  followersCountForEngagement = parseInt(
    (data.followers_count || "0").toString().replace(/,/g, ""),
    10
  );

  if (data.username) {
    const spinnerHtml = '<div class="instroom-spinner-small"></div>';
    document.getElementById('instroom-engagement-rate').innerHTML = spinnerHtml;
    document.getElementById('instroom-average-likes').innerHTML = spinnerHtml;
    document.getElementById('instroom-average-comments').innerHTML = spinnerHtml;
    document.getElementById('instroom-average-reel-plays').innerHTML = spinnerHtml;

    chrome.runtime.sendMessage({ message: "get_post_stats", username: data.username });
    chrome.runtime.sendMessage({ message: "get_reels_stats", username: data.username });
  }
}

function displayPostStats(data) {
  const POST_COUNT = 12;
  let avgLikes = "N/A";
  let avgComments = "N/A";
  
  if (typeof data.totalLikes === "number" && typeof data.totalComments === "number") {
    avgLikes = formatNumber(Math.round(data.totalLikes / POST_COUNT));
    avgComments = formatNumber(Math.round(data.totalComments / POST_COUNT));
  }

  document.getElementById('instroom-average-likes').textContent = avgLikes;
  document.getElementById('instroom-average-comments').textContent = avgComments;

  if (
    typeof data.totalLikes === "number" &&
    typeof data.totalComments === "number" &&
    followersCountForEngagement &&
    followersCountForEngagement > 0
  ) {
    const avgEngagement = (data.totalLikes + data.totalComments) / POST_COUNT;
    const engagementRate = (avgEngagement / followersCountForEngagement) * 100;
    document.getElementById('instroom-engagement-rate').textContent = engagementRate.toFixed(2) + "%";
  }
}

function displayReelsStats(data) {
  const element = document.getElementById('instroom-average-reel-plays');
  if (data.averagePlays) {
    element.textContent = formatNumber(parseInt(data.averagePlays, 10));
  } else {
    element.textContent = "N/A";
  }
}

function displayError(message) {
  const loadingDiv = document.getElementById('instroom-loading');
  const errorDiv = document.getElementById('instroom-error');
  
  loadingDiv.style.display = 'none';
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

function updateRemainingCredits(remaining) {
  const element = document.getElementById('instroom-remaining-credits');
  if (element) {
    element.textContent = remaining;
  }
}

// Inject CSS styles
function injectStyles() {
  if (document.getElementById('instroom-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'instroom-styles';
  style.textContent = `
    #instroom-floating-window {
      position: fixed;
      top: 320px;
      right: 20px;
      width: 280px;
      background: linear-gradient(145deg, #1a0f2e 0%, #0f0a1a 100%);
      border: 1px solid rgba(167, 139, 250, 0.2);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      color: #e5e5e5;
      overflow: hidden;
    }

    .instroom-drag-handle {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: rgba(167, 139, 250, 0.08);
      border-bottom: 1px solid rgba(167, 139, 250, 0.15);
      cursor: move;
      user-select: none;
    }

    .instroom-logo {
      width: 16px;
      height: 16px;
    }

    .instroom-title {
      flex: 1;
      font-size: 12px;
      font-weight: 600;
      color: #a78bfa;
      letter-spacing: -0.01em;
    }

    .instroom-close-btn {
      background: none;
      border: none;
      color: #8b7fb8;
      font-size: 18px;
      cursor: pointer;
      padding: 0;
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.15s;
      line-height: 1;
    }

    .instroom-close-btn:hover {
      background: rgba(167, 139, 250, 0.15);
      color: #c4b5fd;
    }

    .instroom-content {
      max-height: 400px;
      overflow-y: auto;
    }

    .instroom-loading {
      padding: 35px 18px;
      text-align: center;
      color: #8b7fb8;
      font-size: 11px;
    }

    .instroom-loading span {
      display: block;
      margin-top: 8px;
    }

    .instroom-spinner {
      width: 22px;
      height: 22px;
      border: 2px solid rgba(167, 139, 250, 0.1);
      border-top-color: #a78bfa;
      border-radius: 50%;
      margin: 0 auto;
      animation: instroom-spin 0.7s linear infinite;
    }

    .instroom-spinner-small {
      width: 11px;
      height: 11px;
      border: 2px solid rgba(167, 139, 250, 0.1);
      border-top-color: #a78bfa;
      border-radius: 50%;
      display: inline-block;
      animation: instroom-spin 0.7s linear infinite;
      vertical-align: middle;
    }

    @keyframes instroom-spin {
      to { transform: rotate(360deg); }
    }

    .instroom-error {
      padding: 28px 18px;
      text-align: center;
      color: #f87171;
      font-size: 11px;
    }

    .instroom-profile-header {
      display: flex;
      align-items: center;
      gap: 11px;
      padding: 14px;
      border-bottom: 1px solid rgba(167, 139, 250, 0.1);
    }

    .instroom-profile-pic {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid rgba(167, 139, 250, 0.3);
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(167, 139, 250, 0.15);
    }

    .instroom-profile-info {
      flex: 1;
      min-width: 0;
    }

    .instroom-username {
      font-size: 13px;
      font-weight: 600;
      color: #ffffff;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .instroom-email {
      font-size: 10px;
      color: #a78bfa;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      background: rgba(167, 139, 250, 0.15);
      padding: 2px 7px;
      border-radius: 4px;
      display: inline-block;
      max-width: 100%;
      border: 1px solid rgba(167, 139, 250, 0.2);
    }

    .instroom-stats {
      padding: 3px 0;
    }

    .instroom-stat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 14px;
      transition: background 0.15s ease;
    }

    .instroom-stat-row:hover {
      background: rgba(167, 139, 250, 0.05);
    }

    .instroom-stat-label {
      font-size: 11px;
      color: #9ca3af;
      font-weight: 400;
    }

    .instroom-stat-value {
      font-size: 12px;
      font-weight: 600;
      color: #e5e5e5;
      font-variant-numeric: tabular-nums;
    }

    .instroom-stat-value.instroom-highlight {
      color: #c4b5fd;
    }

    .instroom-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      background: rgba(167, 139, 250, 0.08);
      border-top: 1px solid rgba(167, 139, 250, 0.15);
    }

    .instroom-credits-label {
      font-size: 10px;
      color: #8b7fb8;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }

    .instroom-credits-value {
      font-size: 12px;
      font-weight: 700;
      color: #a78bfa;
    }

    .instroom-content::-webkit-scrollbar {
      width: 4px;
    }

    .instroom-content::-webkit-scrollbar-track {
      background: transparent;
    }

    .instroom-content::-webkit-scrollbar-thumb {
      background: rgba(167, 139, 250, 0.2);
      border-radius: 3px;
    }

    .instroom-content::-webkit-scrollbar-thumb:hover {
      background: rgba(167, 139, 250, 0.3);
    }
  `;
  document.head.appendChild(style);
}

// Initialize position - place below UpDog
currentX = window.innerWidth - 300; // Align with UpDog
currentY = 320; // Below UpDog (UpDog appears to be around top: 100px with ~200px height)
initialX = currentX;
initialY = currentY;

// Check if we're on a profile page (not feed, not explore, not post)
function isProfilePage() {
  const path = window.location.pathname;
  // Profile pages are like /username/ or /username
  // Exclude /p/, /explore/, /reels/, /direct/, etc.
  return path.match(/^\/[^\/]+\/?$/) && 
         !path.includes('/explore') && 
         !path.includes('/reels') && 
         !path.includes('/direct') &&
         path !== '/' &&
         path !== '/accounts/';
}

// Wait for profile data to be available in the page
function waitForProfileData(callback, maxAttempts = 20) {
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    const profilePic = document.querySelector('main header img');
    const username = document.querySelector('main header h2, main header span');
    
    if ((profilePic || username) || attempts >= maxAttempts) {
      clearInterval(interval);
      callback();
    }
  }, 300); // Check every 300ms
}

// Initialize on profile pages
if (isProfilePage()) {
  waitForProfileData(() => {
    createFloatingWindow();
  });
}

// Listen for URL changes (Instagram is a SPA)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    if (isProfilePage()) {
      if (!floatingWindow) {
        waitForProfileData(() => {
          createFloatingWindow();
        });
      } else {
        floatingWindow.style.display = 'block';
        // Reset loading state
        document.getElementById('instroom-loading').style.display = 'block';
        document.getElementById('instroom-profile-data').style.display = 'none';
        document.getElementById('instroom-error').style.display = 'none';
        fetchProfileData();
      }
    } else if (floatingWindow) {
      floatingWindow.style.display = 'none';
    }
  }
}).observe(document, { subtree: true, childList: true });