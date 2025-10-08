document.addEventListener("DOMContentLoaded", async () => {
  const container = document.querySelector(".agents-container"); // Note: Corrected class from agent-container to agents-container

  // NOTE: Ensure your server is running on port 5000 (as defined in server.js)
  try {
    const res = await fetch("http://localhost:5000/api/agents");
    if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
    }
    const agents = await res.json();

    container.innerHTML = agents.map(agent =>       
      // The template for a dynamic card
      `<div class="agent-card">
        <img src="${agent.image}" alt="${agent.name}" />
        <h2>${agent.name}</h2>
        <h4>${agent.title || 'Travel Specialist'}</h4>
        <p>${agent.description}</p>
        <button onclick="displayItinerary('${agent._id}')">View Itinerary Plan</button>
        
        <div class="itinerary-details" id="itinerary-${agent._id}" style="display:none; margin-top:15px; text-align:left;">
          <h5>Plan Snapshot:</h5>
          <p><strong>Location:</strong> ${agent.itinerary?.location || "N/A"}</p>
          <p><strong>Festivals:</strong> ${agent.itinerary?.festivals?.join(", ") || "None"}</p>
          <p><strong>Activities:</strong> ${agent.itinerary?.activities?.join(", ") || "N/A"}</p>
        </div>
      </div>`
    ).join("");
    
    // 3. Add the itinerary display function to the window scope
    window.displayItinerary = (agentId) => {
        const detailDiv = document.getElementById(`itinerary-${agentId}`);
        const button = document.querySelector(`.agent-card button[onclick="displayItinerary('${agentId}')"]`);
        
        if (detailDiv.style.display === 'none') {
            detailDiv.style.display = 'block';
            button.textContent = 'Hide Itinerary Plan';
        } else {
            detailDiv.style.display = 'none';
            button.textContent = 'View Itinerary Plan';
        }
    };


  } catch (err) {
    console.error("Error fetching agents:", err);
    container.innerHTML = `<p style="color: red; margin-top: 50px;">❌ Failed to load agents. Ensure your Express server is running on http://localhost:5000.</p>`;
  }
});