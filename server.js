require('dotenv').config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { OAuth2Client } = require("google-auth-library");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(express.json());
app.use(cors());

// ----------------------------------------------------
// ✅ CORRECTED: Serve static files from the 'public' directory.
// This line automatically handles serving index.html for the root path ('/').
// ----------------------------------------------------
app.use(express.static(path.join(__dirname, "public"))); 

const PORT = process.env.PORT || 5000;

// -----------------------------
// MongoDB connection
// -----------------------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log(err));

// -----------------------------
// User Schema & Model
// -----------------------------
const userSchema = new mongoose.Schema({
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

const JWT_SECRET = process.env.JWT_SECRET;

// -----------------------------
// Nodemailer Transporter
// -----------------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// -----------------------------
// Google OAuth Client
// -----------------------------
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// -----------------------------
// Routes
// -----------------------------

// *** The redundant app.get("/") route was removed here. ***

// --- Signup Step 1: Send Verification Code ---
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

// --- Signup Step 2: Verify code ---
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

// --- Signup Step 3: Complete signup ---
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

// --- Login ---
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

// --- Google Login ---
app.post("/google-login", async (req, res) => {
  const { credential } = req.body;
  try {
    const ticket = await client.verifyIdToken({
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

// --- Forgot Password ---
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
      text: `You requested a password reset. Click the link to reset: ${resetURL}`
    });

    res.json({ msg: "Password reset link sent to your email!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error sending reset email" });
  }
});

// --- Reset Password ---
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

// -----------------------------
// Start server
// -----------------------------
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));