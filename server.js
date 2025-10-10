// server.js (CommonJS - merged)

// Load env first
require("dotenv").config();

// Core & 3rd-party
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { OAuth2Client } = require("google-auth-library");

// Node fetch for CommonJS dynamic import
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// OpenAI client (CommonJS)
const OpenAI = require("openai");

// Models (assumes your model files export via module.exports)
const Itinerary = require("./models/Itinerary.js");
const Agent = require("./models/Agent.js");

// If your User/Feedback models are in separate files, you can require them instead of declaring below.
// But to preserve original code from server2, models are created inline below.

// App setup
const app = express();

// CORS: allow live-server plus general local dev. Adjust as needed.
app.use(cors({ origin: ["http://127.0.0.1:5500", "http://localhost:3000", "http://localhost:5500"] }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Config
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "changeme";

// ---------------------- MONGODB ----------------------
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ Mongo error:", err.message));
mongoose.connection.once("open", () => {
  console.log("✅ MongoDB connection is open");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error:", err);
});

  

// ---------------------- MODELS (server2's inline models) ----------------------
// If you already have User/Feedback models in separate files, remove these and require those files instead.
const { Schema } = mongoose;

const userSchema = new Schema({
  email: { type: String, unique: true },
  password: String,
  name: String,
  googleId: String,
  verified: { type: Boolean, default: false },
  verificationCode: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date
});
const User = mongoose.model("User", userSchema);

const feedbackSchema = new Schema({
  name: String,
  email: String,
  feedback: String,
  date: { type: Date, default: Date.now }
});
const Feedback = mongoose.model("Feedback", feedbackSchema);

// ---------------------- TRANSPORTERS / CLIENTS ----------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------------- ROUTES FROM SERVER 1: Itinerary, Agents, etc. ----------------------

// MAIN Itinerary API — combines Weather, Events, Attractions
 app.post("/api/itinerary", async (req, res) => {
  const { destination, startDate, endDate } = req.body;

  if (!destination || !startDate || !endDate) {
    return res.status(400).json({ success: false, error: "Destination, startDate, and endDate are required" });
  }

  console.log(`📅 Creating itinerary for ${destination} from ${startDate} to ${endDate}`);

  try {
    // --- 1️⃣ WEATHER ---
    let weather = [];
    try {
      const wRes = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(destination)}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`
      );
      const wData = await wRes.json();
      console.log("OpenWeather Response:", wData);

      if (wData.list && Array.isArray(wData.list)) {
        weather = wData.list
          .filter((_, idx) => idx % 8 === 0)
          .map(item => ({
            date: item.dt_txt.split(" ")[0],
            temp: Number(item.main.temp).toFixed(1),
            description: item.weather[0].description
          }));
      }
    } catch (err) {
      console.warn("⚠️ Weather API failed:", err.message);
    }

    if (!weather.length) weather = [{ date: startDate, temp: "20°C", description: "clear sky" }];

    // --- 2️⃣ EVENTS ---
    let events = [];
    try {
      const startISO = new Date(startDate).toISOString();
      const endISO = new Date(endDate).toISOString();

      const eRes = await fetch(
        `https://app.ticketmaster.com/discovery/v2/events.json?city=${encodeURIComponent(destination)}&startDateTime=${startISO}&endDateTime=${endISO}&apikey=${process.env.TICKETMASTER_API_KEY}`
      );
      const eData = await eRes.json();
      console.log("Ticketmaster Response:", eData);

      if (eData._embedded?.events?.length) {
        events = eData._embedded.events.map(ev => ({
          name: ev.name,
          date: ev.dates.start.localDate || startDate,
          venue: ev._embedded?.venues?.[0]?.name || "Unknown Venue"
        }));
      }
    } catch (err) {
      console.warn("⚠️ Events API failed:", err.message);
    }

    if (!events.length) events = [{ name: "Free evening — relax or explore!", date: startDate, venue: "" }];

    // --- 3️⃣ ATTRACTIONS ---
    let attractions = [];
    try {
      const geoRes = await fetch(
        `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(destination)}&apiKey=${process.env.GEOAPIFY_API_KEY}`
      );
      const geoData = await geoRes.json();
      console.log("GeoData:", geoData);

      if (geoData.features && geoData.features.length > 0) {
        const { lon, lat } = geoData.features[0].properties;
        const placesRes = await fetch(
          `https://api.geoapify.com/v2/places?categories=tourism.sights,tourism.attraction&filter=circle:${lon},${lat},20000&limit=10&apiKey=${process.env.GEOAPIFY_API_KEY}`
        );
        const placesData = await placesRes.json();
        console.log("PlacesData:", placesData);

        if (placesData.features && placesData.features.length > 0) {
          attractions = placesData.features.map(p => ({
            name: p.properties.name || "Unnamed Attraction",
            address: p.properties.address_line2 || p.properties.address_line1 || "Address not available"
          }));
        }
      }
    } catch (err) {
      console.warn("Attraction API error:", err.message);
    }

    if (attractions.length === 0) attractions = [
      { name: "Visit local markets", address: "" },
      { name: "Explore city landmarks", address: "" },
      { name: "Check out a local museum", address: "" }
    ];

    // --- 4️⃣ DAY-WISE ITINERARY ---
    const start = new Date(startDate);
    const end = new Date(endDate);
    const numDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    const dailyPlan = [];
    for (let i = 0; i < numDays; i++) {
      const day = new Date(start.getTime() + i * 24 * 60 * 60 * 1000); // add i days safely
      const dateStr = day.toISOString().split("T")[0];

      const w = weather.find(x => x.date === dateStr) || weather[i % weather.length];
      const attraction = attractions[i % attractions.length];
      const todaysEvents = events.filter(e => e.date === dateStr);

      dailyPlan.push({
        day: i + 1,
        date: dateStr,
        weather: w ? `${w.temp}°C, ${w.description}` : "No data",
        attraction: attraction?.name || "Explore local markets",
        event: todaysEvents.length ? todaysEvents.map(e => `${e.name} at ${e.venue}`) : ["Free evening — relax or explore!"]
      });
    }

    console.log("Generated dailyPlan:", dailyPlan);

    // --- 5️⃣ SAVE ITINERARY ---
    const itinerary = new Itinerary({
      location: destination,
      description: `Day-wise trip from ${startDate} to ${endDate}`,
      startDate,
      endDate
    });
    await itinerary.save();

    res.json({ success: true, destination, startDate, endDate, days: dailyPlan });
  } catch (err) {
    console.error("🔥 Itinerary generation error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});




    

// Other routes from server1
app.get("/api/agents", async (req, res) => {
  const agents = await Agent.find();
  res.json(agents);
});

app.get("/api/itinerary", async (req, res) => {
  const itineraries = await Itinerary.find().populate("agents");
  res.json(itineraries);
});

// One-time: populate default agents
app.get("/api/populateAgents", async (req, res) => {
  try {
    await Agent.deleteMany({});
    await Agent.insertMany([
      { name: "Sky Gazer", title: "Vistas & Scenic Views", description: "Finds scenic viewpoints", image: "skygazer.png" },
      { name: "Trailblazer", title: "Adventure & Trekking", description: "Explores trails", image: "trailblazer.png" },
      { name: "Quartermaster", title: "Culture & Food", description: "Uncovers local heritage", image: "quartermaster.png" },
      { name: "Orchestrator", title: "Festivals & Events", description: "Finds unique festivals", image: "orchestrator.png" }
    ]);
    res.send("✅ Agents populated successfully!");
  } catch (err) {
    res.status(500).send("❌ " + err.message);
  }
});

// ---------------------- ROUTES FROM SERVER 2: AUTH, FEEDBACK, OPENAI, PHOTOS, EVENTS ----------------------

// Homepage / static served above
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Send Verification Code
app.post("/send-code", async (req, res) => {
  try {
    const { email } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    let user = await User.findOne({ email });
    if (!user) user = new User({ email, verificationCode: code });
    else user.verificationCode = code;

    await user.save();

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Naviora Verification Code",
      text: `Your verification code is: ${code}`
    });

    res.json({ msg: "Verification code sent!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error sending code" });
  }
});

// Verify Code
app.post("/verify-code", async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "Email not found" });
    if (user.verificationCode !== code) return res.status(400).json({ msg: "Invalid verification code" });
    res.json({ msg: "Code verified!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error verifying code" });
  }
});

