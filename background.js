

// background.js
const RAPIDAPI_KEY = "afc08d77a3msha9dbce2c87bd4d4p1c4c64jsn5dacbf93e3eb"; // Replace with your actual RapidAPI key
const RAPIDAPI_HOST = "instagram-social-api.p.rapidapi.com";

const TIKTOK_API_HOST = "tiktok-api23.p.rapidapi.com"; 
let currentUserId = null;

// Listen for URL updates to handle navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    chrome.tabs.sendMessage(tabId, { message: "url_changed", url: changeInfo.url }, () => {
      chrome.runtime.lastError; // Suppress error if content script not ready
    });
  }
});

// Handle extension icon click to toggle the sidebar
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { message: "toggle_sidebar" });
  }
});

// Listen for messages from other parts of the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => { // Make the listener function itself async
  if (request.message === "profile_url") {
    // Using an async IIFE to handle the promise-based logic
    chrome.storage.local.get(["usageCount", "lastReset"], (result) => {
      const MAX_USAGE = 1000;
      let usageCount = result.usageCount || 0;
      const lastReset = result.lastReset;
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

      if (lastReset !== currentMonth) {
        usageCount = 0;
        chrome.storage.local.set({ usageCount: 0, lastReset: currentMonth });
      }

      if (usageCount >= MAX_USAGE) {
        chrome.runtime.sendMessage({
          message: "usage_limit_reached",
          error: "You have reached your monthly usage limit.",
          remaining: 0,
        });
        return; // Stop execution
      }

      // Increment usage count
      usageCount++;
      chrome.storage.local.set({ usageCount: usageCount }, () => {
        const remaining = MAX_USAGE - usageCount;
        chrome.runtime.sendMessage({ message: "remaining_credits", remaining: remaining });

        const profileUrl = request.url;
        const username = extractUsernameFromUrl(profileUrl);
        currentUserId = request.userId; // Store user ID from content script

        if (username) {
          if (profileUrl.includes("tiktok.com")) {
            fetchTikTokProfileData(username, request.profilePicUrl);
            fetchTikTokPostStats(username);
            // TikTok is all video, so we can map reels stats to the same data or a specific endpoint
            fetchTikTokReelsStats(username);
          } else {
            fetchProfileData(username, request.profilePicUrl); // Pass the direct image URL
            fetchPostStats(username);
            fetchReelsStats(username);
          }
        } else {
          console.error("Invalid profile URL:", profileUrl);
          chrome.runtime.sendMessage({
            message: "profile_data_error",
            error: "Invalid profile URL.",
          });
        }
      });
    });
    return true; // Return true to indicate you will send a response asynchronously.
  } else if (request.message === "get_post_stats") {
    if (request.username) {
      fetchPostStats(request.username);
    } else {
      console.error("Username not available for post stats.");
      chrome.runtime.sendMessage({
        message: "post_stats_error",
        error: "Could not retrieve username.",
      });
    }
    return true; // Also indicate async response for this message type.
  } else if (request.message === "get_reels_stats") {
    if (request.username) {
      fetchReelsStats(request.username);
    } else {
      console.error("Username not available for reels stats.");
      chrome.runtime.sendMessage({
        message: "reels_stats_error",
        error: "Could not retrieve username.",
      });
    }
    return true;
  }
  // Return false or undefined for any other messages if not handled asynchronously.
});

function extractUsernameFromUrl(profileUrl) {
  const parts = profileUrl.split("/");
  // Handle TikTok: https://www.tiktok.com/@username
  if (profileUrl.includes("tiktok.com") && parts.length >= 4) {
    const segment = parts[3].trim();
    return segment.startsWith('@') ? segment.substring(1) : segment;
  }
  if (parts.length >= 4) {
    return parts[3].trim(); // Trim to remove leading/trailing spaces
  }
  return null;
}

