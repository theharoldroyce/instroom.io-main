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

  let followersCountForEngagement = null; // Store followers count for engagement calculation

  function displayProfileData(data) {

    loadingDiv.style.display = "none";
    profileDataDiv.style.display = "block";
    usernameSpan.textContent = data.username || "N/A";
    emailSpan.textContent = data.email || "N/A";
    followersSpan.textContent = data.followers_count || "N/A";
    locationSpan.textContent = data.location || "N/A";
    engagementRateSpan.textContent = data.engagement_rate || "N/A";

  
    // Store followers count for engagement rate calculation
    followersCountForEngagement = parseInt(
      (data.followers_count || "0").toString().replace(/,/g, ""),
      10
    );

    // After displaying profile data, request post stats
    if (data.username) {
      chrome.runtime.sendMessage({ message: "get_post_stats", username: data.username });
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
    avgLikes = (data.totalLikes / POST_COUNT).toFixed(2);
    avgComments = (data.totalComments / POST_COUNT).toFixed(2);
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

  function displayError(message) {
    loadingDiv.style.display = "none";
    errorDiv.textContent = message;
    errorDiv.style.display = "block";
  }

  // Send a message to the content script to get the URL.
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { message: "get_profile_url" });
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
      displayPostStats({ totalLikes: "Error", totalComments: "Error" });
    }
  });
});
