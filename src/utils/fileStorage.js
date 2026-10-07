const os = require("os");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");

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

// Ensure uploads directory exists for local dev
if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch (err) {
    // Expected on read-only environments
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
  if (
    trimmed.includes("your-backend.vercel.app") ||
    trimmed.includes("example.com") ||
    trimmed.includes("your-app") ||
    trimmed.includes("placeholder")
  ) {
    return false;
  }
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

/**
 * Determine the public base URL for static uploads.
 * Prioritises cloud storage / CDN URLs, then public backend URLs, then request host.
 */
const getPublicBaseUrl = (req) => {
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

  const publicCandidates = [
    process.env.BACKEND_PUBLIC_URL,
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

  const isProduction = process.env.NODE_ENV === "production" || !!process.env.VERCEL;

  if (req && typeof req.get === "function") {
    const host = req.get("host") || "";
    const protocol = req.headers?.["x-forwarded-proto"] || req.protocol || (isProduction ? "https" : "http");
    if (
      host.includes("ngrok") ||
      host.includes("trycloudflare") ||
      host.includes(".loca.lt") ||
      (host && !host.startsWith("localhost") && !host.startsWith("127.0.0.1"))
    ) {
      return `${protocol}://${host}`.replace(/\/+$/, "");
    }
  }

  return isProduction ? "" : "http://localhost:5000";
};

/**
 * Determine file extension from mimetype or original filename
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
 */
const findLocalFilePath = (imagePathOrUrl) => {
  if (!imagePathOrUrl || typeof imagePathOrUrl !== "string") {
    return null;
  }
  const trimmed = imagePathOrUrl.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return null;
  }

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

  if (
    trimmed.includes("/templates/") ||
    trimmed.startsWith("templates/") ||
    trimmed.includes("/assets/") ||
    trimmed.startsWith("assets/") ||
    trimmed.includes("/images/") ||
    trimmed.startsWith("images/") ||
    trimmed.endsWith(".png") ||
    trimmed.endsWith(".svg") ||
    trimmed.endsWith(".jpg") ||
    trimmed.endsWith(".jpeg")
  ) {
    const cleanPath = trimmed.split("?")[0].split("#")[0];
    const relativeAssetPath = cleanPath
      .replace(/^https?:\/\/[^/]+/i, "")
      .replace(/^\/+/, "");
    
    for (const publicDir of PUBLIC_ASSET_DIRS) {
      const candidatePath = path.join(publicDir, relativeAssetPath);
      if (fs.existsSync(candidatePath)) {
        return candidatePath;
      }
      const filename = path.basename(cleanPath);
      const subdirs = ["", "templates", "templates/bridal", "templates/envelopes", "assets", "assets/templates", "images"];
      for (const sub of subdirs) {
        const subCandidate = path.join(publicDir, sub, filename);
        if (fs.existsSync(subCandidate)) {
          return subCandidate;
        }
      }
    }
  }

  try {
    if (fs.existsSync(trimmed)) {
      return trimmed;
    }
  } catch (_) {}

  return null;
};

// ==========================================
// 1. CLOUDINARY STORAGE PROVIDER
// ==========================================
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

const uploadToCloudinary = async (fileBufferOrBase64, filename = "image", folder = "invitehub") => {
  const config = getCloudinaryConfig();
  if (!config || !config.cloudName) return null;

  try {
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
      timeout: 20000,
    });

    if (res.data && res.data.secure_url) {
      console.log(`[FileStorage] Uploaded artwork to Cloudinary CDN: ${res.data.secure_url}`);
      return res.data.secure_url;
    }
  } catch (err) {
    console.warn(`[FileStorage] Cloudinary upload attempt failed: ${err.response?.data?.error?.message || err.message}`);
  }
  return null;
};

