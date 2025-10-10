const mongoose = require("mongoose");

const ItinerarySchema = new mongoose.Schema({
  location: { type: String, required: true },
  description: String,
  startDate: String,   // <-- Add this
  endDate: String,     // <-- Add this
  agents: [{ type: mongoose.Schema.Types.ObjectId, ref: "Agent" }]
});

module.exports = mongoose.model("Itinerary", ItinerarySchema);
