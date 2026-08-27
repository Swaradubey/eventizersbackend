const os = require("os");
const fs = require("fs");
const path = require("path");

// Use /tmp on serverless environments (Vercel, AWS Lambda), local ./uploads for development
const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const UPLOADS_DIR = isServerless
  ? path.join(os.tmpdir(), "invitehub-uploads")
  : path.join(__dirname, "../../uploads");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log(`[FileStorage] Created uploads directory: ${UPLOADS_DIR}`);
  } catch (err) {
    console.warn("[FileStorage] Could not create uploads directory:", err.message);
  }
}

/**
 * Determine the public base URL for static uploads
 * @param {Object} [req] - Express request object
 * @returns {string}
 */
const getPublicBaseUrl = (req) => {
  if (process.env.BACKEND_URL) {
    return process.env.BACKEND_URL.replace(/\/+$/, "");
  }
  if (process.env.API_BASE_URL) {
    return process.env.API_BASE_URL.replace(/\/+$/, "");
  }
  if (req && typeof req.get === "function") {
    const protocol = req.protocol || "http";
    const host = req.get("host") || "localhost:5000";
    return `${protocol}://${host}`.replace(/\/+$/, "");
  }
  return "http://localhost:5000";
};

/**
 * Determine file extension from mimetype or original filename
 * @param {string} mimetype
 * @param {string} [originalname]
 * @returns {string}
 */
const getFileExtension = (mimetype = "", originalname = "") => {
  if (originalname && originalname.includes(".")) {
    const ext = originalname.split(".").pop().toLowerCase();
    if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) {
      return `.${ext}`;
    }
  }
  switch (mimetype.toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/svg+xml":
      return ".svg";
    case "image/png":
    default:
      return ".png";
  }
};

/**
 * Save an uploaded file buffer to public static storage
 * @param {Object} file - Multer file object { buffer, mimetype, originalname }
 * @param {Object} [req] - Express request object
 * @param {string} [prefix="upload"] - Filename prefix
 * @returns {{ success: boolean, url: string, fileUrl: string, filename: string }}
 */
const saveUploadedFile = async (file, req, prefix = "upload") => {
  if (!file || !file.buffer) {
    throw new Error("No file buffer provided for upload.");
  }

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const ext = getFileExtension(file.mimetype, file.originalname);
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, "");
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 9);
  const filename = `${cleanPrefix}_${timestamp}_${randomStr}${ext}`;
  const filePath = path.join(UPLOADS_DIR, filename);

  await fs.promises.writeFile(filePath, file.buffer);

  const baseUrl = getPublicBaseUrl(req);
  const fileUrl = `${baseUrl}/uploads/${filename}`;

  return {
    success: true,
    filename,
    url: fileUrl,
    fileUrl,
  };
};

/**
 * Save a base64 encoded image string to public static storage
 * @param {string} base64String - Data URI or raw base64
 * @param {Object} [req] - Express request object
 * @param {string} [prefix="snapshot"] - Filename prefix
 * @returns {Promise<{ success: boolean, url: string, fileUrl: string, filename: string } | null>}
 */
const saveBase64Image = async (base64String, req, prefix = "snapshot") => {
  if (!base64String || typeof base64String !== "string") {
    return null;
  }

  const trimmed = base64String.trim();
  if (!trimmed) return null;

  // If it's already a full HTTP/HTTPS URL, return as is
  if (/^https?:\/\//i.test(trimmed)) {
    return {
      success: true,
      filename: path.basename(trimmed),
      url: trimmed,
      fileUrl: trimmed,
    };
  }

  let mimeType = "image/png";
  let cleanBase64 = trimmed;

  if (trimmed.startsWith("data:")) {
    const mimeMatch = trimmed.match(/^data:([a-zA-Z0-9/+-]+);base64,/);
    if (mimeMatch && mimeMatch[1]) {
      mimeType = mimeMatch[1];
    }
    cleanBase64 = trimmed.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, "");
  }

  cleanBase64 = cleanBase64.replace(/\s+/g, "");
  const buffer = Buffer.from(cleanBase64, "base64");
  if (!buffer || buffer.length === 0) {
    return null;
  }

  return saveUploadedFile({ buffer, mimetype: mimeType, originalname: `${prefix}.png` }, req, prefix);
};

module.exports = {
  saveUploadedFile,
  saveBase64Image,
  getPublicBaseUrl,
  UPLOADS_DIR,
};
