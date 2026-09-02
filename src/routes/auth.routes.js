const express = require("express");
const router = express.Router();
const { register, login, logout, me, googleLogin, googleCallback, googleMobileLogin, resetPasswordDirect, sendOtp, verifyOtpReset } = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Public routes
router.post("/register", register);
router.post("/signup", register); // Alias for signup

router.post("/login", login);
router.post("/signin", login); // Alias for signin

router.post("/logout", logout);
router.post("/signout", logout); // Alias for signout

router.post("/reset-password", resetPasswordDirect);         // Standard route
router.post("/reset-password-direct", resetPasswordDirect); // Alias

// Google Auth (Web & Mobile)
router.get("/google", googleLogin);
router.get("/google/callback", googleCallback);
router.post("/google/mobile", googleMobileLogin);       // Mobile App Google Login
router.post("/google-mobile", googleMobileLogin);       // Convenient alias


// Protected routes
router.get("/me", authMiddleware, me);
router.get("/session", authMiddleware, me); // Alias for session

router.post("/send-otp", sendOtp);
router.post("/verify-otp-reset", verifyOtpReset);

module.exports = router;
