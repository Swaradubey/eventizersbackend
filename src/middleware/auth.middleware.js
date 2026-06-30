const jwt = require("jsonwebtoken");
const authService = require("../services/auth.service");

/**
 * Middleware to verify JWT token and authenticate user
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Read token from cookie or Authorization header
    let token = req.cookies?.token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ error: "Access Denied. No token provided." });
    }

    // Verify token using JWT_SECRET env strictly (no hardcoded fallback)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user details from DB
    const user = await authService.findUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: "Access Denied. User not found." });
    }

    // Remove password from user object before attaching it
    const { password, ...userWithoutPassword } = user;
    req.user = userWithoutPassword;

    next();
  } catch (error) {
    if (res.headersSent) {
      return;
    }
    
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired. Please log in again." });
    }
    
    return res.status(401).json({ error: "Invalid or expired token." });
  }
};

module.exports = authMiddleware;
