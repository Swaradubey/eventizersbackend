const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

let s3ClientInstance = null;

const getR2Config = () => {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL || "";

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicUrl: publicUrl.replace(/\/+$/, ""),
  };
};

const getR2Client = () => {
  const config = getR2Config();
  if (!config) return null;

  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  return { client: s3ClientInstance, config };
};

/**
 * Upload a file buffer directly to Cloudflare R2 bucket.
 * @param {Buffer} fileBuffer
 * @param {string} filename
 * @param {string} mimetype
 * @param {string} folder
 * @returns {Promise<string | null>} Public URL of the uploaded asset
 */
const uploadToR2 = async (fileBuffer, filename, mimetype = "image/png", folder = "templates") => {
  const r2 = getR2Client();
  if (!r2) {
    console.warn("[Cloudflare R2] Credentials not configured or missing.");
    return null;
  }

  try {
    const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = folder ? `${folder.replace(/\/+$/, "")}/${cleanFilename}` : cleanFilename;

    const command = new PutObjectCommand({
      Bucket: r2.config.bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: mimetype || "application/octet-stream",
    });

    await r2.client.send(command);

    // Build the public CDN / dev URL
    const publicUrl = r2.config.publicUrl
      ? `${r2.config.publicUrl}/${key}`
      : `https://${r2.config.bucketName}.${r2.config.accountId}.r2.cloudflarestorage.com/${key}`;

    console.log(`[Cloudflare R2] Successfully uploaded: ${publicUrl}`);
    return publicUrl;
  } catch (err) {
    console.error(`[Cloudflare R2] Upload failed:`, err);
    return null;
  }
};

/**
 * Delete an object from Cloudflare R2 bucket.
 * @param {string} key
 */
const deleteFromR2 = async (key) => {
  const r2 = getR2Client();
  if (!r2) return false;

  try {
    const command = new DeleteObjectCommand({
      Bucket: r2.config.bucketName,
      Key: key,
    });
    await r2.client.send(command);
    return true;
  } catch (err) {
    console.error(`[Cloudflare R2] Delete failed for key ${key}:`, err);
    return false;
  }
};

module.exports = {
  getR2Config,
  getR2Client,
  uploadToR2,
  deleteFromR2,
};
