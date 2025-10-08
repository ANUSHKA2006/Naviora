const searchInput = document.getElementById("searchInput");
const compareList = document.getElementById("compareList");
const aiSuggest = document.getElementById("aiSuggest");
const eventsList = document.getElementById("eventsList");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");
const chatLog = document.getElementById("chatLog");
const moodRow = document.getElementById("moodRow");
const bgVideo = document.getElementById("bg-video");

// --- Moods Data ---
const moods = ["beach", "mountains", "city", "desert", "forest", "historical", "adventure", "relaxing"];

// Default number of spots to fetch
let spotsCount = 6; // You can change this dynamically if needed

// --- Initialize Mood Pills ---
function initializeMoodPills() {
  moodRow.innerHTML = '';
  moods.forEach(mood => {
    const pill = document.createElement("span");
    pill.className = "mood-pill";
    pill.textContent = mood.charAt(0).toUpperCase() + mood.slice(1);
    pill.addEventListener("click", () => {
      searchInput.value = mood;
      handleSearch(mood, spotsCount);
    });
    moodRow.appendChild(pill);
  });
}

// --- Dynamic Background Changer ---
async function setDynamicBackground(query) {
  try {
    const currentBgQuery = bgVideo.dataset.query;
    if (currentBgQuery === query) return;

    bgVideo.style.opacity = 0;

    const imageRes = await fetch(`/api/photos?q=${query}&orientation=landscape&count=1`);
    const imageData = await imageRes.json();

    if (imageData.results && imageData.results.length > 0) {
      const imageUrl = imageData.results[0].urls.full;
      let bgOverlay = document.getElementById('bg-image-overlay');
      if (!bgOverlay) {
        bgOverlay = document.createElement('div');
        bgOverlay.id = 'bg-image-overlay';
        document.body.prepend(bgOverlay);
      }
      bgOverlay.style.backgroundImage = `url(${imageUrl})`;
      bgOverlay.style.opacity = 1;
      bgVideo.dataset.query = query;
    } else {
      let bgOverlay = document.getElementById('bg-image-overlay');
      if (bgOverlay) bgOverlay.style.opacity = 0;
    }

    bgVideo.style.opacity = 1;
  } catch (err) {
    console.error("❌ Background update error:", err);
    let bgOverlay = document.getElementById('bg-image-overlay');
    if (bgOverlay) bgOverlay.style.opacity = 0;
    bgVideo.style.opacity = 1;
  }
}

// --- Core Search Function (with dynamic count) ---
async function handleSearch(query, count = 6) {
  setDynamicBackground(query);

  compareList.innerHTML = `<p>Loading AI-suggested tourist spots for ${query}...</p>`;
  eventsList.innerHTML = `<p>Loading events for ${query}...</p>`;

  try {
    const res = await fetch(`/api/spots/${query}?count=${count}`);
    const data = await res.json();

    if (data.error || !Array.isArray(data) || data.length === 0) {
      compareList.innerHTML = `<p>${data.error || "Could not generate spots. Try a different query."}</p>`;
    } else {
      compareList.innerHTML = "";
      const spotPromises = data.map(async (spot) => {
        try {
          const imgRes = await fetch(`/api/photos?q=${spot.name}+${spot.kind}+${query}&orientation=squarish&count=1`);
          const imgData = await imgRes.json();
          spot.image = imgData.results && imgData.results.length > 0
            ? imgData.results[0].urls.small
            : 'https://via.placeholder.com/260x140?text=No+Image';
        } catch (imgErr) {
          console.warn(`Could not fetch image for ${spot.name}:`, imgErr);
          spot.image = 'https://via.placeholder.com/260x140?text=Image+Error';
        }
        return spot;
      });

      const spotsWithImages = await Promise.all(spotPromises);

      spotsWithImages.forEach(spot => {
        const card = document.createElement("div");
        card.className = "compare-card";
        card.innerHTML = `
          <img src="${spot.image}" alt="${spot.name}">
          <div class="compare-meta">
            <div>
              <h3>${spot.name}</h3>
              <p>${spot.reason || 'Explore and discover!'}</p>
            </div>
          </div>
          <p class="card-footer-info">Type: ${spot.kind} | ${spot.dist} m away</p>
        `;
        compareList.appendChild(card);
      });
    }

    loadEvents(query);
  } catch (err) {
    compareList.innerHTML = `<p>Error loading spots from AI.</p>`;
    console.error(err);
  }
}

// ---- AI Suggest Button ----
aiSuggest.addEventListener("click", () => {
  const city = searchInput.value.trim();
  if (!city) return alert("Enter a place or mood to search!");
  handleSearch(city, spotsCount);
});

// ---- Load Events ----
async function loadEvents(city) {
  eventsList.innerHTML = `<p>Loading events for ${city}...</p>`;
  try {
    const res = await fetch(`/api/events?q=festival&location=${city}`);
    const data = await res.json();

    const events = data.events || [];
    eventsList.innerHTML = "";

    if (!events.length) {
      eventsList.innerHTML = `<p>No events found for ${city}</p>`;
      return;
    }

    events.forEach(ev => {
      const div = document.createElement("div");
      div.className = "event-item";

      const name = ev.name ? ev.name.text : 'Event Name Missing';
      const date = ev.start ? new Date(ev.start.local).toLocaleDateString() : 'Date Missing';
      const venue = ev.venue && ev.venue.name ? ev.venue.name : 'Unknown Venue';
      const url = ev.url || '#';

      div.innerHTML = `<strong>${name}</strong> - ${date} @ ${venue} <br> <a href="${url}" target="_blank">Details</a>`;
      eventsList.appendChild(div);
    });
  } catch (err) {
    eventsList.innerHTML = `<p>Error loading events</p>`;
    console.error(err);
  }
}

// ---- Chat Assistant ----
chatSend.addEventListener("click", async () => {
  const message = chatInput.value.trim();
  if (!message) return;

  const userDiv = document.createElement("div");
  userDiv.className = "chat-message user-message";
  userDiv.textContent = "You: " + message;
  chatLog.appendChild(userDiv);
  chatInput.value = "";

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });
    const data = await res.json();
    const aiDiv = document.createElement("div");
    aiDiv.className = "chat-message ai-message";
    aiDiv.textContent = "AI: " + data.reply;
    chatLog.appendChild(aiDiv);
    chatLog.scrollTop = chatLog.scrollHeight;
  } catch (err) {
    console.error(err);
    const errorDiv = document.createElement("div");
    errorDiv.className = "chat-message ai-message error-message";
    errorDiv.textContent = "AI: Sorry, an error occurred while fetching the response.";
    chatLog.appendChild(errorDiv);
    chatLog.scrollTop = chatLog.scrollHeight;
  }
});

// --- Initial Load ---
document.addEventListener("DOMContentLoaded", () => {
  initializeMoodPills();
  setDynamicBackground("travel");
});