async function fetchProfileData(username, directProfilePicUrl) {
  const infoUrl = `https://instagram-social-api.p.rapidapi.com/v1/info?username_or_id_or_url=${username}`;
  const aboutUrl = `https://instagram-social-api.p.rapidapi.com/v1/info_about?username_or_id_or_url=${username}`;

  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key": RAPIDAPI_KEY,
      "x-rapidapi-host": RAPIDAPI_HOST,
    },
  };

  try {
    const [infoResponse, aboutResponse] = await Promise.all([
      fetch(infoUrl, options),
      fetch(aboutUrl, options),
    ]);

    if (!infoResponse.ok) {
      throw new Error(`API request to /v1/info failed with status ${infoResponse.status}`);
    }
     if (!aboutResponse.ok) {
        throw new Error(`API request to /v1/info_about failed with status ${aboutResponse.status}`);
    }

    const infoResult = await infoResponse.json();
    const aboutResult = await aboutResponse.json();

    const profileData = extractProfileData(infoResult, aboutResult);

    // Prioritize the direct URL from the content script. Fallback to API URLs if it's not available.
    let finalProfilePicUrl = directProfilePicUrl;

    if (!finalProfilePicUrl) {
      if (infoResult?.data?.profile_pic_url_hd) {
        finalProfilePicUrl = infoResult.data.profile_pic_url_hd;
      }
      else if (infoResult?.data?.hd_profile_pic_url_info?.url) {
        finalProfilePicUrl = infoResult.data.hd_profile_pic_url_info.url;
      }
      else if (infoResult?.data?.profile_pic_url) {
        finalProfilePicUrl = infoResult.data.profile_pic_url;
      }
    }

    // Determine the profile page URL
    let profileUrl;
    if (infoResult && infoResult.data && infoResult.data.profile_page_url) {
      profileUrl = infoResult.data.profile_page_url;
    } else {
      // Fallback to constructing the URL if the API doesn't provide a direct one
      profileUrl = `https://www.instagram.com/${profileData.username}/`;
    }

    chrome.runtime.sendMessage({ message: "profile_data", data: { ...profileData, profilePicUrl: finalProfilePicUrl, profileUrl } });

  } catch (error) {
    console.error("Error fetching profile data:", error);
    chrome.runtime.sendMessage({
      message: "profile_data_error",
      error: "Failed to fetch profile data.",
    });
  }
}

async function fetchPostStats(username) {
  const url = `https://instagram-social-api.p.rapidapi.com/v1/posts?username_or_id_or_url=${username}`;
  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key": RAPIDAPI_KEY,
      "x-rapidapi-host": RAPIDAPI_HOST,
    },
  };

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error("API Error Response Body:", errorBody);
      throw new Error(`API request to /v1/posts failed with status ${response.status}`);
    }
    const result = await response.json();

    if (result && result.data && Array.isArray(result.data.items)) {
      const posts = result.data.items;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      const filteredPosts = posts.filter(post => {
        const postDate = new Date(post.taken_at * 1000);
        postDate.setHours(0, 0, 0, 0);
        return postDate < yesterday;
      });

      const last12Posts = filteredPosts.slice(0, 12);

      const totalLikes = last12Posts.reduce((sum, post) => sum + (post.like_count || 0), 0);
      const totalComments = last12Posts.reduce((sum, post) => sum + (post.comment_count || 0), 0);
      
      chrome.runtime.sendMessage({
        message: "post_stats_data",
        data: { totalLikes, totalComments },
      });
    } else {
      console.error("Invalid data structure in posts API response:", result);
      throw new Error("Invalid data in posts API response.");
    }
  } catch (error) {
    console.error("Error fetching post stats:", error);
    chrome.runtime.sendMessage({
      message: "post_stats_error",
      error: "Failed to fetch post stats.",
    });
  }
}

async function fetchReelsStats(username) {
  const url = `https://instagram-social-api.p.rapidapi.com/v1/reels?username_or_id_or_url=${username}`;
  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key": RAPIDAPI_KEY,
      "x-rapidapi-host": RAPIDAPI_HOST,
    },
  };

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`API request to /v1/reels failed with status ${response.status}`);
    }
    const result = await response.json();

    if (result && result.data && Array.isArray(result.data.items)) {
      const reels = result.data.items;

      // 1. Filter out today's videos and pinned videos
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const filteredReels = reels.filter(reel => {
        const reelDate = new Date(reel.taken_at * 1000);
        return reelDate < today && !reel.is_pinned; // Note: is_pinned might not always be present
      });

      if (filteredReels.length < 4) { // Not enough data for IQR
        const totalPlays = filteredReels.reduce((sum, reel) => sum + (reel.play_count || 0), 0);
        const averagePlays = filteredReels.length > 0 ? (totalPlays / filteredReels.length) : 0;
        // Send reels count and average plays
        chrome.runtime.sendMessage({ message: "reels_stats_data", data: { averagePlays: averagePlays.toFixed(0) } });
        return;
      }

      const playCounts = filteredReels.map(reel => reel.play_count || 0).sort((a, b) => a - b);

      // 2. Remove outliers using IQR
      const q1Index = Math.floor(playCounts.length / 4);
      const q3Index = Math.floor(playCounts.length * (3 / 4));
      const q1 = playCounts[q1Index];
      const q3 = playCounts[q3Index];
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;

      const reelsWithoutOutliers = filteredReels.filter(reel => {
        const plays = reel.play_count || 0;
        return plays >= lowerBound && plays <= upperBound;
      });

      // 3. Calculate total and average play count
      const totalPlays = reelsWithoutOutliers.reduce((sum, reel) => sum + (reel.play_count || 0), 0);
      const averagePlays = reelsWithoutOutliers.length > 0 ? (totalPlays / reelsWithoutOutliers.length) : 0;

      // 4. Send the average play count
      chrome.runtime.sendMessage({ message: "reels_stats_data", data: { averagePlays: averagePlays.toFixed(0) } });

    } else {
      throw new Error("Invalid data in reels API response.");
    }
  } catch (error) {
    console.error("Error fetching reels stats:", error);
    chrome.runtime.sendMessage({
      message: "reels_stats_error",
      error: "Failed to fetch reels stats.",
    });
  }
}

