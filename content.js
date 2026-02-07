
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
    } else if (request.message === "toggle_sidebar") {
      if (isProfilePage()) {
        toggleSidebar();
      } else {
        closeSidebar();
      }
    } else if (request.message === "url_changed") {
      if (!isProfilePage()) {
        closeSidebar();
      }
    }
  });

  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "resize_sidebar") {
      const iframe = document.getElementById("instroom-sidebar-frame");
      if (iframe) {
        iframe.style.height = event.data.height + "px";
      }
    }
  });

  function closeSidebar() {
    const iframeId = "instroom-sidebar-frame";
    const existingIframe = document.getElementById(iframeId);
    if (existingIframe) {
      existingIframe.remove();
    }
  }

  function toggleSidebar() {
    const iframeId = "instroom-sidebar-frame";
    const existingIframe = document.getElementById(iframeId);

    if (existingIframe) {
      existingIframe.remove();
    } else {
      const iframe = document.createElement("iframe");
      iframe.id = iframeId;
      iframe.src = chrome.runtime.getURL("instroom.html");
      iframe.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 400px;
        height: 650px;
        border: none;
        z-index: 2147483647;
        border-radius: 16px;
        background: transparent;
      `;
      document.body.appendChild(iframe);
    }
  }
  
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

  function isProfilePage() {
    const path = window.location.pathname;
    const segments = path.split('/').filter(segment => segment.length > 0);
    
    if (segments.length === 0) return false; // Root path
    
    const reservedWords = ['home', 'explore', 'reels', 'stories', 'p', 'tv', 'direct', 'accounts', 'developer', 'about', 'legal', 'create', 'saved', 'api'];
    
    if (reservedWords.includes(segments[0].toLowerCase())) {
      return false;
    }
    
    return true;
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
