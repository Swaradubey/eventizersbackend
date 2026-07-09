const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authService = require("../services/auth.service");

// Helper function to generate token and set cookie
const sendTokenResponse = (user, statusCode, res, message = "Success") => {
  if (res.headersSent) {
    console.warn(`[WARN] sendTokenResponse attempted but headers were already sent to client. User ID: ${user.id}`);
    return;
  }
  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  const cookieOptions = {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  };

  const { password, ...userWithoutPassword } = user;

  res
    .status(statusCode)
    .cookie("token", token, cookieOptions)
    .json({
      success: true,
      message,
      user: userWithoutPassword,
      token,
    });
};


const validateAndFormatIndianMobile = (phone) => {
  if (!phone) return null;
  const cleaned = phone.trim().replace(/[\s\-()]/g, "");
  if (/^\+91[6-9]\d{9}$/.test(cleaned)) return cleaned;
  if (/^91[6-9]\d{9}$/.test(cleaned)) return `+${cleaned}`;
  if (/^0[6-9]\d{9}$/.test(cleaned)) return `+91${cleaned.slice(1)}`;
  if (/^[6-9]\d{9}$/.test(cleaned)) return `+91${cleaned}`;
  return null;
};

const register = async (req, res) => {
  try {
    const { name, email, phoneNumber, password } = req.body;

    // 1. Missing fields check
    if (!name || !email || !phoneNumber || !password) {
      return res.status(400).json({ error: "Please provide name, email, phone number, and password." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ error: "Invalid email format." });
    }

    // Phone format validation
    const formattedPhone = validateAndFormatIndianMobile(phoneNumber);
    if (!formattedPhone) {
      return res.status(400).json({ error: "Invalid Indian mobile number." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    // 2. Check if email already exists
    const existingUser = await authService.findUserByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(400).json({ error: "Email already exists." });
    }

    // 3. Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Create user
    const user = await authService.createUser({
      name,
      email: normalizedEmail,
      phoneNumber: formattedPhone,
      password: hashedPassword,
    });

    // 5. Send response with cookie
    return sendTokenResponse(user, 201, res, "Registration successful");
  } catch (error) {
    console.error("Register Error:", error);
    if (res.headersSent) {
      return;
    }
    return res.status(500).json({ error: "Server error during registration." });
  }
};


const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Missing fields check
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required.",
        message: "Email and password are required."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        error: "Invalid email format.",
        message: "Invalid email format."
      });
    }

    // 2. Find user in database
    const dbUser = await authService.findUserByEmail(normalizedEmail);
    if (!dbUser) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password.",
        message: "Invalid email or password."
      });
    }

    // 3. Check password match
    const isMatch = await bcrypt.compare(password, dbUser.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password.",
        message: "Invalid email or password."
      });
    }

    // 4. Send response with cookie
    console.log(`[DEBUG] Login successful. Sending dbUser token response for email: ${dbUser.email}`);
    return sendTokenResponse(dbUser, 200, res, "Login successful");
  } catch (error) {
    console.error("Login Error:", error);
    if (res.headersSent) {
      return;
    }
    return res.status(500).json({ error: "Server error during login." });
  }
};

/**
 * Logout user
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    res.cookie("token", "", {
      httpOnly: true,
      expires: new Date(0),
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    console.error("Logout Error:", error);
    if (res.headersSent) {
      return;
    }
    return res.status(500).json({ error: "Server error during logout." });
  }
};


const me = async (req, res) => {
  try {
    // req.user is populated by authMiddleware
    return res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    console.error("Get Profile Error:", error);
    if (res.headersSent) {
      return;
    }
    return res.status(500).json({ error: "Server error retrieving profile." });
  }
};


/**
 * Redirect user to Google OAuth consent page
 * GET /api/auth/google
 */