// ==========================================
// 2. SUPABASE STORAGE PROVIDER
// ==========================================
const getSupabaseConfig = () => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
  const bucket = process.env.SUPABASE_BUCKET || process.env.SUPABASE_STORAGE_BUCKET || "templates";
  if (url && key) {
    return {
      url: url.replace(/\/+$/, ""),
      key,
      bucket,
    };
  }
  return null;
};

const uploadToSupabase = async (fileBuffer, filename, mimetype = "image/png") => {
  const config = getSupabaseConfig();
  if (!config) return null;

  try {
    const cleanFilename = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const endpoint = `${config.url}/storage/v1/object/${config.bucket}/${cleanFilename}`;

    const res = await axios.post(endpoint, fileBuffer, {
      headers: {
        Authorization: `Bearer ${config.key}`,
        apikey: config.key,
        "Content-Type": mimetype || "image/png",
        "x-upsert": "true",
      },
      timeout: 20000,
    });

    if (res.status === 200 || res.status === 201) {
      const publicUrl = `${config.url}/storage/v1/object/public/${config.bucket}/${cleanFilename}`;
      console.log(`[FileStorage] Uploaded artwork to Supabase Storage: ${publicUrl}`);
      return publicUrl;
    }
  } catch (err) {
    console.warn(`[FileStorage] Supabase upload failed: ${err.response?.data?.message || err.message}`);
  }
  return null;
};

// ==========================================
// 3. AWS S3 / S3-COMPATIBLE STORAGE PROVIDER
// ==========================================
const getS3Config = () => {
  const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || "us-east-1";
  const publicBase = process.env.AWS_S3_PUBLIC_URL || process.env.S3_PUBLIC_URL;
  if (bucket && accessKey && secretKey) {
    return { bucket, accessKey, secretKey, region, publicBase };
  }
  return null;
};

const uploadToS3 = async (fileBuffer, filename, mimetype = "image/png") => {
  const config = getS3Config();
  if (!config) return null;

  try {
    const cleanFilename = `templates/${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const host = `${config.bucket}.s3.${config.region}.amazonaws.com`;
    const date = new Date();
    const dateStamp = date.toISOString().slice(0, 10).replace(/-/g, "");
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const payloadHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    const canonicalUri = `/${cleanFilename}`;
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = `PUT\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${crypto.createHash("sha256").update(canonicalRequest).digest("hex")}`;

    const getSignatureKey = (key, dateStr, regionName, serviceName) => {
      const kDate = crypto.createHmac("sha256", "AWS4" + key).update(dateStr).digest();
      const kRegion = crypto.createHmac("sha256", kDate).update(regionName).digest();
      const kService = crypto.createHmac("sha256", kRegion).update(serviceName).digest();
      return crypto.createHmac("sha256", kService).update("aws4_request").digest();
    };

    const signingKey = getSignatureKey(config.secretKey, dateStamp, config.region, "s3");
    const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");
    const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const res = await axios.put(`https://${host}${canonicalUri}`, fileBuffer, {
      headers: {
        Host: host,
        "x-amz-date": amzDate,
        "x-amz-content-sha256": payloadHash,
        Authorization: authorizationHeader,
        "Content-Type": mimetype || "image/png",
      },
      timeout: 20000,
    });

    if (res.status >= 200 && res.status < 300) {
      const publicUrl = config.publicBase
        ? `${config.publicBase.replace(/\/+$/, "")}/${cleanFilename}`
        : `https://${host}/${cleanFilename}`;
      console.log(`[FileStorage] Uploaded artwork to AWS S3 CDN: ${publicUrl}`);
      return publicUrl;
    }
  } catch (err) {
    console.warn(`[FileStorage] AWS S3 upload failed: ${err.response?.data || err.message}`);
  }
  return null;
};

/**
 * Universal persistent cloud storage uploader.
 * Prioritizes: Cloudinary -> Supabase Storage -> AWS S3.
 *
 * If no cloud credentials are provided in production/serverless, produces a
 * permanent Base64 data URI so template artwork NEVER vanishes or throws 404s.
 */
