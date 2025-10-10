document.getElementById('planning-form').addEventListener('submit', async function(event) {
    event.preventDefault();

    const destination = document.getElementById('destination').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    const output = document.getElementById('final-itinerary-output');
    output.style.display = 'block';
    output.innerHTML = `<h2>Generating Itinerary...</h2>
        <p style="text-align:center;">Please wait while our specialized agents collaborate...</p>
        <div style="text-align:center;margin-top:20px;">
            <i class="fas fa-spinner fa-spin fa-2x" style="color:#00f0ff;"></i>
        </div>`;

    try {
        const res = await fetch("http://localhost:5000/api/itinerary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ destination, startDate, endDate }),
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || `Server Error: ${res.status} ${res.statusText}`);
        }

        // Render the itinerary using 'days' array
        output.innerHTML = `
            <h2>✨ Your Custom Itinerary for ${data.destination}</h2>
            <p>Travel Dates: <strong>${data.startDate} → ${data.endDate}</strong></p>

            <div class="itinerary-list">
                ${data.days.map(day => `
                    <div class="day-plan">
                        <div class="day-number">Day ${day.day} (${day.date})</div>
                        <div class="destination-card">
                            <div class="destination-name">Attraction: ${day.attraction}</div>
                            <p>Weather: ${day.weather}</p>
                            <p>Events: ${day.event.join(", ")}</p>
                        </div>
                    </div>
                `).join("")}
            </div>
        `;
    } catch (err) {
        console.error("Error generating itinerary:", err);
        output.innerHTML = `<p style="color:red; text-align:center; padding: 20px;">
            ❌ Failed to generate itinerary. <br>
            Error: <strong>${err.message}</strong><br>
            Please check that your backend server is running and all API keys are valid.
        </p>`;
    }
});
