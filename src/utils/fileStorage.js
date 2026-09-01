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
 * Check if a URL is a valid, live public endpoint (not localhost or a placeholder).
 * @param {string} url
 * @returns {boolean}
 */
const isValidPublicUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return false;
  // Reject common placeholder domains
  if (
    trimmed.includes("your-backend.vercel.app") ||
    trimmed.includes("example.com") ||
    trimmed.includes("your-app") ||
    trimmed.includes("placeholder")
  ) {
    return false;
  }
  // Reject localhost / 127.0.0.1 — these are unreachable from external email clients
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return false;
    }
  } catch (_) {
    return false;
  }
  return true;
};

/** Track whether the localhost warning has already been printed this process */
let _localhostWarningLogged = false;

/**
 * Determine the public base URL for static uploads.
 * Prioritises cloud storage / CDN URLs, then public backend URLs, then request host.
 * Falls back to localhost with a clear dev console warning.
 * @param {Object} [req] - Express request object
 * @returns {string}
 */
const getPublicBaseUrl = (req) => {
  // 1. Cloud storage / CDN-specific env vars (highest priority)
  const cloudCandidates = [
    process.env.PUBLIC_STORAGE_URL,
    process.env.PUBLIC_CDN_URL,
    process.env.CLOUDINARY_URL,
    process.env.AWS_S3_PUBLIC_URL,
    process.env.SUPABASE_STORAGE_URL,
    process.env.FIREBASE_STORAGE_URL,
  ];
  for (const candidate of cloudCandidates) {
    if (isValidPublicUrl(candidate)) {
      return candidate.replace(/\/+$/, "");
    }
  }

  // 2. Public backend URLs (where /uploads are hosted), then app URLs
  const publicCandidates = [
    process.env.PUBLIC_BACKEND_URL,
    process.env.BACKEND_URL,
    process.env.PUBLIC_URL,
    process.env.PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.API_BASE_URL,
  ];
  for (const candidate of publicCandidates) {
    if (isValidPublicUrl(candidate)) {
      return candidate.replace(/\/api\/?$/i, "").replace(/\/+$/, "");
    }
  }

  // 3. Detect public tunnel (ngrok / Cloudflare) via request host header
  if (req && typeof req.get === "function") {
    const host = req.get("host") || "";
    const protocol = req.protocol || "http";
    if (
      host.includes("ngrok") ||
      host.includes("trycloudflare") ||
      host.includes(".loca.lt") ||
      (host && !host.startsWith("localhost") && !host.startsWith("127.0.0.1"))
    ) {
      return `${protocol}://${host}`.replace(/\/+$/, "");
    }
  }

  // 4. Localhost fallback — log a warning once
  if (!_localhostWarningLogged) {
    _localhostWarningLogged = true;
    console.warn(
      "\n⚠️  [FileStorage] WARNING: No public HTTPS backend URL configured.\n" +
      "   Image URLs will point to localhost which is UNREACHABLE from external email clients.\n" +
      "   To fix this, set one of these env vars to a live public endpoint:\n" +
      "     PUBLIC_BACKEND_URL, BACKEND_URL, PUBLIC_APP_URL, or use a tunnel (ngrok / Cloudflare).\n"
    );
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
    if (["png", "jpg", "jpeg", "webp", "gif", "svg", "heic", "heif", "avif", "pdf"].includes(ext)) {
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
    case "image/heic":
      return ".heic";
    case "image/heif":
      return ".heif";
    case "image/avif":
      return ".avif";
    case "application/pdf":
      return ".pdf";
    case "image/png":
    default:
      return ".png";
  }
};

/**
 * Save an uploaded file buffer to public static storage.
 * If a cloud storage provider is configured, the returned URL will be the direct public CDN URL.
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

  // Warn if the generated URL is a localhost link (won't work in email clients)
  try {
    const parsed = new URL(fileUrl);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      console.warn(`[FileStorage] ⚠️  Generated localhost image URL: ${fileUrl} — this will NOT render in email clients.`);
    }
  } catch (_) {}

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
