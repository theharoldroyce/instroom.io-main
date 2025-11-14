// instroom.js
document.addEventListener("DOMContentLoaded", () => {
  const loadingDiv = document.getElementById("loading");
  const errorDiv = document.getElementById("error");
  const profileDataDiv = document.getElementById("profile-data");
  const usernameSpan = document.getElementById("username");
  const emailSpan = document.getElementById("email");
  const followersSpan = document.getElementById("followers");
  const locationSpan = document.getElementById("country");
  const engagementRateSpan = document.getElementById("engagement-rate");
  const averageLikesSpan = document.getElementById("average-likes");
  const averageCommentsSpan = document.getElementById("average-comments");
  const averageReelPlaysSpan = document.getElementById("average-reel-plays");
  const remainingCreditsSpan = document.getElementById("remaining-credits");
  const profileSection = document.querySelector(".profile-section");
  const profilePicImg = document.getElementById("profile-pic");

  let followersCountForEngagement = null; // Store followers count for engagement calculation

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

  function displayProfileData(data) {
    console.log("Full data object received in popup:", data);

    loadingDiv.style.display = "none";
    profileDataDiv.style.display = "block";
    usernameSpan.textContent = data.username || "N/A";
    emailSpan.textContent = data.email || "N/A";
    followersSpan.textContent = formatNumber(data.followers_count);
    locationSpan.textContent = data.location || "N/A";
    engagementRateSpan.textContent = data.engagement_rate || "N/A";
    
    console.log("profilePicUrl in popup:", data.profilePicUrl);
    if (data.profilePicUrl) {
      profilePicImg.src = data.profilePicUrl;
    } else {
      profilePicImg.src = "images/instroomLogo.png"; // Fallback to default logo
    }
  
    // Store followers count for engagement rate calculation
    profilePicImg.onerror = () => {
      console.error("Failed to load image:", profilePicImg.src);
    };

    followersCountForEngagement = parseInt(
      (data.followers_count || "0").toString().replace(/,/g, ""),
      10
    );

    // After displaying profile data, request post stats
    if (data.username) {
      // Add spinner before fetching post stats
      const spinnerHtml = '<div class="spinner"></div>';
      engagementRateSpan.innerHTML = spinnerHtml;
      averageLikesSpan.innerHTML = spinnerHtml;
      averageCommentsSpan.innerHTML = spinnerHtml;
      averageReelPlaysSpan.innerHTML = spinnerHtml;

      chrome.runtime.sendMessage({ message: "get_post_stats", username: data.username });
      chrome.runtime.sendMessage({ message: "get_reels_stats", username: data.username });
    }
  }

function displayPostStats(data) {
  const POST_COUNT = 12;
  // Calculate averages
  let avgLikes = "N/A";
  let avgComments = "N/A";
  if (
    typeof data.totalLikes === "number" &&
    typeof data.totalComments === "number"
  ) {
    avgLikes = formatNumber(Math.round(data.totalLikes / POST_COUNT));
    avgComments = formatNumber(Math.round(data.totalComments / POST_COUNT));
  }

  averageLikesSpan.textContent = avgLikes;
  averageCommentsSpan.textContent = avgComments;

  // Engagement rate calculation (as previously discussed)
  if (
    typeof data.totalLikes === "number" &&
    typeof data.totalComments === "number" &&
    followersCountForEngagement &&
    followersCountForEngagement > 0
  ) {
    const avgEngagement = (data.totalLikes + data.totalComments) / POST_COUNT;
    const engagementRate = (avgEngagement / followersCountForEngagement) * 100;
    engagementRateSpan.textContent = engagementRate.toFixed(2) + "%";
  }
}

  function displayReelsStats(data) {
    if (data.averagePlays) {
      // Use toLocaleString() to format the number with commas
      averageReelPlaysSpan.textContent = formatNumber(parseInt(data.averagePlays, 10));
    } else {
      averageReelPlaysSpan.textContent = "N/A";
    }
  }

  function displayError(message) {
    loadingDiv.style.display = "none";
    errorDiv.textContent = message;
    errorDiv.style.display = "block";
  }

  // On popup open, get credits and then trigger profile data fetch
  chrome.storage.local.get(["usageCount", "lastReset"], (result) => {
    const MAX_USAGE = 10;
    let usageCount = result.usageCount || 0;
    const remaining = MAX_USAGE - usageCount;
    remainingCreditsSpan.textContent = remaining;

    // Now, send a message to the content script to get the URL.
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { message: "get_profile_url" });
    });
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "profile_data") {
      displayProfileData(request.data);
    } else if (request.message === "profile_data_error") {
      displayError(request.error);
    } else if (request.message === "post_stats_data") {
      displayPostStats(request.data);
    } else if (request.message === "post_stats_error") {
      console.error("Error fetching post stats:", request.error);
      // Also handle reels error display
      displayReelsStats({ averagePlays: "Error" });
      displayPostStats({ totalLikes: "Error", totalComments: "Error" });
    } else if (request.message === "reels_stats_data") {
      displayReelsStats(request.data);
    } else if (request.message === "usage_limit_reached") {
      displayError(request.error);
      profileSection.innerHTML = `
        <div class="no-credits-message">
          <p>You've reached your monthly credit limit. To continue using all features, please upgrade your plan:</p>
          <a href="https://instroom-landing-page.vercel.app/" target="_blank">Subscribe</a>
        </div>
      `;
      // Optionally, hide the profile data section
      profileDataDiv.style.display = "none";

    } else if (request.message === "remaining_credits") {
      remainingCreditsSpan.textContent = request.remaining;
    }
  });
});