const uploadToCloudStorage = async (fileBufferOrBase64, filename = "image.png", mimetype = "image/png", folder = "invitehub") => {
  let buffer = Buffer.isBuffer(fileBufferOrBase64)
    ? fileBufferOrBase64
    : null;

  if (!buffer && typeof fileBufferOrBase64 === "string") {
    let clean = fileBufferOrBase64.trim();
    if (clean.startsWith("data:")) {
      const match = clean.match(/^data:([a-zA-Z0-9/+-]+);base64,/);
      if (match && match[1]) mimetype = match[1];
      clean = clean.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, "");
    }
    try {
      buffer = Buffer.from(clean.replace(/\s+/g, ""), "base64");
    } catch (_) {
      buffer = null;
    }
  }

  // 1. Cloudinary
  try {
    const cloudinaryUrl = await uploadToCloudinary(buffer || fileBufferOrBase64, filename, folder);
    if (cloudinaryUrl) {
      return { success: true, url: cloudinaryUrl, provider: "cloudinary" };
    }
  } catch (err) {
    console.warn("[FileStorage] Cloudinary provider skipped:", err.message);
  }

  // 2. Supabase Storage
  if (buffer) {
    try {
      const supabaseUrl = await uploadToSupabase(buffer, filename, mimetype);
      if (supabaseUrl) {
        return { success: true, url: supabaseUrl, provider: "supabase" };
      }
    } catch (err) {
      console.warn("[FileStorage] Supabase provider skipped:", err.message);
    }
  }

  // 3. AWS S3
  if (buffer) {
    try {
      const s3Url = await uploadToS3(buffer, filename, mimetype);
      if (s3Url) {
        return { success: true, url: s3Url, provider: "s3" };
      }
    } catch (err) {
      console.warn("[FileStorage] S3 provider skipped:", err.message);
    }
  }

  // 4. Fallback for serverless environments when no cloud keys are configured:
  // Convert buffer to permanent self-contained Data URI stored directly in the DB.
  // This guarantees ZERO 404 errors across serverless restarts and instant canvas loading.
  if (isServerless && buffer && buffer.length > 0 && buffer.length <= 10 * 1024 * 1024) {
    const dataUri = `data:${mimetype || "image/png"};base64,${buffer.toString("base64")}`;
    console.log(`[FileStorage] Self-contained Data URI generated for serverless persistence (${Math.round(buffer.length / 1024)} KB)`);
    return { success: true, url: dataUri, provider: "data-uri" };
  }

  return null;
};

/**
 * Save an uploaded file buffer to persistent storage.
 * Ensures template artwork files are routed to cloud storage and NEVER saved
 * to ephemeral serverless /tmp disks.
 */
