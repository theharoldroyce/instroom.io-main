
// content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
    }
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
      // This selector targets the main profile image on an Instagram profile page.
      // It's more robust than a very specific path.
      const imgElement = document.querySelector('main header img');
      if (imgElement) {
        return imgElement.src;
      }
    } catch (e) {
      console.error("Error extracting profile picture URL:", e);
    }
    return null;
  }