function extractProfileData(infoData, aboutData) {
  if (infoData && infoData.data) {
    const data = infoData.data;
    let location = "N/A";
    let username = data.username || "";

    if (username.includes("#")) {
      username = username.replace("#", "");
    }
    if (aboutData && aboutData.data && aboutData.data.country) {
      location = aboutData.data.country;
    } else if (data.about && data.about.country) {
      // Keep the old way as a fallback
      location = data.about.country;
    }

    return {
      username: username,
      email: data.public_email || "email not available",     
      followers_count: data.follower_count || "N/A",
      location: location,
      engagement_rate: "Loading...", // This API doesn't provide engagement rate directly
    };
  } else {
    return {};
  }
}

// --- TIKTOK FUNCTIONS ---

async function fetchTikTokProfileData(username, directProfilePicUrl) {
  const url = `https://${TIKTOK_API_HOST}/api/user/info?uniqueId=${username}`;
  
  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key": RAPIDAPI_KEY,
      "x-rapidapi-host": TIKTOK_API_HOST,
    },
  };

  try {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`TikTok API request failed: ${response.status}`);
    
    const result = await response.json();
    const userInfo = result.userInfo;
    const user = userInfo?.user;
    const stats = userInfo?.stats;

    if (!user || !stats) throw new Error("Invalid TikTok API response structure");
    
    const profileData = {
      username: user.uniqueId || username,
      email: "N/A", // TikTok API rarely provides email
      followers_count: stats.followerCount || 0,
      location: "N/A",
      engagement_rate: "Loading...",
      profilePicUrl: directProfilePicUrl || user.avatarLarger || user.avatarMedium
    };

    chrome.runtime.sendMessage({ 
      message: "profile_data", 
      data: { ...profileData, profileUrl: `https://www.tiktok.com/@${username}` } 
    });

  } catch (error) {
    console.error("Error fetching TikTok profile:", error);
    chrome.runtime.sendMessage({ message: "profile_data_error", error: "Failed to fetch TikTok data." });
  }
}

async function fetchTikTokPostStats(username) {
  const url = `https://${TIKTOK_API_HOST}/api/user/posts?uniqueId=${username}&count=12`;
  const options = {
    method: "GET",
    headers: { "x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": TIKTOK_API_HOST },
  };

  try {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`TikTok Posts API failed: ${response.status}`);
    const result = await response.json();

    const posts = result.itemList || [];
    const recentPosts = posts.slice(0, 12);

    const totalLikes = recentPosts.reduce((sum, post) => sum + (post.stats?.diggCount || 0), 0);
    const totalComments = recentPosts.reduce((sum, post) => sum + (post.stats?.commentCount || 0), 0);

    chrome.runtime.sendMessage({
      message: "post_stats_data",
      data: { totalLikes, totalComments },
    });
  } catch (error) {
    console.error("Error fetching TikTok posts:", error);
    chrome.runtime.sendMessage({ message: "post_stats_error", error: "Failed to fetch TikTok stats." });
  }
}

async function fetchTikTokReelsStats(username) {
  // TikTok is video-first, so this might be redundant or use the same endpoint as posts
  // We will calculate average views (plays) here
  const url = `https://${TIKTOK_API_HOST}/api/user/posts?uniqueId=${username}&count=12`;
  const options = {
    method: "GET",
    headers: { "x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": TIKTOK_API_HOST },
  };

  try {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`TikTok Reels API failed: ${response.status}`);
    const result = await response.json();

    const videos = result.itemList || [];
    
    // Filter logic similar to Instagram (remove pinned if possible, etc)
    // For now, just take recent videos
    const recentVideos = videos.slice(0, 12);
    
    const totalPlays = recentVideos.reduce((sum, video) => sum + (video.stats?.playCount || 0), 0);
    const averagePlays = recentVideos.length > 0 ? (totalPlays / recentVideos.length) : 0;

    chrome.runtime.sendMessage({ 
      message: "reels_stats_data", 
      data: { averagePlays: averagePlays.toFixed(0) } 
    });
  } catch (error) {
    console.error("Error fetching TikTok views:", error);
    chrome.runtime.sendMessage({ message: "reels_stats_error", error: "Failed to fetch TikTok views." });
  }
}
// add to github