const googleLogin = (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.error("GOOGLE_CLIENT_ID is not configured in backend .env");
    return res.status(500).json({ error: "Google client ID is not configured on the backend." });
  }

  // Construct dynamic callback redirect URI or use environment variable
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  const redirectUri = process.env.GOOGLE_CALLBACK_URL || `${protocol}://${host}/api/auth/google/callback`;

  console.log(`[Google Auth] Initiating login. Redirect URI: ${redirectUri}`);

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent("profile email")}&prompt=select_account`;

  return res.redirect(googleAuthUrl);
};

/**
 * Handle Google OAuth callback
 * GET /api/auth/google/callback
 */
const googleCallback = async (req, res) => {
  const { code, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  if (error || !code) {
    console.error("Google OAuth error or missing code:", error);
    return res.redirect(`${frontendUrl}/login?error=Google%20authentication%20failed`);
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("Google client credentials are not configured in backend .env");
      return res.redirect(`${frontendUrl}/login?error=Google%20auth%20not%20configured%20on%20server`);
    }

    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const redirectUri = process.env.GOOGLE_CALLBACK_URL || `${protocol}://${host}/api/auth/google/callback`;

    console.log(`[Google Auth] Callback received. Exchange Redirect URI: ${redirectUri}`);

    // 1. Exchange auth code for access & ID tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Failed to exchange auth code for tokens:", errorText);
      return res.redirect(`${frontendUrl}/login?error=Google%20token%20exchange%20failed`);
    }

    const tokenData = await tokenResponse.json();

    // 2. Fetch user profile using access token
    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error("Failed to fetch Google profile info:", errorText);
      return res.redirect(`${frontendUrl}/login?error=Google%20profile%20fetch%20failed`);
    }

    const profile = await profileResponse.json();

    if (!profile.email) {
      return res.redirect(`${frontendUrl}/login?error=No%20email%20returned%20from%20Google`);
    }

    const normalizedEmail = profile.email.trim().toLowerCase();

    // 3. Find user or create them
    let user = await authService.findUserByEmail(normalizedEmail);
    if (!user) {
      // If user does not exist, create new user
      const crypto = require("crypto");
      const randomPassword = crypto.randomBytes(16).toString("hex");
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(randomPassword, salt);

      user = await authService.createUser({
        name: profile.name || normalizedEmail.split("@")[0],
        email: normalizedEmail,
        password: hashedPassword,
      });
      console.log(`[Google Auth] Created new user: ${user.email} (ID: ${user.id})`);
    } else {
      console.log(`[Google Auth] Logged in existing user: ${user.email} (ID: ${user.id})`);
    }

    // 4. Generate JWT token
    const token = jwt.sign(
      { id: user.id, role: "USER", isGoogleLogin: true },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Set cookie
    const cookieOptions = {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    };

    res.cookie("token", token, cookieOptions);
    return res.redirect(`${frontendUrl}/login-success?token=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error("Error in googleCallback:", err);
    return res.redirect(`${frontendUrl}/login?error=Server%20error%20during%20Google%20sign%20in`);
  }
};

const resetPasswordDirect = async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({
      success: false,
      message: "This endpoint is disabled in production"
    });
  }

  try {
    const { email, newPassword, confirmPassword } = req.body;

    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, new password and confirm password are required"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirm password do not match"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long."
      });
    }

    const user = await authService.findUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found"
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await authService.updateUserPassword(normalizedEmail, hashedPassword);

    return res.status(200).json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error) {
    console.error("Direct Password Reset Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to change password"
    });
  }
};

const otpStore = new Map(); // Store OTPs in memory for now.

const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await authService.findUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(404).json({ error: "No user found with this email." });
    }

    // Generate a 6-digit OTP or use 123456 as a default testing OTP
    const generatedOtp = "123456"; 
    
    // Store with 10 mins expiry
    otpStore.set(normalizedEmail, {
      otp: generatedOtp,
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    console.log(`[DEV ONLY] OTP for ${normalizedEmail} is ${generatedOtp}`);

    return res.status(200).json({ success: true, message: "OTP sent successfully." });
  } catch (error) {
    console.error("Send OTP Error:", error.message);
    return res.status(500).json({ error: "Server error sending OTP." });
  }
};

const verifyOtpReset = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: "Email, OTP and new password are required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const storedOtpData = otpStore.get(normalizedEmail);
    
    if (!storedOtpData) {
      return res.status(400).json({ error: "No OTP request found for this email." });
    }

    if (Date.now() > storedOtpData.expiresAt) {
      otpStore.delete(normalizedEmail);
      return res.status(400).json({ error: "OTP has expired. Please request a new one." });
    }

    if (storedOtpData.otp !== otp) {
      return res.status(400).json({ error: "Invalid OTP." });
    }

    const user = await authService.findUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    await authService.updateUserPassword(normalizedEmail, hashedPassword);
    
    // Clear OTP after success
    otpStore.delete(normalizedEmail);

    return res.status(200).json({ success: true, message: "Password updated successfully." });
  } catch (error) {
    console.error("Verify OTP Error:", error.message);
    return res.status(500).json({ error: "Server error during OTP verification." });
  }
};

module.exports = {
  register,
  login,
  logout,
  me,
  googleLogin,
  googleCallback,
  resetPasswordDirect,
  sendOtp,
  verifyOtpReset,
};
