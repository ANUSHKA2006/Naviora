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

        output.innerHTML = `
            <h2>✨ Your Custom Itinerary for ${data.destination}</h2>
            <p>Travel Dates: <strong>${data.dateRange}</strong></p>

            <h3>🌦 5-Day Weather Forecast</h3>
            <ul>${(data.weather || []).map(w => 
                `<li>${w.date}: <strong>${w.temp}°C</strong> (${w.description})</li>`).join("")}</ul>

            <h3>🏛 Top Local Attractions (Sights, Museums, Parks)</h3>
            <ul>${(data.attractions || []).map(a => 
                `<li><strong>${a.name}</strong> - ${a.address}</li>`).join("")}</ul>

            <h3>🎉 Upcoming Events (Ticketmaster)</h3>
            ${(data.events || []).length > 0 ? 
                `<ul>${(data.events || []).map(e => 
                    `<li><strong>${e.name}</strong> on ${e.date} at ${e.venue}</li>`).join("")}</ul>` :
                `<p style="color:#ddd;">No major events found for your destination right now.</p>`
            }
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