const os = require("os");
const fs = require("fs");
const path = require("path");

// Use /tmp on serverless environments (Vercel, AWS Lambda), local ./uploads for development
const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const UPLOADS_DIR = isServerless
  ? path.join(os.tmpdir(), "invitehub-uploads")
  : path.join(__dirname, "../../uploads");

// Possible paths for frontend static assets (/public/assets)
const PUBLIC_ASSET_DIRS = [
  path.join(__dirname, "../../../public"),
  path.join(__dirname, "../../../invitehub/public"),
  path.join(__dirname, "../../public"),
  path.join(process.cwd(), "public"),
  path.join(process.cwd(), "invitehub/public"),
];

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
 * Check if an image path or URL corresponds to a local file on disk
 * (either in the backend uploads folder or frontend public assets folder).
 * Returns the absolute local file path if found, or null otherwise.
 * @param {string} imagePathOrUrl
 * @returns {string|null}
 */
const findLocalFilePath = (imagePathOrUrl) => {
  if (!imagePathOrUrl || typeof imagePathOrUrl !== "string") {
    return null;
  }

  const trimmed = imagePathOrUrl.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return null;
  }

  // 1. Check if it references an uploaded file in UPLOADS_DIR
  const isUploadPath =
    trimmed.includes("/uploads/") ||
    trimmed.startsWith("uploads/") ||
    /^(template_|upload_|event_cover_|invitation_|snapshot_).*\.(png|jpe?g|webp|gif|svg|avif|heic)$/i.test(trimmed);

  if (isUploadPath) {
    const filename = path.basename(trimmed.split("?")[0].split("#")[0]);
    const candidatePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  // 2. Check if it references a static template asset (e.g. /assets/templates/birthday.jpg)
  if (trimmed.includes("/assets/") || trimmed.startsWith("assets/")) {
    const cleanPath = trimmed.split("?")[0].split("#")[0];
    const relativeAssetPath = cleanPath
      .replace(/^https?:\/\/[^/]+/i, "")
      .replace(/^\/+/, ""); // e.g. "assets/templates/birthday.jpg"
    
    for (const publicDir of PUBLIC_ASSET_DIRS) {
      const candidatePath = path.join(publicDir, relativeAssetPath);
      if (fs.existsSync(candidatePath)) {
        return candidatePath;
      }
    }
  }

  // 3. Fallback: check if the direct path exists on disk
  try {
    if (path.isAbsolute(trimmed) && fs.existsSync(trimmed)) {
      return trimmed;
    }
  } catch (_) {}

  return null;
};

/**
 * Extract Cloudinary credentials from CLOUDINARY_URL or explicit env vars
 */
const getCloudinaryConfig = () => {
  if (process.env.CLOUDINARY_URL) {
    try {
      const parsed = new URL(process.env.CLOUDINARY_URL);
      return {
        cloudName: parsed.hostname,
        apiKey: parsed.username,
        apiSecret: parsed.password,
      };
    } catch (_) {}
  }
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    return {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY || "",
      apiSecret: process.env.CLOUDINARY_API_SECRET || "",
      uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || "",
    };
  }
  return null;
};

/**
 * Upload a buffer or base64 to Cloudinary
 * @param {Buffer|string} fileBufferOrBase64
 * @param {string} [filename]
 * @param {string} [folder="invitehub"]
 * @returns {Promise<string|null>} Secure HTTPS URL or null
 */
const uploadToCloudinary = async (fileBufferOrBase64, filename = "image", folder = "invitehub") => {
  const config = getCloudinaryConfig();
  if (!config || !config.cloudName) return null;

  try {
    const crypto = require("crypto");
    const axios = require("axios");
    const timestamp = Math.floor(Date.now() / 1000);
    const endpoint = `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`;

    let fileData = fileBufferOrBase64;
    if (Buffer.isBuffer(fileBufferOrBase64)) {
      fileData = `data:image/png;base64,${fileBufferOrBase64.toString("base64")}`;
    }

    const payload = {
      file: fileData,
      folder,
    };

    if (config.apiKey && config.apiSecret) {
      const paramsToSign = `folder=${folder}&timestamp=${timestamp}${config.apiSecret}`;
      const signature = crypto.createHash("sha1").update(paramsToSign).digest("hex");
      payload.timestamp = timestamp;
      payload.api_key = config.apiKey;
      payload.signature = signature;
    } else if (config.uploadPreset) {
      payload.upload_preset = config.uploadPreset;
    } else {
      return null;
    }

    const res = await axios.post(endpoint, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    });

    if (res.data && res.data.secure_url) {
      console.log(`[FileStorage] Uploaded image to Cloudinary: ${res.data.secure_url}`);
      return res.data.secure_url;
    }
  } catch (err) {
    console.warn(`[FileStorage] Cloudinary upload failed: ${err.response?.data?.error?.message || err.message}`);
  }
  return null;
};

/**
 * Save an uploaded file buffer to public static storage.
 * If a cloud storage provider is configured, the returned URL will be the direct public CDN URL.
 * @param {Object} file - Multer file object { buffer, mimetype, originalname }
 * @param {Object} [req] - Express request object
 * @param {string} [prefix="upload"] - Filename prefix
 * @returns {{ success: boolean, url: string, fileUrl: string, filename: string, filePath: string }}
 */
const saveUploadedFile = async (file, req, prefix = "upload") => {
  if (!file || !file.buffer) {
    throw new Error("No file buffer provided for upload.");
  }

  // Attempt Cloudinary upload first if configured
  try {
    const cloudinaryUrl = await uploadToCloudinary(file.buffer, file.originalname || `${prefix}.png`);
    if (cloudinaryUrl) {
      return {
        success: true,
        filename: path.basename(cloudinaryUrl),
        filePath: "",
        url: cloudinaryUrl,
        fileUrl: cloudinaryUrl,
      };
    }
  } catch (e) {
    console.warn("[FileStorage] Cloudinary upload attempt error:", e.message);
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
    filePath,
    url: fileUrl,
    fileUrl,
  };
};

/**
 * Save a base64 encoded image string to public static storage
 * @param {string} base64String - Data URI or raw base64
 * @param {Object} [req] - Express request object
 * @param {string} [prefix="snapshot"] - Filename prefix
 * @returns {Promise<{ success: boolean, url: string, fileUrl: string, filename: string, filePath: string } | null>}
 */
const saveBase64Image = async (base64String, req, prefix = "snapshot") => {
  if (!base64String || typeof base64String !== "string") {
    return null;
  }

  const trimmed = base64String.trim();
  if (!trimmed) return null;

  // If it's already a full HTTP/HTTPS URL, return as is
  if (/^https?:\/\//i.test(trimmed)) {
    const localPath = findLocalFilePath(trimmed);
    return {
      success: true,
      filename: path.basename(trimmed),
      filePath: localPath || "",
      url: trimmed,
      fileUrl: trimmed,
    };
  }

  // Attempt direct Cloudinary upload for base64 if configured
  try {
    const cloudinaryUrl = await uploadToCloudinary(trimmed, `${prefix}.png`);
    if (cloudinaryUrl) {
      return {
        success: true,
        filename: path.basename(cloudinaryUrl),
        filePath: "",
        url: cloudinaryUrl,
        fileUrl: cloudinaryUrl,
      };
    }
  } catch (e) {
    console.warn("[FileStorage] Cloudinary base64 upload attempt error:", e.message);
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
  uploadToCloudinary,
  getCloudinaryConfig,
  getPublicBaseUrl,
  isValidPublicUrl,
  findLocalFilePath,
  UPLOADS_DIR,
  PUBLIC_ASSET_DIRS,
};
