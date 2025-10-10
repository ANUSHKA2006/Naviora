// --- Helper Functions ---
const formatDuration = (hours) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
};

const showMessageBox = (message, type='Error') => {
    const titleEl = document.getElementById('messageTitle');
    const buttonEl = document.querySelector('#messageBox button');

    titleEl.textContent = type;
    document.getElementById('messageContent').textContent = message;

    document.getElementById('messageBox').classList.remove('hidden');
    document.getElementById('messageBox').classList.add('flex');
};

const hideMessageBox = () => {
    document.getElementById('messageBox').classList.add('hidden');
    document.getElementById('messageBox').classList.remove('flex');
};

// Simulate travel data (can replace with real API later)
const generateTravelData = async (origin, destination) => {
    return [
        { mode:'Flight', name:'SkyJet 101', cost:300, durationHours:5.5, distanceKm:4500, avgSpeed:818, desc:'Fastest route' },
        { mode:'Train', name:'Coast-to-Coast Express', cost:120, durationHours:50, distanceKm:4500, avgSpeed:90, desc:'Comfortable overnight travel' },
        { mode:'Bus', name:'InterCity Bus', cost:90, durationHours:60, distanceKm:4500, avgSpeed:75, desc:'Budget-friendly' }
    ];
};

// Main search
const searchTravel = async (e) => {
    e.preventDefault();

    const origin = document.getElementById('origin').value.trim();
    const destination = document.getElementById('destination').value.trim();
    const date = document.getElementById('date').value;

    if(!origin || !destination || !date) return showMessageBox("Please fill all fields");

    const searchButton = document.getElementById('searchButton');
    const loadingIndicator = document.getElementById('loadingIndicator');

    searchButton.disabled = true;
    loadingIndicator.classList.remove('hidden');

    document.getElementById('optimizedPathCard').innerHTML = '';
    document.getElementById('comparisonCards').innerHTML = '';

    const data = await generateTravelData(origin, destination);

    loadingIndicator.classList.add('hidden');
    searchButton.disabled = false;

    if(!data || data.length===0) return showMessageBox("No travel options found.");

    const optimal = data.reduce((prev,curr)=> curr.cost<prev.cost ? curr: prev, data[0]);

    renderOptimizedPath(optimal, origin, destination);
    renderComparisonCards(data);
};

const renderOptimizedPath = (option, origin, destination) => {
    const iconMap = { 'Flight':'plane', 'Train':'train', 'Bus':'bus' };
    const icon = iconMap[option.mode] || 'map-pin';

    const html = `
        <div class="glass-card p-6 md:p-8 shadow-2xl rounded-xl text-white">
            <div class="flex items-center justify-between mb-4">
                <h2 class="text-3xl font-bold">🎯 Optimized Path</h2>
                <i data-lucide="${icon}" class="w-8 h-8"></i>
            </div>
            <p class="text-lg mb-4 opacity-90">${origin} → ${destination} via ${option.mode}</p>
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 border-t border-white border-opacity-30 pt-4">
                <div class="flex flex-col"><span class="text-sm opacity-75">Cost</span><span class="text-3xl font-extrabold">$${option.cost}</span></div>
                <div class="flex flex-col"><span class="text-sm opacity-75">Time</span><span class="text-3xl font-extrabold">${formatDuration(option.durationHours)}</span></div>
                <div class="flex flex-col"><span class="text-sm opacity-75">Distance</span><span class="text-3xl font-extrabold">${option.distanceKm} km</span></div>
                <div class="flex flex-col"><span class="text-sm opacity-75">Info</span><span>${option.desc}</span></div>
            </div>
        </div>
    `;
    document.getElementById('optimizedPathCard').innerHTML = html;
    lucide.createIcons();
};

const renderComparisonCards = (data) => {
    const container = document.getElementById('comparisonCards');
    container.innerHTML = '';

    data.forEach(opt=>{
        const iconMap = { 'Flight':'plane', 'Train':'train', 'Bus':'bus' };
        const icon = iconMap[opt.mode] || 'map-pin';
        const card = document.createElement('div');
        card.className = 'glass-card p-6 shadow-xl rounded-xl text-white';
        card.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <h3 class="text-2xl font-bold">${opt.mode}</h3>
                <i data-lucide="${icon}" class="w-6 h-6"></i>
            </div>
            <p>${opt.name}</p>
            <p>Cost: $${opt.cost}</p>
            <p>Time: ${formatDuration(opt.durationHours)}</p>
            <p>Distance: ${opt.distanceKm} km</p>
        `;
        container.appendChild(card);
    });
    lucide.createIcons();
};

// Event listener
document.getElementById('travelForm').addEventListener('submit', searchTravel);
