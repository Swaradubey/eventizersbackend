const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");
const {
  saveBase64Image,
  findLocalFilePath,
  isValidPublicUrl,
  getPublicBaseUrl,
  UPLOADS_DIR,
} = require("../utils/fileStorage");

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
const sendViaResend = async ({ recipients, subject, html, from }) => {
  const apiKey = process.env.RESEND_API_KEY;
  let fromAddress = from;
  if (!process.env.EMAIL_FROM && !process.env.SMTP_FROM) {
    fromAddress = "InviteHub Events <onboarding@resend.dev>";
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: recipients,
        subject: subject,
        html: html,
      }),
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
 * Safely parse and process a cover image or snapshot URL into an absolute public HTTPS/HTTP URL
 * @param {string} coverImage - The cover image string from event or invitation
 * @param {string} backendBaseUrl - Backend or API base URL
 * @param {string} frontendBaseUrl - Frontend application base URL
 * @returns {string|null}
 */
const resolvePublicImageUrl = (
  coverImage,
  backendBaseUrl = "http://localhost:5000",
  frontendBaseUrl = "http://localhost:3000"
) => {
  if (!coverImage || typeof coverImage !== "string") {
    return null;
  }

  const trimmed = coverImage.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") {
    return null;
  }

  // 1. Reject raw Base64 data URIs — Gmail, Outlook, Yahoo strip/block inline Base64 images
  if (trimmed.startsWith("data:")) {
    return null;
  }

  // 2. Reject temporary client-side blob URLs or local file protocol URIs
  if (trimmed.startsWith("blob:") || trimmed.startsWith("file:")) {
    return null;
  }

  // 3. If image URL contains localhost or dev ports (5000, 3000), external email clients cannot reach it
  if (
    trimmed.includes("localhost") ||
    trimmed.includes("127.0.0.1") ||
    trimmed.includes(":5000") ||
    trimmed.includes(":3000")
  ) {
    return null;
  }

  // 4. If URL points to /uploads/ on vercel without CDN, check if it's local only
  if (trimmed.includes("vercel.app/uploads/") || trimmed.includes("eventizersbackend.vercel.app")) {
    // Vercel serverless has ephemeral storage; uploads made locally or on serverless are not persistent public URLs
    return null;
  }

  // 5. Full HTTPS/HTTP URL (e.g. Cloudinary, AWS S3, Supabase, Firebase, CDN, Unsplash)
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.port === "5000" ||
        parsed.port === "3000"
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
  cardImageSrc,
  previewLink,
  senderName,
  trackingPixelUrl,
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

  // Strict validation: Guard to ensure image src is valid for email clients
  // ONLY allow valid HTTPS/HTTP URLs and CID references — reject raw Base64 data URIs and blob URLs
  const isValidImageUrl = Boolean(
    cardImageSrc &&
    typeof cardImageSrc === "string" &&
    cardImageSrc.trim() !== "" &&
    cardImageSrc !== "undefined" &&
    cardImageSrc !== "null" &&
    !cardImageSrc.startsWith("/") &&
    !cardImageSrc.startsWith("blob:") &&
    !cardImageSrc.startsWith("file:") &&
    !cardImageSrc.trim().startsWith("data:") &&
    (/^https?:\/\//i.test(cardImageSrc.trim()) || cardImageSrc.trim().startsWith("cid:"))
  );
  const imageUrl = isValidImageUrl ? cardImageSrc.trim() : null;

  return `
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
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
  </style>
</head>
<body style="margin: 0; padding: 0; width: 100% !important; background-color: ${bodyBg}; font-family: ${fontStack}; color: ${primaryText}; line-height: 1.6;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: ${bodyBg}; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table class="email-container" align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; width: 100%; background-color: ${containerBg}; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08); border: 1px solid ${metaBoxBorder};">
          
          <!-- ─── TOP BADGE & CLEAN EVENT TITLE HEADER ─── -->
          <tr>
            <td style="padding: 28px 24px 10px 24px; text-align: center;">
              <span style="display: inline-block; background-color: ${accent}15; color: ${accent}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; padding: 6px 16px; border-radius: 30px; border: 1px solid ${accent}30;">
                You're Cordially Invited
              </span>
              ${senderName ? `
              <p style="margin: 8px 0 4px 0; font-size: 13px; color: ${secondaryText}; font-weight: 500;">
                From <strong style="color: ${primaryText};">${senderName}</strong>
              </p>
              ` : ""}
              <h2 class="mobile-title" style="margin: 12px 0 6px 0; font-size: ${Math.min(28, titleSize || 24)}px; font-weight: ${fontWeight || "700"}; font-family: ${fontStack}; color: ${primaryText}; line-height: 1.3; text-align: center;">
                ${cleanTitle}
              </h2>
              ${subtitle ? `
              <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 500; color: ${secondaryText}; text-align: center;">
                ${subtitle}
              </p>
              ` : ""}
            </td>
          </tr>

          <!-- ─── 1. FULL INVITATION SNAPSHOT CARD / BANNER CARD ─── -->
          ${imageUrl ? `
          <tr>
            <td align="center" style="padding: 12px 16px 20px 16px;">
              <!--[if mso]>
              <table align="center" border="0" cellspacing="0" cellpadding="0" width="560">
              <tr>
              <td align="center" valign="top" width="560">
              <![endif]-->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto; max-width: 560px;">
                <tr>
                  <td align="center" style="border-radius: 12px; overflow: hidden; background-color: ${cardIsDark ? "#1e293b" : "#f1f5f9"};">
                    ${previewLink ? `<a href="${previewLink}" target="_blank" style="display: block; text-decoration: none; border: 0; outline: none;">` : ""}
                      <img 
                        src="${imageUrl}" 
                        alt="${cleanAltText}" 
                        width="560" 
                        border="0"
                        style="display: block; width: 100%; max-width: 560px; height: auto; margin: 0 auto; border-radius: 12px; border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; font-family: ${fontStack}; font-size: 15px; font-weight: 600; color: ${primaryText}; line-height: 1.4; text-align: center;" 
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
          ${mainText ? `
          <tr>
            <td style="padding: 0 24px 12px 24px; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: ${secondaryText}; line-height: 1.6;">
                ${mainText}
              </p>
            </td>
          </tr>
          ` : ""}
          ` : `
          <!-- ─── FALLBACK THEMED CARD BANNER (WHEN NO IMAGE IS PROVIDED) ─── -->
          <tr>
            <td style="padding: 12px 24px 16px 24px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${backgroundColor}; border-radius: 12px; padding: 24px 20px; text-align: ${textAlignment}; border: 1px solid ${metaBoxBorder}; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
                <tr>
                  <td align="${textAlignment}">
                    <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: ${textColor}; font-family: ${fontStack};">
                      ${cleanTitle}
                    </h3>
                    ${date ? `
                    <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: ${accent};">
                      📅 ${date}${time ? ` at ${time}` : ""}
                    </p>
                    ` : ""}
                    ${mainText ? `
                    <p style="margin: 0; font-size: 14px; color: ${textColor}; opacity: 0.9; line-height: 1.6;">
                      ${mainText}
                    </p>
                    ` : `
                    <p style="margin: 0; font-size: 14px; color: ${secondaryText}; line-height: 1.6;">
                      You are cordially invited to join us for this special celebration!
                    </p>
                    `}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `}

          <!-- ─── 2. CALL TO ACTION BUTTON ─── -->
          ${previewLink ? `
          <tr>
            <td align="center" style="padding: 8px 24px 20px 24px;">
              <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto;">
                <tr>
                  <td align="center" style="border-radius: ${btnRadius}px; background-color: ${btnColor};">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${previewLink}" style="height:50px;v-text-anchor:middle;width:260px;" arcsize="${Math.min(50, Math.round(btnRadius * 4))}%" stroke="f" fillcolor="${btnColor}">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">${safeButtonText}</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-- -->
                    <a class="cta-button" href="${previewLink}" target="_blank" style="background-color: ${btnColor}; color: #ffffff; font-weight: 700; font-size: 15px; border-radius: ${btnRadius}px; padding: 14px 36px; text-decoration: none; display: inline-block; border: none; letter-spacing: 0.3px; box-shadow: 0 4px 16px ${btnColor}40; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                      ${safeButtonText}
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: ${secondaryText};">
                Click above to view full event details, add to calendar, and submit your RSVP.
              </p>
            </td>
          </tr>
          ` : ""}

          <!-- ─── 3. EVENT DETAILS SUMMARY BOX ─── -->
          ${(date || time || venue) ? `
          <tr>
            <td style="padding: 0 24px 20px 24px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${metaBoxBg}; border-radius: 12px; padding: 16px 20px; border: 1px solid ${metaBoxBorder};">
                ${date ? `
                <tr>
                  <td width="28" style="vertical-align: middle; padding: 5px 0; font-size: 16px;">📅</td>
                  <td style="font-size: 14px; color: ${primaryText}; padding: 5px 0; vertical-align: middle;">
                    <strong style="color: ${accent}; font-weight: 600;">Date:</strong> <span style="font-weight: 500;">${date}</span>
                  </td>
                </tr>
                ` : ""}
                ${time ? `
                <tr>
                  <td width="28" style="vertical-align: middle; padding: 5px 0; font-size: 16px;">⏰</td>
                  <td style="font-size: 14px; color: ${primaryText}; padding: 5px 0; vertical-align: middle;">
                    <strong style="color: ${accent}; font-weight: 600;">Time:</strong> <span style="font-weight: 500;">${time}</span>
                  </td>
                </tr>
                ` : ""}
                ${venue ? `
                <tr>
                  <td width="28" style="vertical-align: middle; padding: 5px 0; font-size: 16px;">📍</td>
                  <td style="font-size: 14px; color: ${primaryText}; padding: 5px 0; vertical-align: middle;">
                    <strong style="color: ${accent}; font-weight: 600;">Location:</strong> <span style="font-weight: 500;">${venue}</span>
                  </td>
                </tr>
                ` : ""}
              </table>
            </td>
          </tr>
          ` : ""}

          <!-- ─── 4. FOOTER ─── -->
          <tr>
            <td style="background-color: ${cardIsDark ? "#090d16" : "#f8fafc"}; padding: 20px 24px; text-align: center; border-top: 1px solid ${metaBoxBorder}; font-size: 12px; color: ${secondaryText}; line-height: 1.5;">
              <p style="margin: 0 0 4px 0;">Sent via <strong style="color: ${primaryText};">InviteHub</strong></p>
              <p style="margin: 0; font-size: 11px; color: ${secondaryText};">If you have any questions, please contact your event host.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
  ${trackingPixelUrl && /^https?:\/\//i.test(trackingPixelUrl) ? `
  <!-- Invisible 1x1 Open Rate Tracking Pixel -->
  <img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none !important; width:0px !important; height:0px !important; max-height:0px !important; max-width:0px !important; opacity:0 !important; overflow:hidden !important; line-height:0 !important; font-size:0 !important; mso-hide:all !important;" />
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
  const title = invitation?.title || event?.title || "Special Event Invitation";
  const subtitle = invitation?.subtitle || "";
  const mainText = invitation?.mainText || event?.description || "";

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

  // ─── Image source resolution & CID inline attachment setup ───
  // Strategy: ALWAYS prefer CID inline attachment for maximum email client
  // compatibility. CID works in Gmail, Outlook, Yahoo, Apple Mail regardless
  // of whether backend is on localhost or a public domain.
  let resolvedCardImageSrc = null;
  let localSnapshotFilePath = null;
  let rawBase64ForCid = null; // Raw Base64 string for direct CID attachment

  // Collect all raw snapshot sources (prioritised)
  const rawSnapshotInput = snapshot || cardImageBase64 || snapshotUrl || cardSnapshotUrl || null;

  // 1. Direct snapshot URL provided
  const directSnapshotUrl = snapshotUrl || cardSnapshotUrl;
  if (directSnapshotUrl && typeof directSnapshotUrl === "string" && directSnapshotUrl.trim()) {
    const trimmedUrl = directSnapshotUrl.trim();
    if (trimmedUrl.startsWith("data:") || (!trimmedUrl.startsWith("http") && !trimmedUrl.startsWith("/") && trimmedUrl.length > 300)) {
      // It's actually Base64 data passed as snapshotUrl — save to disk for CID attachment
      rawBase64ForCid = trimmedUrl;
      try {
        const savedRes = await saveBase64Image(trimmedUrl, null, "invitation_snapshot");
        if (savedRes && savedRes.url) {
          resolvedCardImageSrc = resolvePublicImageUrl(savedRes.url, trackBase, baseUrl);
          if (savedRes.filePath && fs.existsSync(savedRes.filePath)) {
            localSnapshotFilePath = savedRes.filePath;
          }
        }
      } catch (err) {
        console.warn("[EmailService] Failed to save Base64 snapshot from snapshotUrl:", err.message);
      }
    } else {
      resolvedCardImageSrc = resolvePublicImageUrl(trimmedUrl, trackBase, baseUrl);
      const discoveredPath = findLocalFilePath(trimmedUrl);
      if (discoveredPath) {
        localSnapshotFilePath = discoveredPath;
      }
    }
  }

  // 2. Raw snapshot / Base64 provided directly
  if (!localSnapshotFilePath && rawSnapshotInput && typeof rawSnapshotInput === "string" && rawSnapshotInput.trim()) {
    const trimmedRaw = rawSnapshotInput.trim();
    if (trimmedRaw.startsWith("data:") || (!trimmedRaw.startsWith("http") && !trimmedRaw.startsWith("/") && trimmedRaw.length > 300)) {
      rawBase64ForCid = trimmedRaw;
      try {
        const savedRes = await saveBase64Image(trimmedRaw, null, "invitation_snapshot");
        if (savedRes && savedRes.url) {
          if (!resolvedCardImageSrc) {
            resolvedCardImageSrc = resolvePublicImageUrl(savedRes.url, trackBase, baseUrl);
          }
          if (savedRes.filePath && fs.existsSync(savedRes.filePath)) {
            localSnapshotFilePath = savedRes.filePath;
          }
        }
      } catch (err) {
        console.warn("[EmailService] Failed to save raw Base64 snapshot:", err.message);
      }
    }
  }

  // 3. Explicit cardImageBase64 field (may not have been caught above)
  if (!localSnapshotFilePath && cardImageBase64 && typeof cardImageBase64 === "string" && cardImageBase64.trim()) {
    rawBase64ForCid = cardImageBase64.trim();
    try {
      const savedRes = await saveBase64Image(cardImageBase64, null, "invitation_snapshot");
      if (savedRes && savedRes.url) {
        if (!resolvedCardImageSrc) {
          resolvedCardImageSrc = resolvePublicImageUrl(savedRes.url, trackBase, baseUrl);
        }
        if (savedRes.filePath && fs.existsSync(savedRes.filePath)) {
          localSnapshotFilePath = savedRes.filePath;
        }
      }
    } catch (err) {
      console.warn("[EmailService] Failed to save cardImageBase64 snapshot:", err.message);
    }
  }

  // 4. Fallback to event/invitation image across all possible fields if not already resolved
  if (!resolvedCardImageSrc && !localSnapshotFilePath) {
    const rawImage = (
      invitation?.imageUrl ||
      invitation?.cardImage ||
      invitation?.coverImage ||
      invitation?.templateUrl ||
      invitation?.snapshotUrl ||
      invitation?.bannerUrl ||
      invitation?.designData?.previewUrl ||
      invitation?.designData?.imageUrl ||
      event?.imageUrl ||
      event?.coverImage ||
      event?.cardImage ||
      event?.templateUrl ||
      event?.snapshotUrl ||
      event?.thumbnail ||
      event?.thumbnailUrl ||
      event?.uploadedFileUrl ||
      event?.bannerUrl ||
      event?.designData?.previewUrl ||
      event?.designData?.imageUrl ||
      null
    );

    if (rawImage && typeof rawImage === "string" && rawImage.trim()) {
      if (rawImage.startsWith("data:")) {
        rawBase64ForCid = rawImage;
        try {
          const savedRes = await saveBase64Image(rawImage, null, "event_cover");
          if (savedRes && savedRes.url) {
            resolvedCardImageSrc = resolvePublicImageUrl(savedRes.url, trackBase, baseUrl);
            if (savedRes.filePath && fs.existsSync(savedRes.filePath)) {
              localSnapshotFilePath = savedRes.filePath;
            }
          }
        } catch (e) {}
      } else {
        resolvedCardImageSrc = resolvePublicImageUrl(rawImage, trackBase, baseUrl);
        const discoveredPath = findLocalFilePath(rawImage);
        if (discoveredPath) {
          localSnapshotFilePath = discoveredPath;
        }
      }
    }
  }

  const displayTitle = getCleanDisplayTitle(title, event?.title || "Special Event");
  const subject = `✨ Invitation: ${displayTitle}`;
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || `"InviteHub Events" <no-reply@invitehub.com>`;

  // ─── Configure Nodemailer CID inline attachment ───
  // ALWAYS use CID inline attachment when we have image data. CID works universally
  // across all email clients. Public HTTPS URL is used as a secondary fallback only.
  const attachments = [];
  let htmlCardImageSrc = null;
  const CID_IDENTIFIER = `invitation-card-${Date.now()}@invitehub.io`;

  // Strategy A: Local file on disk → attach from file path (most reliable)
  if (localSnapshotFilePath && fs.existsSync(localSnapshotFilePath)) {
    const ext = path.extname(localSnapshotFilePath).toLowerCase().replace(".", "");
    const mimeMap = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif",
      svg: "image/svg+xml",
    };
    const mimeType = mimeMap[ext] || "image/png";

    try {
      const stats = fs.statSync(localSnapshotFilePath);
      if (stats.size > 100) {
        attachments.push({
          filename: `invitation-card.${ext || "png"}`,
          path: localSnapshotFilePath,
          cid: CID_IDENTIFIER,
          contentType: mimeType,
          contentDisposition: "inline",
        });
        htmlCardImageSrc = `cid:${CID_IDENTIFIER}`;
        console.log(`[EmailService] CID attachment created from local file (${(stats.size / 1024).toFixed(1)} KB): ${localSnapshotFilePath}`);
      }
    } catch (e) {
      console.warn("[EmailService] Error checking local file for CID:", e.message);
    }

  // Strategy B: Raw Base64 data available → attach directly as Base64 buffer
  } else if (rawBase64ForCid) {
    const cleanBase64 = rawBase64ForCid.replace(/^data:image\/\w+;base64,/, "");
    if (cleanBase64 && cleanBase64.length > 100) {
      let mimeType = "image/png";
      const mimeMatch = rawBase64ForCid.match(/^data:(image\/[a-zA-Z0-9+-]+);base64,/);
      if (mimeMatch && mimeMatch[1]) {
        mimeType = mimeMatch[1];
      }
      const extMap = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
      const ext = extMap[mimeType] || "png";

      attachments.push({
        filename: `invitation-card.${ext}`,
        content: cleanBase64,
        encoding: "base64",
        cid: CID_IDENTIFIER,
        contentType: mimeType,
        contentDisposition: "inline",
      });

      htmlCardImageSrc = `cid:${CID_IDENTIFIER}`;
      console.log(`[EmailService] CID attachment created from raw Base64 (${(cleanBase64.length / 1024).toFixed(1)} KB)`);
    }
  }

  // Strategy C: No local file or Base64 — fall back to verified public HTTPS URL only
  if (!htmlCardImageSrc && resolvedCardImageSrc && /^https?:\/\//i.test(resolvedCardImageSrc) && !resolvedCardImageSrc.includes("localhost") && !resolvedCardImageSrc.includes("127.0.0.1") && !resolvedCardImageSrc.includes(":5000") && !resolvedCardImageSrc.includes(":3000")) {
    htmlCardImageSrc = resolvedCardImageSrc;
    console.log(`[EmailService] Using verified public HTTPS URL for email image: ${htmlCardImageSrc}`);
  }

  // Safety check: if htmlCardImageSrc is CID but attachments is empty, set to null
  if (htmlCardImageSrc && htmlCardImageSrc.startsWith("cid:") && attachments.length === 0) {
    htmlCardImageSrc = null;
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

  console.log(`[EmailService] Preparing email dispatch for: "${displayTitle}", imageSrc: ${htmlCardImageSrc || "(fallback)"}, attachments: ${attachments.length}, recipients: ${normalizedRecipients.length}`);

  // Dispatch individual emails with personalized tracking pixels and click tracking
  for (const recipient of normalizedRecipients) {
    const trackingPixelUrl = recipient.guestId
      ? `${trackBase}/api/track/open?guestId=${encodeURIComponent(recipient.guestId)}&eventId=${encodeURIComponent(event?.id || invitation?.eventId || "")}&v=${Date.now()}`
      : null;

    const trackedPreviewLink = recipient.guestId
      ? `${trackBase}/api/track/click?guestId=${encodeURIComponent(recipient.guestId)}&eventId=${encodeURIComponent(event?.id || invitation?.eventId || "")}&target=${encodeURIComponent(previewLink)}`
      : previewLink;

    const htmlContent = generateInvitationHtml({
      title,
      subtitle,
      mainText,
      date: eventDate,
      time: eventTime,
      venue: eventVenue,
      cardImageSrc: htmlCardImageSrc,
      previewLink: trackedPreviewLink,
      senderName,
      trackingPixelUrl,
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

    const mailOptions = {
      from,
      to: recipient.email,
      subject,
      html: htmlContent,
      attachments: attachments.length > 0 ? attachments : undefined,
    };

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
    snapshotUrl: resolvedCardImageSrc,
  };
};

module.exports = {
  sendInvitationEmails,
  generateInvitationHtml,
  resolvePublicImageUrl,
  getCleanDisplayTitle,
  isDarkColor,
  sendViaResend,
};
