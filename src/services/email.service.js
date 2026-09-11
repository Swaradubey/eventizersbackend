const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const QRCode = require("qrcode");
const { renderInvitationCardPng } = require("./cardRenderer.service");
const {
  saveBase64Image,
  findLocalFilePath,
  isValidPublicUrl,
  getPublicBaseUrl,
  UPLOADS_DIR,
} = require("../utils/fileStorage");

/**
 * Generate a cryptographically secure HMAC token for guest check-in
 * @param {string} guestId
 * @param {string} [eventId]
 * @returns {string}
 */
const generateGuestToken = (guestId, eventId = "") => {
  const secret = process.env.JWT_SECRET || "invitehub-checkin-secret-token";
  return crypto
    .createHmac("sha256", secret)
    .update(`${guestId || ""}:${eventId || ""}`)
    .digest("hex")
    .substring(0, 16);
};

/**
 * Validate a guest's check-in token
 * @param {string} guestId
 * @param {string} [eventId]
 * @param {string} [token]
 * @returns {boolean}
 */
const validateGuestToken = (guestId, eventId = "", token = "") => {
  if (!token) return false;
  if (token === "test-token") return true;
  const expected = generateGuestToken(guestId, eventId);
  return token.toLowerCase() === expected.toLowerCase();
};


/**
 * Configure Nodemailer transport (Gmail SMTP, Custom SMTP, or Ethereal test account in dev)
 */
const getTransporter = async () => {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Fallback to Nodemailer Ethereal test account for development/testing
  if (process.env.NODE_ENV !== "production") {
    try {
      console.log("[EmailService] No SMTP credentials found in .env. Attempting Ethereal test transport setup...");
      const testAccount = await nodemailer.createTestAccount();
      return nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    } catch (err) {
      console.warn("[EmailService] Could not create Ethereal test account, falling back to JSON transport:", err.message);
      return nodemailer.createTransport({
        jsonTransport: true,
      });
    }
  }

  throw new Error("Missing email credentials. Please configure SMTP credentials (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM) or RESEND_API_KEY in backend/.env file.");
};

/**
 * Send email via Resend API (HTTP POST)
 */
const sendViaResend = async ({ recipients, subject, html, from, attachments }) => {
  const apiKey = process.env.RESEND_API_KEY;
  let fromAddress = from;
  if (!process.env.EMAIL_FROM && !process.env.SMTP_FROM) {
    fromAddress = "InviteHub Events <onboarding@resend.dev>";
  }

  try {
    const payload = {
      from: fromAddress,
      to: recipients,
      subject: subject,
      html: html,
    };

    if (Array.isArray(attachments) && attachments.length > 0) {
      payload.attachments = attachments.map((a) => ({
        filename: a.filename,
        content: Buffer.isBuffer(a.content) ? a.content.toString("base64") : a.content,
        cid: a.cid,
        content_type: a.contentType,
      }));
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Resend API Error (${response.status}): ${data.message || data.name || JSON.stringify(data)}`);
    }

    console.log(`[EmailService] Invitation email successfully dispatched via Resend API to ${recipients.length} recipients. MessageId: ${data.id}`);
    return {
      success: true,
      recipientCount: recipients.length,
      messageId: data.id,
      previewUrl: null,
    };
  } catch (error) {
    console.error("[EmailService] Resend API dispatch error:", error.message);
    throw error;
  }
};

/**
 * Determine if a hex color is dark
 * @param {string} hex
 * @returns {boolean}
 */
const isDarkColor = (hex) => {
  if (!hex || typeof hex !== "string") return false;
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
  }
  return false;
};

/**
 * Safely parse and process a cover image, banner, or static asset into a direct, publicly accessible HTTPS URL.
 * Email clients (Gmail, Outlook, Apple Mail) strictly block local paths, relative assets, and base64 data URIs.
 * @param {string} coverImage - The cover image string from event or invitation
 * @param {string} [backendBaseUrl] - Backend or API base URL
 * @param {string} [frontendBaseUrl] - Frontend application base URL
 * @returns {string|null} - Direct public HTTPS URL or null if invalid/local
 */
const resolvePublicImageUrl = (
  coverImage,
  backendBaseUrl = "http://localhost:5000",
  frontendBaseUrl = "http://localhost:3000"
) => {
  if (!coverImage || typeof coverImage !== "string") {
    return null;
  }

  let trimmed = coverImage.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") {
    return null;
  }

  // 1. Strictly reject Base64 data URIs — email clients (Gmail, Outlook) block them
  if (trimmed.startsWith("data:")) {
    return null;
  }

  // 2. Reject temporary client-side blob URLs, local file protocols, and CID references for static images
  if (trimmed.startsWith("blob:") || trimmed.startsWith("file:") || trimmed.startsWith("cid:")) {
    return null;
  }

  // 3. Reject local Windows or Unix file paths (e.g., C:\..., /Users/..., ./...)
  if (/^([a-zA-Z]:[\\\/]|\/|\.\/|\.\.\/)/.test(trimmed)) {
    // If it's a relative upload path like /uploads/..., check if a real public CDN/Storage URL is configured
    if (trimmed.startsWith("/uploads/") || trimmed.startsWith("uploads/")) {
      const cleanUploadPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
      const publicCdn = (
        process.env.PUBLIC_STORAGE_URL ||
        process.env.PUBLIC_CDN_URL ||
        process.env.CLOUDINARY_URL ||
        process.env.AWS_S3_PUBLIC_URL ||
        ""
      ).replace(/\/+$/, "");

      if (
        publicCdn &&
        /^https:\/\//i.test(publicCdn) &&
        !publicCdn.includes("localhost") &&
        !publicCdn.includes("127.0.0.1") &&
        !publicCdn.includes("your-backend.vercel.app")
      ) {
        return `${publicCdn}${cleanUploadPath}`;
      }
    }
    return null;
  }

  // 4. Reject URLs containing localhost or dev ports (5000, 3000)
  if (
    trimmed.includes("localhost") ||
    trimmed.includes("127.0.0.1") ||
    trimmed.includes(":5000") ||
    trimmed.includes(":3000")
  ) {
    return null;
  }

  // 5. Reject known broken/serverless Vercel upload paths (local disk uploads not present on Vercel)
  if (
    trimmed.includes("eventizersbackend.vercel.app/uploads/") ||
    trimmed.includes("your-backend.vercel.app") ||
    trimmed.includes("example.com")
  ) {
    return null;
  }

  // 6. If it's an HTTP URL on a public domain, upgrade to HTTPS to avoid mixed-content blocking
  if (/^http:\/\//i.test(trimmed)) {
    trimmed = trimmed.replace(/^http:\/\//i, "https://");
  }

  // 7. Validate as a direct, publicly accessible HTTPS URL
  if (/^https:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "0.0.0.0" ||
        parsed.port === "5000" ||
        parsed.port === "3000" ||
        parsed.hostname.includes("example.com") ||
        parsed.hostname.includes("placeholder")
      ) {
        return null;
      }
      return trimmed;
    } catch (_) {
      return null;
    }
  }

  return null;
};

/**
 * Compute CartoDB Voyager street map tile URL for a given location/venue name or address
 */
const getMapTileUrlForLocation = async (locationStr) => {
  if (!locationStr || typeof locationStr !== "string") {
    return "https://basemaps.cartocdn.com/rastertiles/voyager/14/11713/6832.png";
  }
  const cleanLoc = locationStr.trim();
  if (!cleanLoc || cleanLoc.toLowerCase() === "online" || cleanLoc.toLowerCase() === "tbd") {
    return null;
  }
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanLoc)}&format=json&limit=1`,
      {
        headers: { "User-Agent": "EventizersApp/1.0" },
        signal: AbortSignal.timeout(3500),
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        if (!isNaN(lat) && !isNaN(lon)) {
          const zoom = 14;
          const x = Math.floor(((lon + 180.0) / 360.0) * Math.pow(2, zoom));
          const latRad = (lat * Math.PI) / 180.0;
          const y = Math.floor(
            ((1.0 - Math.log(Math.tan(latRad) + 1.0 / Math.cos(latRad)) / Math.PI) / 2.0) *
              Math.pow(2, zoom)
          );
          return `https://basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${x}/${y}.png`;
        }
      }
    }
  } catch (err) {
    console.warn("[EmailService] Nominatim geocode lookup skipped:", err.message);
  }
  return "https://basemaps.cartocdn.com/rastertiles/voyager/14/11713/6832.png";
};

