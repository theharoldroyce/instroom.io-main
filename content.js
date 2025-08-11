
// content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "get_profile_url") {
      const profileUrl = window.location.href;
      const userId = getUserIdFromPage();
      chrome.runtime.sendMessage({
        message: "profile_url",
        url: profileUrl,
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
  

  