// Signup
app.post("/signup", async (req, res) => {
  try {
    const { email, name, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "Email not found" });

    const hashedPassword = await bcrypt.hash(password, 10);
    user.name = name;
    user.password = hashedPassword;
    user.verified = true;
    user.verificationCode = null;
    await user.save();

    res.json({ msg: "Signup successful!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: err.message });
  }
});

// Login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "User not found" });
    if (!user.verified) return res.status(400).json({ msg: "Email not verified" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid password" });

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1h" });
    res.json({ msg: "Login successful!", token, user: { name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Google Login
app.post("/google-login", async (req, res) => {
  const { credential } = req.body;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, name, googleId, verified: true });
      await user.save();
    }

    const jwtToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1h" });
    res.json({ msg: "Google login successful", token: jwtToken, user: { name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(400).json({ msg: "Google login failed" });
  }
});

// Forgot Password
app.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "User not found" });

    const token = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetURL = `http://localhost:${PORT}/reset-password.html?token=${token}`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset Request",
      text: `You requested a password reset. Click the link: ${resetURL}`
    });

    res.json({ msg: "Password reset link sent!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error sending reset email" });
  }
});

// Reset Password
app.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ msg: "Invalid or expired token" });

    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ msg: "Password reset successful!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error resetting password" });
  }
});