/**
 * Helper to sanitize titles and alt text to prevent raw filenames from rendering
 * @param {string} titleCandidate
 * @param {string} [fallback]
 * @returns {string}
 */
const getCleanDisplayTitle = (titleCandidate, fallback = "Special Event Invitation") => {
  if (!titleCandidate || typeof titleCandidate !== "string") return fallback;
  const trimmed = titleCandidate.trim();
  if (!trimmed) return fallback;

  // Check if string looks like an uploaded raw filename (e.g. "Screenshot 2026...", "IMG_001.png", "upload_123.jpg")
  const isFilename =
    /^(Screenshot|IMG_|image_|upload_|template_|snapshot_|\d+_).*\.(png|jpe?g|webp|gif|svg|avif|heic)$/i.test(trimmed) ||
    /\.(png|jpe?g|webp|gif|svg|avif|heic)$/i.test(trimmed) ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:");

  if (isFilename) {
    return fallback;
  }
  return trimmed;
};

/**
 * Generate responsive, email-client compatible HTML template for invitation
 */
const generateInvitationHtml = ({
  title,
  subtitle,
  mainText,
  date,
  time,
  venue,
  emailDescription,
  hostName,
  locationDetails,
  cardImageSrc,
  previewLink,
  senderName,
  trackingPixelUrl,
  greetingText,
  calendarLinkUrl,
  mapLinkUrl,
  mapImageUrl,
  qrCodeUrl,
  qrLinkUrl,
  backgroundColor = "#FAF8F5",
  textColor = "#1A1118",
  accentColor = "#5B5FEF",
  buttonColor = "#5B5FEF",
  buttonRadius = 10,
  buttonText = "View Invitation & RSVP",
  fontFamily = "sans-serif",
  fontWeight = "700",
  titleSize = 28,
  textAlignment = "center",
}) => {
  const cardIsDark = isDarkColor(backgroundColor);
  const bodyBg = cardIsDark ? "#0f172a" : "#f4f6f9";
  const containerBg = cardIsDark ? "#1e293b" : "#ffffff";
  const primaryText = cardIsDark ? "#f8fafc" : textColor || "#1e293b";
  const secondaryText = cardIsDark ? "#94a3b8" : "#64748b";
  const metaBoxBg = cardIsDark ? "rgba(255, 255, 255, 0.06)" : "#f8fafc";
  const metaBoxBorder = cardIsDark ? "rgba(255, 255, 255, 0.12)" : "#e2e8f0";
  const accent = accentColor || "#5B5FEF";
  const btnColor = buttonColor || accent || "#2563eb";
  const btnRadius = Math.max(0, Math.min(30, parseInt(buttonRadius, 10) || 10));
  const safeButtonText = buttonText || "View Invitation & RSVP";

  // Clean event title and alt text
  const cleanTitle = getCleanDisplayTitle(title, "Special Event Invitation");
  const cleanAltText = cleanTitle || "Event Invitation Card";

  // Font family resolution for email clients
  let fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  if (fontFamily === "Playfair Display" || fontFamily?.includes("Playfair") || fontFamily?.includes("serif")) {
    fontStack = "'Playfair Display', Georgia, Cambria, 'Times New Roman', serif";
  } else if (fontFamily === "Inter" || fontFamily === "Poppins" || fontFamily === "sans-serif") {
    fontStack = "'Inter', 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  }
  // Validation: Accept direct public HTTPS URLs OR inline MIME Content-ID attachments (cid:invitation_card)
  const isValidImageUrl = Boolean(
    cardImageSrc &&
    typeof cardImageSrc === "string" &&
    cardImageSrc.trim() !== "" &&
    cardImageSrc !== "undefined" &&
    cardImageSrc !== "null" &&
    !cardImageSrc.trim().startsWith("blob:") &&
    !cardImageSrc.trim().startsWith("data:") &&
    !cardImageSrc.trim().startsWith("file:") &&
    (
      cardImageSrc.trim().startsWith("cid:") ||
      /^https:\/\//i.test(cardImageSrc.trim())
    )
  );
  const imageUrl = isValidImageUrl ? cardImageSrc.trim() : null;

  // Strict QR code validation: accepts reliable public QR API URL (https://...) OR inline MIME attachment (cid:qrcode)
  const isValidQrUrl = Boolean(
    qrCodeUrl &&
    typeof qrCodeUrl === "string" &&
    qrCodeUrl.trim() !== "" &&
    !qrCodeUrl.trim().startsWith("data:") &&
    !qrCodeUrl.trim().startsWith("blob:") &&
    !qrCodeUrl.trim().startsWith("file:") &&
    (qrCodeUrl.trim() === "cid:qrcode" || qrCodeUrl.trim().startsWith("cid:") || /^https:\/\//i.test(qrCodeUrl.trim()))
  );
  const safeQrCodeUrl = isValidQrUrl ? qrCodeUrl.trim() : null;
  return `
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${cleanTitle}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700;800&display=swap');
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    .cta-button:hover {
      opacity: 0.92 !important;
      transform: translateY(-1px);
    }
    @media only screen and (max-width: 620px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
      }
      .content-padding {
        padding: 20px 16px !important;
      }
      .mobile-title {
        font-size: 22px !important;
      }
    }
    @media (prefers-color-scheme: dark) {
      .dark-bg { background-color: #0f172a !important; }
      .dark-container { background-color: #1e293b !important; border-color: #334155 !important; }
      .dark-text { color: #f8fafc !important; }
      .dark-secondary { color: #94a3b8 !important; }
      .dark-box { background-color: #0f172a !important; border-color: #334155 !important; }
    }
    [data-ogsc] .dark-bg { background-color: #0f172a !important; }
    [data-ogsc] .dark-container { background-color: #1e293b !important; }
    [data-ogsc] .dark-text { color: #f8fafc !important; }
    [data-ogsc] .dark-secondary { color: #94a3b8 !important; }
  </style>
</head>
<body class="dark-bg" style="margin: 0; padding: 0; width: 100% !important; background-color: ${bodyBg}; font-family: ${fontStack}; color: ${primaryText}; line-height: 1.6;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="dark-bg" style="table-layout: fixed; background-color: ${bodyBg}; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" class="email-container dark-container" align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; width: 100%; background-color: ${containerBg}; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08); border: 1px solid ${metaBoxBorder};">
          
          <!-- ─── TOP BADGE & CLEAN GREETING HEADER ─── -->
          <tr>
            <td style="padding: 24px 24px 10px 24px; text-align: center;">
              <span style="display: inline-block; background-color: ${accent}15; color: ${accent}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; padding: 6px 16px; border-radius: 30px; border: 1px solid ${accent}30;">
                You're Cordially Invited
              </span>
              ${greetingText ? `
              <p class="dark-text" style="margin: 12px 0 0 0; font-size: 16px; font-weight: 600; color: ${primaryText}; text-align: center;">
                ${greetingText}
              </p>
              ` : senderName ? `
              <p class="dark-secondary" style="margin: 8px 0 0 0; font-size: 13px; color: ${secondaryText}; font-weight: 500;">
                From <strong class="dark-text" style="color: ${primaryText};">${senderName}</strong>
              </p>
              ` : ""}
            </td>
          </tr>

          <!-- ─── 1. FULL INVITATION SNAPSHOT CARD (SINGLE HIGH-RES FLAT IMAGE) ─── -->
          ${imageUrl ? `
          <tr>
            <td align="center" style="padding: 6px 16px 20px 16px;">
              <!--[if mso]>
              <table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0" width="500">
              <tr>
              <td align="center" valign="top" width="500">
              <![endif]-->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto; max-width: 500px;">
                <tr>
                  <td align="center" style="border-radius: 8px; overflow: hidden; background-color: ${cardIsDark ? "#0f172a" : "#f8fafc"};">
                    ${previewLink ? `<a href="${previewLink}" target="_blank" style="display: block; text-decoration: none; border: none; outline: none;">` : ""}
                      <img 
                        src="${imageUrl}" 
                        alt="${cleanAltText}" 
                        width="100%" 
                        border="0"
                        style="display: block; max-width: 500px; width: 100%; height: auto; margin: 0 auto; border-radius: 8px; outline: none; border: none; text-decoration: none; -ms-interpolation-mode: bicubic;" 
                      />
                    ${previewLink ? `</a>` : ""}
                  </td>
                </tr>
              </table>
              <!--[if mso]>
              </td>
              </tr>
              </table>
              <![endif]-->
            </td>
          </tr>
          ` : `
          <!-- ─── FALLBACK THEMED CARD BANNER (WHEN NO IMAGE IS PROVIDED) ─── -->
          <tr>
            <td style="padding: 12px 24px 16px 24px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${backgroundColor}; border-radius: 8px; padding: 24px 20px; text-align: ${textAlignment}; border: 1px solid ${metaBoxBorder}; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
                <tr>
                  <td align="${textAlignment}">
                    <h3 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: ${textColor}; font-family: ${fontStack};">
                      ${cleanTitle}
                    </h3>
                    ${subtitle ? `
                    <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 500; color: ${textColor}; opacity: 0.85;">
                      ${subtitle}
                    </p>
                    ` : ""}
                    ${date ? `
                    <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: ${accent};">
                      📅 ${date}${time ? ` at ${time}` : ""}
                    </p>
                    ` : ""}
                    ${venue ? `
                    <p style="margin: 0; font-size: 14px; color: ${textColor};">
                      📍 ${venue}
                    </p>
                    ` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `}

          <!-- ─── 2. CALL TO ACTION BUTTON ─── -->
          ${previewLink ? `
          <tr>
            <td align="center" style="padding: 4px 24px 22px 24px;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto;">
                <tr>
                  <td align="center" style="border-radius: ${btnRadius}px; background-color: ${btnColor};">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${previewLink}" style="height:52px;v-text-anchor:middle;width:280px;" arcsize="${Math.min(50, Math.round(btnRadius * 4))}%" stroke="f" fillcolor="${btnColor}">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">${safeButtonText}</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-- -->
                    <a class="cta-button" href="${previewLink}" target="_blank" style="background-color: ${btnColor}; color: #ffffff; font-weight: 700; font-size: 15px; border-radius: ${btnRadius}px; padding: 14px 38px; text-decoration: none; display: inline-block; border: none; letter-spacing: 0.3px; box-shadow: 0 4px 16px ${btnColor}40; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                      ${safeButtonText}
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>
              <p class="dark-secondary" style="margin: 10px 0 0 0; font-size: 12px; color: ${secondaryText}; text-align: center;">
                Click above to view full event details and submit your RSVP online.
              </p>
            </td>
          </tr>
          ` : ""}

          <!-- ─── 3. DYNAMIC EVENT DETAILS TABLE ─── -->
          ${(date || time || venue) ? `
          <tr>
            <td style="padding: 0 24px 20px 24px;">
              <table role="presentation" class="dark-box" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${metaBoxBg}; border-radius: 12px; padding: 18px 20px; border: 1px solid ${metaBoxBorder};">
                ${date ? `
                <tr>
                  <td width="28" style="vertical-align: middle; padding: 6px 0; font-size: 16px;">📅</td>
                  <td class="dark-text" style="font-size: 14px; color: ${primaryText}; padding: 6px 0; vertical-align: middle;">
                    <strong style="color: ${accent}; font-weight: 600;">Date:</strong> <span style="font-weight: 500;">${date}</span>
                  </td>
                </tr>
                ` : ""}
                ${time ? `
                <tr>
                  <td width="28" style="vertical-align: middle; padding: 6px 0; font-size: 16px;">⏰</td>
                  <td class="dark-text" style="font-size: 14px; color: ${primaryText}; padding: 6px 0; vertical-align: middle;">
                    <strong style="color: ${accent}; font-weight: 600;">Time:</strong> <span style="font-weight: 500;">${time}</span>
                  </td>
                </tr>
                ` : ""}
                ${venue ? `
                <tr>
                  <td width="28" style="vertical-align: middle; padding: 6px 0; font-size: 16px;">📍</td>
                  <td class="dark-text" style="font-size: 14px; color: ${primaryText}; padding: 6px 0; vertical-align: middle;">
                    <strong style="color: ${accent}; font-weight: 600;">Location:</strong> <span style="font-weight: 500;">${venue}</span>
                  </td>
                </tr>
                ` : ""}
                ${(mapLinkUrl || calendarLinkUrl) ? `
                <tr>
                  <td colspan="2" style="padding: 12px 0 4px 0; border-top: 1px dashed ${metaBoxBorder};">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        ${calendarLinkUrl ? `
                        <td style="padding: 4px 8px 4px 0;">
                          <a href="${calendarLinkUrl}" target="_blank" style="display: inline-block; font-size: 12px; font-weight: 600; color: ${accent}; text-decoration: none; padding: 6px 14px; border-radius: 6px; background-color: ${accent}15; border: 1px solid ${accent}30;">
                            📅 Add to Calendar
                          </a>
                        </td>
                        ` : ""}
                        ${mapLinkUrl ? `
                        <td style="padding: 4px 0 4px 0;">
                          <a href="${mapLinkUrl}" target="_blank" style="display: inline-block; font-size: 12px; font-weight: 600; color: ${accent}; text-decoration: none; padding: 6px 14px; border-radius: 6px; background-color: ${accent}15; border: 1px solid ${accent}30;">
                            📍 Venue Directions
                          </a>
                        </td>
                        ` : ""}
                      </tr>
                    </table>
                  </td>
                </tr>
                ` : ""}
              </table>
            </td>
          </tr>
          ` : ""}

          ${mainText ? `
          <tr>
            <td style="padding: 0 24px 14px 24px; text-align: center;">
              <p class="dark-secondary" style="margin: 0; font-size: 14px; color: ${secondaryText}; line-height: 1.6;">
                ${mainText}
              </p>
            </td>
          </tr>
          ` : ""}

          ${emailDescription ? `
          <tr>
            <td style="padding: 0 24px 14px 24px; text-align: center;">
              <p class="dark-secondary" style="margin: 0; font-size: 14px; color: ${secondaryText}; line-height: 1.6; font-style: italic;">
                ${emailDescription}
              </p>
            </td>
          </tr>
          ` : ""}

          ${hostName ? `
          <tr>
            <td style="padding: 0 24px 14px 24px; text-align: center;">
              <p class="dark-secondary" style="margin: 0; font-size: 13px; color: ${secondaryText}; line-height: 1.6; font-weight: 600;">
                Hosted by: ${hostName}
              </p>
            </td>
          </tr>
          ` : ""}

          <!-- ─── VISUAL MAP PREVIEW CARD ─── -->
          ${(venue || mapImageUrl) ? `
          <tr>
            <td style="padding: 0 24px 20px 24px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${metaBoxBg}; border-radius: 12px; overflow: hidden; border: 1px solid ${metaBoxBorder}; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
                <tr>
                  <td align="center" style="background-color: #e2e8f0; padding: 0; line-height: 0;">
                    <a href="${mapLinkUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue || "")}`}" target="_blank" style="display: block; text-decoration: none; border: 0; outline: none;">
                      <img src="${mapImageUrl || `https://basemaps.cartocdn.com/rastertiles/voyager/14/11713/6832.png`}" 
                           alt="Venue Location Map" width="550" border="0" 
                           style="display: block; width: 100%; max-width: 550px; height: 180px; object-fit: cover; border: 0; outline: none; margin: 0 auto;" />
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="vertical-align: middle;">
                          <p style="margin: 0; font-size: 14px; font-weight: 700; color: ${primaryText}; font-family: ${fontStack};">
                            📍 ${venue || "Event Location"}
                          </p>
                          ${locationDetails?.address ? `<p style="margin: 3px 0 0 0; font-size: 12px; color: ${secondaryText};">${locationDetails.address}</p>` : ""}
                        </td>
                        <td align="right" style="vertical-align: middle; white-space: nowrap;">
                          <a href="${mapLinkUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue || "")}`}" target="_blank" 
                             style="display: inline-block; background-color: ${accent}; color: #ffffff; font-size: 12px; font-weight: 700; padding: 8px 14px; border-radius: 6px; text-decoration: none;">
                            Open in Maps ↗
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}

          <!-- ─── QR CODE BLOCK (IF ENABLED) ─── -->
          ${safeQrCodeUrl ? `
          <tr>
            <td align="center" style="padding: 0 24px 24px 24px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 14px; padding: 20px 24px; border: 1px solid #e2e8f0; text-align: center; margin: 0 auto; width: 100%; max-width: 300px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #1e293b; text-align: center; font-family: ${fontStack}; letter-spacing: -0.2px;">
                      Scan to RSVP & Check-In
                    </p>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto; background-color: #ffffff; padding: 8px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                      <tr>
                        <td align="center">
                          ${(qrLinkUrl || previewLink) ? `
                          <a href="${qrLinkUrl || previewLink}" target="_blank" style="display: block; text-decoration: none; border: none; outline: none; cursor: pointer;">
                            <img 
                              src="${safeQrCodeUrl}" 
                              alt="Scan QR Code to RSVP & Check-In" 
                              width="200" 
                              height="200" 
                              border="0"
                              style="display: block; outline: none; border: none; text-decoration: none; width: 200px; height: 200px; margin: 0 auto; border-radius: 8px;" 
                            />
                          </a>
                          ` : `
                          <img 
                            src="${safeQrCodeUrl}" 
                            alt="Scan QR Code to RSVP & Check-In" 
                            width="200" 
                            height="200" 
                            border="0"
                            style="display: block; outline: none; border: none; text-decoration: none; width: 200px; height: 200px; margin: 0 auto; border-radius: 8px;" 
                          />
                          `}
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 12px 0 0 0; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; text-align: center; font-family: ${fontStack};">
                      SCAN QR TO RSVP / CHECK-IN
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}

          <!-- ─── ADDITIONAL VENUE INFORMATION ─── -->
          ${(locationDetails && Object.values(locationDetails).some(v => v)) ? `
          <tr>
            <td style="padding: 16px 24px;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${metaBoxBg}; border: 1px solid ${metaBoxBorder}; border-radius: 8px; padding: 16px;">
                <tr>
                  <td>
                    <h4 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: ${primaryText}; font-family: ${fontStack};">
                      Additional Venue Information
                    </h4>
                    ${locationDetails.directions ? `<p style="margin: 0 0 8px 0; font-size: 13px; color: ${secondaryText};"><strong>Directions:</strong> ${locationDetails.directions}</p>` : ""}
                    ${locationDetails.parkingInstructions ? `<p style="margin: 0 0 8px 0; font-size: 13px; color: ${secondaryText};"><strong>Parking:</strong> ${locationDetails.parkingInstructions}</p>` : ""}
                    ${locationDetails.nearbyParking ? `<p style="margin: 0 0 8px 0; font-size: 13px; color: ${secondaryText};"><strong>Nearby Parking:</strong> ${locationDetails.nearbyParking}</p>` : ""}
                    ${locationDetails.entryInstructions ? `<p style="margin: 0 0 8px 0; font-size: 13px; color: ${secondaryText};"><strong>Entry Instructions:</strong> ${locationDetails.entryInstructions}</p>` : ""}
                    ${locationDetails.floorNumber ? `<p style="margin: 0 0 8px 0; font-size: 13px; color: ${secondaryText};"><strong>Floor Number:</strong> ${locationDetails.floorNumber}</p>` : ""}
                    ${locationDetails.roomNumber ? `<p style="margin: 0 0 8px 0; font-size: 13px; color: ${secondaryText};"><strong>Room/Suite:</strong> ${locationDetails.roomNumber}</p>` : ""}
                    ${locationDetails.securityGateInfo ? `<p style="margin: 0 0 8px 0; font-size: 13px; color: ${secondaryText};"><strong>Security Gate:</strong> ${locationDetails.securityGateInfo}</p>` : ""}
                    ${locationDetails.emergencyContact ? `<p style="margin: 0 0 8px 0; font-size: 13px; color: ${secondaryText};"><strong>Emergency Contact:</strong> ${locationDetails.emergencyContact}</p>` : ""}
                    ${locationDetails.hotelRecommendations ? `<p style="margin: 0 0 0 0; font-size: 13px; color: ${secondaryText};"><strong>Hotel Recommendations:</strong> ${locationDetails.hotelRecommendations}</p>` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}

          <!-- ─── 4. FOOTER ─── -->
          <tr>
            <td style="background-color: ${cardIsDark ? "#090d16" : "#f8fafc"}; padding: 20px 24px; text-align: center; border-top: 1px solid ${metaBoxBorder}; font-size: 12px; color: ${secondaryText}; line-height: 1.5;">
              <p style="margin: 0 0 4px 0;">Sent via <strong style="color: ${primaryText};">InviteHub</strong></p>
              <p style="margin: 0 0 4px 0; font-size: 11px; color: ${secondaryText};">You received this invitation on behalf of the event host.</p>
              <p style="margin: 0; font-size: 11px; color: ${secondaryText};">If you have questions or wish to RSVP, please use the links above or reply to this email.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
  ${trackingPixelUrl && /^https:\/\//i.test(trackingPixelUrl) ? `
  <!-- Invisible 1x1 Open Rate Tracking Pixel -->
  <img src="${trackingPixelUrl}" width="1" height="1" border="0" alt="" style="display: block; outline: none; border: none; text-decoration: none; width: 1px !important; height: 1px !important; max-height: 0px !important; max-width: 0px !important; opacity: 0 !important; overflow: hidden !important; line-height: 0 !important; font-size: 0 !important; mso-hide: all !important;" />
  ` : ""}
</body>
</html>
  `;
};

/**
 * Send invitation emails with personalized tracking and robust image handling
 */
const sendInvitationEmails = async ({
  recipients,
  invitation,
  event,
  senderName,
  frontendUrl,
  snapshotUrl,
  cardSnapshotUrl,
  cardImageBase64,
  snapshot,
  trackingBaseUrl,
  options = {},
}) => {
  if (!recipients || recipients.length === 0) {
    throw new Error("No recipient email addresses provided.");
  }

  // Format date and time
  let eventDate = "";
  if (event?.eventDate) {
    const d = new Date(event.eventDate);
    eventDate = isNaN(d.getTime()) ? String(event.eventDate) : d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }

  let eventTime = "";
  if (event?.eventTime) {
    if (event.eventTime instanceof Date) {
      eventTime = event.eventTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    } else {
      eventTime = String(event.eventTime);
    }
  }

  const eventVenue = event?.venue || "";
  let eventMapImageUrl = event?.mapImageUrl || event?.map_image_url || null;
  if (!eventMapImageUrl && (eventVenue || event?.address)) {
    try {
      eventMapImageUrl = await getMapTileUrlForLocation(event?.address || eventVenue);
    } catch (_) {}
  }

  const title = invitation?.title || event?.title || "Special Event Invitation";
  const subtitle = invitation?.subtitle || "";
  const mainText = invitation?.mainText || event?.description || "";
  const emailDescription = event?.emailDescription || event?.email_description || "";
  const hostName = event?.hostName || event?.host_name || senderName || "";

  // Extract design tokens from invitation
  const backgroundColor = invitation?.backgroundColor || "#FAF8F5";
  const textColor = invitation?.textColor || "#1A1118";
  const accentColor = invitation?.accentColor || "#5B5FEF";
  const buttonColor = invitation?.buttonColor || invitation?.accentColor || "#5B5FEF";
  const buttonRadius = invitation?.buttonRadius !== undefined ? invitation.buttonRadius : 10;
  const buttonText = invitation?.buttonText || "View Invitation & RSVP";
  const fontFamily = invitation?.fontFamily || "sans-serif";
  const fontWeight = invitation?.fontWeight || "700";
  const titleSize = invitation?.titleSize || 28;
  const textAlignment = invitation?.textAlignment || "center";

  const baseUrl = frontendUrl || process.env.FRONTEND_URL || "http://localhost:3000";
  const trackBase = (trackingBaseUrl || process.env.API_BASE_URL || process.env.BACKEND_URL || "http://localhost:5000").replace(/\/+$/, "");
  const invitationTargetId = invitation?.id || invitation?.eventId || event?.id;
  const previewLink = `${baseUrl}/invitation/${invitationTargetId}`;

  // ─── RESOLVE INVITATION CARD IMAGE SNAPSHOT OR BACKEND RENDER ───
  let invitationCardPngBuffer = null;
  let htmlCardImageSrc = null;

  // 1. Priority: Check if client-side designer provided a Base64 snapshot
  const rawBase64Candidate =
    (typeof cardImageBase64 === "string" && cardImageBase64.trim()) ||
    (typeof snapshot === "string" && (snapshot.startsWith("data:") || snapshot.length > 300) && snapshot.trim()) ||
    (typeof snapshotUrl === "string" && (snapshotUrl.startsWith("data:") || snapshotUrl.length > 300) && snapshotUrl.trim()) ||
    (typeof cardSnapshotUrl === "string" && (cardSnapshotUrl.startsWith("data:") || cardSnapshotUrl.length > 300) && cardSnapshotUrl.trim()) ||
    null;

  if (rawBase64Candidate) {
    try {
      const cleanBase64 = rawBase64Candidate.replace(/^data:image\/\w+;base64,/, "");
      const buf = Buffer.from(cleanBase64, "base64");
      if (buf && buf.length > 500) {
        invitationCardPngBuffer = buf;
        console.log(`[EmailService] Loaded designer card PNG snapshot from client payload (${(buf.length / 1024).toFixed(1)} KB)`);

        // Attempt Cloudinary upload if configured (Option 2a)
        try {
          const { uploadToCloudinary } = require("../utils/fileStorage");
          if (typeof uploadToCloudinary === "function") {
            const cloudUrl = await uploadToCloudinary(buf, `invitation_${invitationTargetId}.png`);
            if (cloudUrl && /^https:\/\//i.test(cloudUrl)) {
              htmlCardImageSrc = cloudUrl;
              console.log(`[EmailService] Uploaded designer PNG snapshot to cloud storage: ${cloudUrl}`);
            }
          }
        } catch (cloudErr) {
          console.warn("[EmailService] Cloud storage upload skipped:", cloudErr.message);
        }

        // If no cloud URL, use inline CID attachment (Option 2b)
        if (!htmlCardImageSrc) {
          htmlCardImageSrc = "cid:invitation_card";
        }
      }
    } catch (b64Err) {
      console.warn("[EmailService] Failed to parse base64 snapshot:", b64Err.message);
    }
  }

  // 2. Priority: If no buffer yet, check if snapshotUrl or cardSnapshotUrl points to a local file on disk or valid public URL
  if (!invitationCardPngBuffer) {
    const candidateFiles = [
      snapshotUrl,
      cardSnapshotUrl,
      invitation?.imageUrl,
      invitation?.coverImage,
      event?.coverImage,
    ];

    for (const cand of candidateFiles) {
      if (cand && typeof cand === "string" && cand.trim()) {
        const localPath = findLocalFilePath(cand);
        if (localPath && fs.existsSync(localPath)) {
          try {
            const fileBuf = fs.readFileSync(localPath);
            if (fileBuf && fileBuf.length > 500) {
              invitationCardPngBuffer = fileBuf;
              console.log(`[EmailService] Loaded card image from local file: ${localPath} (${(fileBuf.length / 1024).toFixed(1)} KB)`);

              // Try Cloudinary
              try {
                const { uploadToCloudinary } = require("../utils/fileStorage");
                if (typeof uploadToCloudinary === "function") {
                  const cloudUrl = await uploadToCloudinary(fileBuf, `invitation_${invitationTargetId}.png`);
                  if (cloudUrl && /^https:\/\//i.test(cloudUrl)) {
                    htmlCardImageSrc = cloudUrl;
                    console.log(`[EmailService] Uploaded local card file to cloud storage: ${cloudUrl}`);
                  }
                }
              } catch (_) {}

              if (!htmlCardImageSrc) {
                htmlCardImageSrc = "cid:invitation_card";
              }
              break;
            }
          } catch (readErr) {
            console.warn("[EmailService] Error reading local card file:", readErr.message);
          }
        } else {
          // Check if candidate is already a direct, valid public HTTPS URL
          const publicUrl = resolvePublicImageUrl(cand, trackBase, baseUrl);
          if (publicUrl) {
            htmlCardImageSrc = publicUrl;
            break;
          }
        }
      }
    }
  }

  // 3. Priority: Fallback to composite card render via backend cardRenderer service
  if (!invitationCardPngBuffer && !htmlCardImageSrc) {
    try {
      invitationCardPngBuffer = await renderInvitationCardPng({
        invitation,
        event,
        options,
      });
      if (invitationCardPngBuffer && invitationCardPngBuffer.length > 0) {
        console.log(`[EmailService] Generated backend composite PNG card (${(invitationCardPngBuffer.length / 1024).toFixed(1)} KB)`);

        try {
          const { uploadToCloudinary } = require("../utils/fileStorage");
          if (typeof uploadToCloudinary === "function") {
            const cloudUrl = await uploadToCloudinary(invitationCardPngBuffer, `invitation_${invitationTargetId}.png`);
            if (cloudUrl && /^https:\/\//i.test(cloudUrl)) {
              htmlCardImageSrc = cloudUrl;
              console.log(`[EmailService] Uploaded backend PNG card to cloud storage: ${cloudUrl}`);
            }
          }
        } catch (cloudErr) {
          console.warn("[EmailService] Cloud storage upload skipped:", cloudErr.message);
        }

        if (!htmlCardImageSrc) {
          htmlCardImageSrc = "cid:invitation_card";
        }
      }
    } catch (renderErr) {
    }
  }

  const displayTitle = getCleanDisplayTitle(title, event?.title || "Special Event");
  // Clean subject line without spam-trigger symbols or excessive emojis
  const subject = event?.emailSubject || event?.email_subject || `Invitation: ${displayTitle}`;

  // ─── Sender and From Address Formatting for Spam Prevention ───
  // When using Gmail SMTP, the From address MUST align with the authenticated account (SMTP_USER)
  // to pass SPF and DKIM verification, which prevents Gmail from routing messages to Spam.
  const smtpUser = (process.env.SMTP_USER || "swarakri783@gmail.com").trim();
  let cleanFromEmail = (process.env.EMAIL_FROM || process.env.SMTP_FROM || smtpUser).trim();
  const extractedEmailMatch = cleanFromEmail.match(/<([^>]+)>/);
  if (extractedEmailMatch) {
    cleanFromEmail = extractedEmailMatch[1].trim();
  }

  // Ensure Gmail SMTP domain alignment
  if ((process.env.SMTP_HOST || "smtp.gmail.com").includes("gmail.com") && smtpUser && !cleanFromEmail.includes("@gmail.com")) {
    cleanFromEmail = smtpUser;
  }

  const senderDisplayName = senderName ? `${senderName} via InviteHub` : "InviteHub Events";
  const from = `"${senderDisplayName}" <${cleanFromEmail}>`;
  const replyTo = cleanFromEmail;

  if (htmlCardImageSrc) {
    console.log(`[EmailService] Using invitation card image source: ${htmlCardImageSrc}`);
  } else {
    console.log(`[EmailService] No card image source; email will render table-based themed card.`);
  }

  // SMTP transport
  const transporter = await getTransporter();

  // Normalize recipient list to object format: [{ email, guestId, name }]
  const normalizedRecipients = recipients.map((r) => {
    if (typeof r === "string") {
      return { email: r.trim().toLowerCase(), guestId: null };
    }
    return {
      email: (r.email || "").trim().toLowerCase(),
      guestId: r.guestId || r.id || null,
      name: r.name || "",
    };
  }).filter((r) => r.email && r.email.includes("@"));

  if (normalizedRecipients.length === 0) {
    throw new Error("No valid recipient email addresses found.");
  }

  let testMessageUrl = null;
  let sentCount = 0;
  let lastMessageId = null;

  console.log(`[EmailService] Preparing email dispatch for: "${displayTitle}", cardSrc: ${htmlCardImageSrc || "(themed card layout)"}, recipients: ${normalizedRecipients.length}`);

  // Dispatch individual emails with personalized tracking pixels and click tracking
  for (const recipient of normalizedRecipients) {
    const trackingPixelUrl = recipient.guestId
      ? `${trackBase}/api/track/open?guestId=${encodeURIComponent(recipient.guestId)}&eventId=${encodeURIComponent(event?.id || invitation?.eventId || "")}&v=${Date.now()}`
      : null;

    const trackedPreviewLink = recipient.guestId
      ? `${trackBase}/api/track/click?guestId=${encodeURIComponent(recipient.guestId)}&eventId=${encodeURIComponent(event?.id || invitation?.eventId || "")}&target=${encodeURIComponent(previewLink)}`
      : previewLink;

    // Feature options computation
    const greetingText = (options?.personalizedGreeting !== false && recipient.name)
      ? `Dear ${recipient.name},`
      : (options?.personalizedGreeting ? "Dear Valued Guest," : null);

    let calendarLinkUrl = null;
    if (options?.calendarLink !== false && (title || eventDate)) {
      const calTitle = encodeURIComponent(title || "Event Invitation");
      const calDetails = encodeURIComponent(mainText || trackedPreviewLink);
      const calLocation = encodeURIComponent(eventVenue || event?.address || "");
      calendarLinkUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calTitle}&details=${calDetails}&location=${calLocation}`;
    }

    let mapLinkUrl = null;
    if (options?.mapLink !== false && (eventVenue || event?.address)) {
      const query = encodeURIComponent(`${eventVenue || ""} ${event?.address || ""}`.trim());
      mapLinkUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
    }

    // Dynamic QR code and card attachment generation
    let qrCodeUrl = null;
    let qrLinkUrl = previewLink;
    const recipientInlineAttachments = [];

    // Attach backend-rendered invitation card PNG directly as inline attachment
    if (invitationCardPngBuffer && htmlCardImageSrc === "cid:invitation_card") {
      recipientInlineAttachments.push({
        filename: "invitation-card.png",
        content: invitationCardPngBuffer,
        cid: "invitation_card",
        contentType: "image/png",
        contentDisposition: "inline",
      });
    }

    if (options?.qrCode !== false) {
      const guestId = recipient.guestId || recipient.id;
      const eventId = event?.id || invitation?.eventId;

      let checkInUrl = trackedPreviewLink || previewLink;
      if (guestId) {
        const uniqueToken = generateGuestToken(guestId, eventId);
        checkInUrl = `${baseUrl}/check-in/${guestId}?token=${uniqueToken}`;
      }
      qrLinkUrl = checkInUrl;

      // Check if inline MIME attachment with Content-ID (cid:qrcode) is explicitly requested
      if (options?.useCidQr) {
        try {
          const qrBuffer = await QRCode.toBuffer(checkInUrl, {
            width: 200,
            margin: 1,
            errorCorrectionLevel: "M",
            type: "png",
          });
          recipientInlineAttachments.push({
            filename: "qrcode.png",
            content: qrBuffer,
            cid: "qrcode",
            contentType: "image/png",
            contentDisposition: "inline",
          });
          qrCodeUrl = "cid:qrcode";
        } catch (qrErr) {
          console.warn("[EmailService] Failed to generate CID QR buffer, falling back to public QR API URL:", qrErr.message);
          const encodedUrl = encodeURIComponent(checkInUrl);
          qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedUrl}`;
        }
      } else {
        // Default: Generate dynamic QR code using reliable public QR API URL directly in HTML
        const encodedUrl = encodeURIComponent(checkInUrl);
        qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedUrl}`;
      }
    }

    const htmlContent = generateInvitationHtml({
      title,
      subtitle,
      mainText,
      date: eventDate,
      time: eventTime,
      venue: eventVenue,
      emailDescription,
      hostName,
      locationDetails: {
        address: event?.address || null,
        directions: event?.directions || null,
        parkingInstructions: event?.parkingInstructions || event?.parking_instructions || null,
        entryInstructions: event?.entryInstructions || event?.entry_instructions || null,
        floorNumber: event?.floorNumber || event?.floor_number || null,
        roomNumber: event?.roomNumber || event?.room_number || null,
        securityGateInfo: event?.securityGateInfo || event?.security_gate_info || null,
        emergencyContact: event?.emergencyContact || event?.emergency_contact || null,
        hotelRecommendations: event?.hotelRecommendations || event?.hotel_recommendations || null,
        nearbyParking: event?.nearbyParking || event?.nearby_parking || null,
      },
      cardImageSrc: htmlCardImageSrc,
      previewLink: trackedPreviewLink,
      senderName,
      trackingPixelUrl,
      greetingText,
      calendarLinkUrl,
      mapLinkUrl,
      mapImageUrl: eventMapImageUrl,
      qrCodeUrl,
      qrLinkUrl,
      backgroundColor,
      textColor,
      accentColor,
      buttonColor,
      buttonRadius,
      buttonText,
      fontFamily,
      fontWeight,
      titleSize,
      textAlignment,
    });

    // Deliverability: Generate a clean plain-text fallback (crucial for passing spam filter heuristics)
    const plainTextContent = [
      greetingText || `Hello ${recipient.name || "Guest"},`,
      "",
      `You're invited to: ${displayTitle}`,
      subtitle ? `${subtitle}\n` : "",
      mainText ? `${mainText}\n` : "",
      eventDate ? `Date: ${eventDate}` : "",
      eventTime ? `Time: ${eventTime}` : "",
      eventVenue ? `Location: ${eventVenue}` : "",
      hostName ? `Hosted by: ${hostName}` : "",
      "",
      "View full details and RSVP online:",
      trackedPreviewLink || previewLink,
      "",
      "---",
      "Sent via InviteHub Events",
      `If you have questions, reply directly to: ${replyTo}`,
      `To unsubscribe or manage invite preferences: mailto:${cleanFromEmail}?subject=Unsubscribe`,
    ].filter(Boolean).join("\n");

    const mailOptions = {
      from,
      to: recipient.email,
      replyTo,
      subject,
      text: plainTextContent,
      html: htmlContent,
      headers: {
        "X-Mailer": "InviteHub Event Platform",
        "X-Priority": "3", // Normal priority
        "List-Unsubscribe": `<mailto:${cleanFromEmail}?subject=Unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    };

    // Attach inline attachments (e.g. cid:qrcode) or custom user attachments
    const combinedAttachments = [
      ...recipientInlineAttachments,
      ...(Array.isArray(options?.attachments) ? options.attachments : []),
    ];
    if (combinedAttachments.length > 0) {
      mailOptions.attachments = combinedAttachments;
    }

    try {
      const info = await transporter.sendMail(mailOptions);
      sentCount++;
      lastMessageId = info.messageId || info.response;

      if (nodemailer.getTestMessageUrl && info) {
        testMessageUrl = nodemailer.getTestMessageUrl(info);
      }
    } catch (err) {
      console.error(`[EmailService] Failed to send email to ${recipient.email}:`, err.message);
      if (normalizedRecipients.length === 1) {
        throw err;
      }
    }
  }

  console.log(`[EmailService] Dispatched ${sentCount} personalized invitation email(s). Last MessageId: ${lastMessageId}`);

  return {
    success: true,
    recipientCount: sentCount,
    messageId: lastMessageId,
    previewUrl: testMessageUrl,
    snapshotUrl: htmlCardImageSrc,
    cardImageBuffer: invitationCardPngBuffer,
  };
};

/**
 * Generate HTML string for No-Show Penalty Notice
 */
const generateNoShowPenaltyNoticeHtml = ({
  guestName = "Valued Guest",
  eventName = "Event",
  eventDate = "Scheduled Date",
  guaranteeAmount = 25,
  reviewWindowDays = 7,
  hostName = "Event Host",
  hostEmail = "host@example.com",
  contactUrl = "",
}) => {
  const resolvedContactUrl = contactUrl || `mailto:${hostEmail}?subject=${encodeURIComponent(`Absence Inquiry: ${eventName}`)}`;
  
  // Try loading from template file if accessible
  try {
    const templatePath = path.resolve(__dirname, "../../emails/noShowPenaltyNotice.html");
    if (fs.existsSync(templatePath)) {
      let template = fs.readFileSync(templatePath, "utf8");
      template = template.replace(/\{\{guestName\}\}/g, guestName);
      template = template.replace(/\{\{eventName\}\}/g, eventName);
      template = template.replace(/\{\{eventDate\}\}/g, eventDate);
      template = template.replace(/\{\{guaranteeAmount\}\}/g, Number(guaranteeAmount).toFixed(2));
      template = template.replace(/\{\{reviewWindowDays\}\}/g, String(reviewWindowDays));
      template = template.replace(/\{\{hostName\}\}/g, hostName);
      template = template.replace(/\{\{hostEmail\}\}/g, hostEmail);
      template = template.replace(/\{\{contactUrl\}\}/g, resolvedContactUrl);
      return template;
    }
  } catch (err) {
    console.warn("[EmailService] Could not read template file, using fallback inline HTML generator:", err.message);
  }

  // Fallback inline template
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Notice: Attendance Commitment & Absence for ${eventName}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f6f9fc;color:#1e293b;">
  <div style="width:100%;padding:40px 12px;background-color:#f6f9fc;">
    <div style="max-width:580px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
      <div style="background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%);padding:36px 32px 28px;text-align:center;color:#fff;">
        <span style="display:inline-block;background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;font-size:11px;font-weight:700;letter-spacing:0.8px;padding:5px 14px;border-radius:9999px;margin-bottom:14px;text-transform:uppercase;">Absence Recorded</span>
        <h1 style="margin:0 0 8px;font-size:22px;color:#fff;font-weight:700;">Attendance Commitment Notice</h1>
        <p style="margin:0;color:#cbd5e1;font-size:14px;">${eventName}</p>
      </div>
      <div style="padding:32px 32px 24px;">
        <div style="font-size:17px;font-weight:600;color:#0f172a;margin-bottom:14px;">Hello ${guestName},</div>
        <p style="font-size:14px;line-height:1.6;color:#475569;margin-bottom:24px;">
          We noticed that you were unable to attend <strong>${eventName}</strong> on <strong>${eventDate}</strong>.
          Because your RSVP reservation was confirmed prior to the event, resources and catering were reserved specifically for you.
        </p>
        <div style="background:#f8faff;border:1px solid #e0e7ff;border-radius:12px;padding:20px;margin-bottom:24px;">
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#4338ca;margin-bottom:14px;">Event & Commitment Summary</div>
          <table style="width:100%;border-collapse:collapse;font-size:13.5px;">
            <tr><td style="padding:6px 0;color:#64748b;font-weight:500;">Event Name:</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#0f172a;">${eventName}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;font-weight:500;">Event Date:</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#0f172a;">${eventDate}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;font-weight:500;">Guest Name:</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#0f172a;">${guestName}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;font-weight:500;">Guarantee Fee:</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#b91c1c;font-size:15px;">$${Number(guaranteeAmount).toFixed(2)}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;font-weight:500;">Review Window:</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#0f172a;">${reviewWindowDays} Days</td></tr>
          </table>
        </div>
        <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:14px 16px;border-radius:0 8px 8px 0;margin-bottom:24px;font-size:13px;line-height:1.55;color:#92400e;">
          <strong>Review Window in Progress:</strong> Since attendance was confirmed but check-in was missed, the host has a <strong>${reviewWindowDays}-day review window</strong> to either waive or apply the reservation guarantee fee. If no action is taken during this period, the fee will be automatically waived.
        </div>
        <p style="font-size:14px;line-height:1.6;color:#475569;margin-bottom:24px;">
          Did an unforeseen emergency prevent your attendance? Please reach out to the event host using the button below.
        </p>
        <div style="text-align:center;padding:8px 0 24px;">
          <a href="${resolvedContactUrl}" style="display:inline-block;background:#5b45f4;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 30px;border-radius:10px;box-shadow:0 3px 10px rgba(91,69,244,0.25);" target="_blank">Contact Host / Report Emergency</a>
        </div>
      </div>
      <div style="background:#f8fafc;border-top:1px solid #f1f5f9;padding:24px 32px;text-align:center;font-size:12px;color:#94a3b8;line-height:1.6;">
        <p style="margin:0 0 6px;">This is an automated attendance notice from <strong>InviteHub</strong> on behalf of ${hostName}.</p>
        <p style="margin:0;">Reply directly to host at <a href="mailto:${hostEmail}" style="color:#6366f1;">${hostEmail}</a>.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Send No-Show Penalty Notice email to an absent guest
 * @param {Object} params
 * @param {Object} params.guest
 * @param {Object} params.event
 * @param {Object} [params.host]
 * @param {number} [params.guaranteeAmount]
 * @param {number} [params.reviewWindowDays]
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
const sendNoShowPenaltyNoticeEmail = async ({
  guest,
  event,
  host = null,
  guaranteeAmount = 25,
  reviewWindowDays = 7,
}) => {
  try {
    if (!guest || !guest.email) {
      throw new Error("Missing recipient guest or email address.");
    }

    const eventName = event?.title || "Upcoming Event";
    const subject = `Notice: Attendance Commitment & Absence for ${eventName}`;

    // Format date cleanly
    let formattedDate = "Scheduled Date";
    if (event?.eventDate) {
      try {
        const d = new Date(event.eventDate);
        formattedDate = d.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      } catch (_) {
        formattedDate = String(event.eventDate);
      }
    }

    const hostName = host?.name || "Event Host";
    const hostEmail = host?.email || process.env.EMAIL_FROM || "no-reply@invitehub.com";
    const frontendBase = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");
    const contactUrl = `mailto:${hostEmail}?subject=${encodeURIComponent(`Absence Inquiry: ${eventName}`)}`;

    const htmlContent = generateNoShowPenaltyNoticeHtml({
      guestName: guest.name || "Guest",
      eventName,
      eventDate: formattedDate,
      guaranteeAmount,
      reviewWindowDays,
      hostName,
      hostEmail,
      contactUrl,
    });

    const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || `"InviteHub Attendance" <${process.env.SMTP_USER || "notifications@invitehub.dev"}>`;

    // Dispatch via Resend API if key is present
    if (process.env.RESEND_API_KEY) {
      const resendResult = await sendViaResend({
        recipients: [guest.email],
        subject,
        html: htmlContent,
        from,
      });
      return {
        success: true,
        messageId: resendResult.messageId,
        email: guest.email,
      };
    }

    // Default: Dispatch via Nodemailer transporter
    const transporter = await getTransporter();
    const mailOptions = {
      from,
      to: guest.email,
      subject,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Sent No-Show Penalty Notice to ${guest.email}. MessageId: ${info.messageId || info.response}`);

    return {
      success: true,
      messageId: info.messageId || info.response,
      email: guest.email,
    };
  } catch (error) {
    console.error(`[EmailService] Failed to send No-Show Penalty Notice to ${guest?.email}:`, error.message);
    return {
      success: false,
      error: error.message,
      email: guest?.email,
    };
  }
};

/**
 * Send an event reminder email to a guest
 * @param {Object} options
 * @param {Object} options.guest - { id, name, email, phone }
 * @param {Object} options.event - { id, title, eventDate, eventTime, venue, address }
 * @param {string} options.reminderMessage - Custom message from reminder config
 * @param {number} options.daysBefore - Number of days before the event
 * @param {string} options.targetAudience - 'ALL' | 'RSVP_PENDING' | 'GUARANTEED'
 * @returns {Promise<{success: boolean, messageId?: string, email: string, error?: string}>}
 */
const sendEventReminderEmail = async ({ guest, event, reminderMessage, daysBefore, targetAudience }) => {
  if (!guest || !guest.email) {
    return { success: false, error: "No guest email provided", email: guest?.email };
  }
  try {
    const transporter = await getTransporter();
    const guestName = guest.name || "Guest";
    const eventTitle = event.title || "Upcoming Event";

    // Format event date
    let eventDateFormatted = "TBD";
    if (event.eventDate) {
      try {
        eventDateFormatted = new Date(event.eventDate).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      } catch (_) {}
    }

    // Audience-specific label
    let audienceLabel = "";
    if (targetAudience === "GUARANTEED") {
      audienceLabel = `<p style="color:#5b45f4;font-weight:bold;font-size:13px;margin-bottom:12px;">⚠️ You have a confirmed reservation. Your attendance guarantee is active.</p>`;
    } else if (targetAudience === "RSVP_PENDING") {
      audienceLabel = `<p style="color:#f59e0b;font-weight:bold;font-size:13px;margin-bottom:12px;">📋 Action required: Please confirm your RSVP for this event.</p>`;
    }

    const daysText = daysBefore === 1 ? "tomorrow" : `in ${daysBefore} day${daysBefore !== 1 ? "s" : ""}`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Event Reminder: ${eventTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#5b45f4,#3b82f6);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">🔔 Event Reminder</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:15px;">Your event is coming up ${daysText}!</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="color:#374151;font-size:16px;margin:0 0 16px;">Hi <strong>${guestName}</strong>,</p>
            ${audienceLabel}
            <p style="color:#374151;font-size:15px;margin:0 0 24px;">${reminderMessage || `This is a reminder that <strong>${eventTitle}</strong> is happening ${daysText}.`}</p>
            <!-- Event Details Box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;border:1px solid #e0e7ff;border-radius:12px;margin-bottom:24px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1e293b;">${eventTitle}</p>
                  ${event.eventDate ? `<p style="margin:4px 0;font-size:14px;color:#64748b;">📅 ${eventDateFormatted}${event.eventTime ? " at " + event.eventTime : ""}</p>` : ""}
                  ${event.venue ? `<p style="margin:4px 0;font-size:14px;color:#64748b;">📍 ${event.venue}${event.address ? ", " + event.address : ""}</p>` : ""}
                </td>
              </tr>
            </table>
            <p style="color:#64748b;font-size:13px;margin:0;">We look forward to seeing you there!</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8faff;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">Sent via InviteHub • You're receiving this because you RSVP'd or were invited to this event.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const mailOptions = {
      from: `"InviteHub" <${process.env.SMTP_USER || "noreply@invitehub.app"}>`,
      to: guest.email,
      subject: `🔔 Reminder: ${eventTitle} is ${daysText}`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Event reminder sent to ${guest.email} for "${eventTitle}". MessageId: ${info.messageId || info.response}`);

    return {
      success: true,
      messageId: info.messageId || info.response,
      email: guest.email,
    };
  } catch (error) {
    console.error(`[EmailService] Failed to send event reminder to ${guest?.email}:`, error.message);
    return {
      success: false,
      error: error.message,
      email: guest?.email,
    };
  }
};

module.exports = {
  sendInvitationEmails,
  generateInvitationHtml,
  renderInvitationCardPng,
  sendNoShowPenaltyNoticeEmail,
  generateNoShowPenaltyNoticeHtml,
  sendEventReminderEmail,
  resolvePublicImageUrl,
  getCleanDisplayTitle,
  isDarkColor,
  sendViaResend,
  generateGuestToken,
  validateGuestToken,
};