const saveUploadedFile = async (file, req, prefix = "upload") => {
  if (!file || !file.buffer) {
    throw new Error("No file buffer provided for upload.");
  }

  const ext = getFileExtension(file.mimetype, file.originalname);
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, "");
  const filename = `${cleanPrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;

  // 1. Attempt persistent cloud storage upload (Cloudinary, Supabase, S3, or permanent Data URI)
  const cloudResult = await uploadToCloudStorage(file.buffer, filename, file.mimetype, "invitehub-templates");
  if (cloudResult && cloudResult.url) {
    return {
      success: true,
      filename,
      filePath: "",
      url: cloudResult.url,
      fileUrl: cloudResult.url,
      provider: cloudResult.provider,
    };
  }

  // 2. Local development fallback only (never on production serverless)
  if (!isServerless) {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
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
      provider: "local-disk",
    };
  }

  // 3. Serverless emergency fallback: return Base64 Data URI to prevent 404
  const dataUri = `data:${file.mimetype || "image/png"};base64,${file.buffer.toString("base64")}`;
  return {
    success: true,
    filename,
    filePath: "",
    url: dataUri,
    fileUrl: dataUri,
    provider: "data-uri",
  };
};

/**
 * Save a base64 encoded image string to persistent storage
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

/**
 * Download a remote image URL, re-host to persistent cloud storage if available,
 * and return public URL.
 *
 * CRITICAL ZERO-404 GUARANTEE:
 * If no cloud storage is configured, PRESERVES the external HTTPS URL as-is!
 * Never overwrites working web URLs with ephemeral local /uploads/ paths.
 */
const saveRemoteImage = async (remoteUrl, req, prefix = "template_artwork") => {
  if (!remoteUrl || typeof remoteUrl !== "string") {
    throw new Error("No remote image URL provided.");
  }

  let targetUrl = remoteUrl.trim();

  // If already a Data URI or blob, return as is
  if (targetUrl.startsWith("data:") || targetUrl.startsWith("blob:")) {
    return {
      success: true,
      url: targetUrl,
      fileUrl: targetUrl,
      filename: `${prefix}.png`,
    };
  }

  // Clean wrapper URLs (Google, Dropbox, Imgur)
  if (targetUrl.includes("google.") && targetUrl.includes("imgurl=")) {
    try {
      const parsed = new URL(targetUrl);
      const direct = parsed.searchParams.get("imgurl");
      if (direct) targetUrl = decodeURIComponent(direct);
    } catch (_) {}
  }

  if (targetUrl.includes("dropbox.com")) {
    targetUrl = targetUrl.replace(/\?dl=0/g, "?raw=1").replace(/&dl=0/g, "&raw=1");
    if (!targetUrl.includes("raw=1")) {
      targetUrl += (targetUrl.includes("?") ? "&" : "?") + "raw=1";
    }
  }

  if (/^https?:\/\/(?:www\.)?imgur\.com\/([a-zA-Z0-9]+)$/i.test(targetUrl)) {
    const id = targetUrl.split("/").pop();
    targetUrl = `https://i.imgur.com/${id}.jpg`;
  }

  // Check if persistent cloud storage is configured
  const hasCloudConfig = !!(getCloudinaryConfig() || getSupabaseConfig() || getS3Config());

  // If NO persistent cloud storage is configured:
  // Return the original valid HTTPS URL directly! Do NOT write to local server disk and
  // produce a fragile /uploads/ path that breaks on serverless deployments!
  if (!hasCloudConfig) {
    return {
      success: true,
      url: targetUrl,
      fileUrl: targetUrl,
      filename: path.basename(targetUrl.split("?")[0]) || `${prefix}.png`,
    };
  }

  // Cloud storage is active: download image and upload to cloud bucket
  try {
    const response = await axios.get(targetUrl, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    const contentType = (response.headers["content-type"] || "image/png").toLowerCase();
    let filename = `${prefix}.png`;
    try {
      const pathname = new URL(targetUrl).pathname;
      const base = path.basename(pathname);
      if (base && base.includes(".")) filename = base;
    } catch (_) {}

    return saveUploadedFile(
      {
        buffer: Buffer.from(response.data),
        mimetype: contentType,
        originalname: filename,
      },
      req,
      prefix
    );
  } catch (dlErr) {
    console.warn(`[FileStorage] Could not download remote image for re-hosting, keeping original URL: ${dlErr.message}`);
    return {
      success: true,
      url: targetUrl,
      fileUrl: targetUrl,
      filename: `${prefix}.png`,
    };
  }
};

module.exports = {
  saveUploadedFile,
  saveBase64Image,
  saveRemoteImage,
  uploadToCloudStorage,
  uploadToCloudinary,
  uploadToSupabase,
  uploadToS3,
  getCloudinaryConfig,
  getSupabaseConfig,
  getS3Config,
  getPublicBaseUrl,
  isValidPublicUrl,
  findLocalFilePath,
  UPLOADS_DIR,
  PUBLIC_ASSET_DIRS,
};
