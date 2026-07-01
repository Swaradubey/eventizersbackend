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


const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Missing fields check
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Please provide name, email, and password." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ error: "Invalid email format." });
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

module.exports = {
  register,
  login,
  logout,
  me,
};
