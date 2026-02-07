// content.js

function waitForElement(selector, fallbackSelector) {
  return new Promise(resolve => {
    const mainElement = document.querySelector(selector);
    if (mainElement) {
      return resolve(mainElement);
    }
    if (fallbackSelector) {
        const fallbackElement = document.querySelector(fallbackSelector);
        if(fallbackElement) return resolve(fallbackElement);
    }

    const observer = new MutationObserver(mutations => {
        const mainElement = document.querySelector(selector);
        if (mainElement) {
            resolve(mainElement);
            observer.disconnect();
        } else if (fallbackSelector) {
            const fallbackElement = document.querySelector(fallbackSelector);
            if(fallbackElement) {
                resolve(fallbackElement);
                observer.disconnect();
            }
        }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

// Keep this listener for communication with the sidebar iframe
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "get_profile_url") {
      (async () => {
        const profileUrl = window.location.href;
        const profilePicUrl = await getProfilePicUrlFromPage();
        const userId = getUserIdFromPage();
        const username = getUsernameFromUrl();
        chrome.runtime.sendMessage({
          message: "profile_url",
          url: profileUrl,
          profilePicUrl: profilePicUrl,
          userId: userId,
          username: username,
        });
      })();
      return true; // Indicates that the response is sent asynchronously
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

  function showSidebar() {
    const iframeId = "instroom-sidebar-frame";
    let iframe = document.getElementById(iframeId);

    if (iframe) {
        // If it exists, reload it
        iframe.contentWindow.location.reload();
    } else {
        // If it doesn't exist, create it
        iframe = document.createElement("iframe");
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

  // This is the part that will automatically show/hide the sidebar
  function handlePageChange() {
    if (isProfilePage()) {
      showSidebar();
    } else {
      closeSidebar();
    }
  }

  // Run on initial load
  handlePageChange();

  // And run on URL changes
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      handlePageChange();
    }
  }).observe(document, { subtree: true, childList: true });


  function getUsernameFromUrl() {
    const path = window.location.pathname;
    const segments = path.split('/').filter(segment => segment.length > 0);
    if (segments.length === 1) {
        const reservedWords = ['home', 'explore', 'reels', 'stories', 'p', 'tv', 'direct', 'accounts', 'developer', 'about', 'legal', 'create', 'saved', 'api'];
        if (!reservedWords.includes(segments[0].toLowerCase())) {
            return segments[0];
        }
    }
    return null;
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
    
    if (segments.length !== 1) {
      return false;
    }
    
    const reservedWords = ['home', 'explore', 'reels', 'stories', 'p', 'tv', 'direct', 'accounts', 'developer', 'about', 'legal', 'create', 'saved', 'api'];
    
    if (reservedWords.includes(segments[0].toLowerCase())) {
      return false;
    }
    
    return true;
  }

  async function getProfilePicUrlFromPage() {
    try {
      const imgElement = await waitForElement('img[data-testid="user-avatar"]', 'main header img');
      if (imgElement) {
        // Sometimes the src is a 1x1 pixel or placeholder, wait a moment for the real src
        await new Promise(resolve => setTimeout(resolve, 100));
        return imgElement.src;
      }
    } catch (e) {
      console.error("Error extracting profile picture URL:", e);
    }
    return null;
  }