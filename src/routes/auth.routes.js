const express = require("express");
const router = express.Router();
const { register, login, logout, me, googleLogin, googleCallback, resetPasswordDirect } = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Public routes
router.post("/register", register);
router.post("/signup", register); // Alias for signup

router.post("/login", login);
router.post("/signin", login); // Alias for signin

router.post("/logout", logout);
router.post("/signout", logout); // Alias for signout

router.post("/reset-password-direct", resetPasswordDirect);

router.get("/google", googleLogin);
router.get("/google/callback", googleCallback);


// Protected routes
router.get("/me", authMiddleware, me);
router.get("/session", authMiddleware, me); // Alias for session

module.exports = router;
