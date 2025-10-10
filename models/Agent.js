const mongoose = require("mongoose");

const   AgentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  title: String,
  description: String,
  image: String
});

module.exports = mongoose.model("Agent", AgentSchema);