// FEEDBACK routes
app.post("/feedback", async (req, res) => {
  try {
    const newFeedback = new Feedback(req.body);
    await newFeedback.save();
    res.json({ message: "Feedback submitted successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Error saving feedback" });
  }
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin-login.html"));
});

app.post("/admin/login", (req, res) => {
  const { password } = req.body;
  if (password === "Admin123") return res.json({ success: true });
  return res.status(401).json({ success: false, message: "Invalid password" });
});

app.get("/api/feedbacks", async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort({ date: -1 });
    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ message: "Error fetching feedbacks" });
  }
});

app.delete("/api/feedbacks/:id", async (req, res) => {
  try {
    await Feedback.findByIdAndDelete(req.params.id);
    res.json({ message: "Feedback deleted successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting feedback" });
  }
});

// Unsplash Photos
app.get("/api/photos", async (req, res) => {
  try {
    const query = req.query.q || "travel";
    const orientation = req.query.orientation || "landscape";
    const count = req.query.count || 1;

    const url = `https://api.unsplash.com/search/photos?page=1&per_page=${count}&query=${encodeURIComponent(query)}&orientation=${orientation}`;

    const response = await fetch(url, {
      headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` }
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("❌ Unsplash Error:", err);
    res.status(500).json({ error: "Photo fetch failed" });
  }
});

// Eventbrite Events
app.get("/api/events", async (req, res) => {
  try {
    const query = req.query.q || "festival";
    const location = req.query.location ? `&location.address=${encodeURIComponent(req.query.location)}` : "";
    const url = `https://www.eventbriteapi.com/v3/events/search/?q=${encodeURIComponent(query)}${location}&expand=venue&sort_by=date&start_date.range_start=${new Date().toISOString()}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.EVENTBRITE_TOKEN}` }
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("❌ Eventbrite Error:", err);
    res.status(500).json({ error: "Events fetch failed" });
  }
});

// OpenAI Tourist Spots
app.get("/api/spots/:city", async (req, res) => {
  try {
    const city = req.params.city;

    const prompt = `
      You are a travel recommender. List popular tourist spots for the city "${city}". 
      For each spot, provide:
        - name
        - a one-line reason to visit
        - kind (e.g., 'Historical Site', 'Museum', 'Park')
      Output ONLY a JSON array of objects like:
      [
        { "name": "Spot Name", "reason": "Reason to visit", "kind": "Type" }
      ]
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
    });

    let aiResponseContent = completion.choices[0].message.content;

    // Remove ```json or ``` formatting
    aiResponseContent = aiResponseContent.replace(/```json|```/g, "").trim();

    let spotsData;
    try {
      spotsData = JSON.parse(aiResponseContent);
      if (!Array.isArray(spotsData)) {
        const keys = Object.keys(spotsData);
        for (const key of keys) {
          if (Array.isArray(spotsData[key])) {
            spotsData = spotsData[key];
            break;
          }
        }
      }
    } catch (e) {
      console.error("Failed to parse AI JSON response:", aiResponseContent, e);
      spotsData = [];
    }

    if (!Array.isArray(spotsData)) spotsData = [];

    const enrichedSpots = spotsData.map((spot) => ({
      name: spot.name,
      kind: spot.kind,
      dist: Math.floor(Math.random() * 5000) + 500,
      reason: spot.reason,
    }));

    res.json(enrichedSpots);
  } catch (err) {
    console.error("❌ Tourist Spots Fetch Error:", err);
    res.status(500).json({ error: "Failed to fetch tourist spots" });
  }
});

// OpenAI Chat
app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body.message || "";
    const prompt = `
      You are a friendly travel assistant. Suggest 3 destinations based on this query: "${userMessage}". 
      For each destination, give a one-line reason and a recommended local event or activity.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
    });

    let replyContent = completion.choices[0].message.content;
    // Remove any markdown formatting
    replyContent = replyContent.replace(/```/g, "").trim();

    res.json({ reply: replyContent });
  } catch (err) {
    console.error("❌ OpenAI Chat Error:", err);
    res.status(500).json({ error: "AI chat failed" });
  }
});

// ---------------------- START SERVER ----------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
