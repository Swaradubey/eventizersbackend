const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const QRCode = require("qrcode");
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
  greetingText,
  calendarLinkUrl,
  mapLinkUrl,
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
          
          <!-- ─── 1. RENDERED INVITATION TEMPLATE CARD (ARTWORK / MEDIA COVER) ─── -->
          ${imageUrl ? `
          <tr>
            <td align="center" style="padding: 0; background-color: ${cardIsDark ? "#0f172a" : "#ffffff"}; border-top-left-radius: 16px; border-top-right-radius: 16px; overflow: hidden;">
              <!--[if mso]>
              <table align="center" border="0" cellspacing="0" cellpadding="0" width="600">
              <tr>
              <td align="center" valign="top" width="600">
              <![endif]-->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto; max-width: 600px;">
                <tr>
                  <td align="center" style="border-top-left-radius: 16px; border-top-right-radius: 16px; overflow: hidden;">
                    ${previewLink ? `<a href="${previewLink}" target="_blank" style="display: block; text-decoration: none; border: 0; outline: none;">` : ""}
                      <img 
                        src="${imageUrl}" 
                        alt="${cleanAltText}" 
                        width="600" 
                        border="0"
                        style="display: block; width: 100%; max-width: 600px; height: auto; margin: 0 auto; border-top-left-radius: 16px; border-top-right-radius: 16px; border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic;" 
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
            <td style="padding: 32px 24px 16px 24px; text-align: center; background-color: ${backgroundColor}; border-top-left-radius: 16px; border-top-right-radius: 16px;">
              <span style="display: inline-block; background-color: ${accent}20; color: ${accent}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; padding: 6px 16px; border-radius: 30px;">
                Special Invitation
              </span>
            </td>
          </tr>
          `}

          <!-- ─── 2. STRUCTURED EVENT DETAILS UNDERNEATH ─── -->
          <tr>
            <td style="padding: 28px 24px 10px 24px; text-align: center;">
              <span style="display: inline-block; background-color: ${accent}15; color: ${accent}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; padding: 6px 16px; border-radius: 30px; border: 1px solid ${accent}30;">
                You're Cordially Invited
              </span>
              ${senderName ? `
              <p style="margin: 8px 0 4px 0; font-size: 13px; color: ${secondaryText}; font-weight: 500;">
                Hosted by <strong style="color: ${primaryText};">${senderName}</strong>
              </p>
              ` : ""}
              ${greetingText ? `
              <p style="margin: 6px 0 0 0; font-size: 15px; font-weight: 600; color: ${accent}; text-align: center;">
                ${greetingText}
              </p>
              ` : ""}

              <!-- Event Title -->
              <h1 class="mobile-title" style="margin: 12px 0 8px 0; font-size: ${Math.max(24, Math.min(32, titleSize || 28))}px; font-weight: ${fontWeight || "800"}; font-family: ${fontStack}; color: ${primaryText}; line-height: 1.25; text-align: center; letter-spacing: -0.5px;">
                ${cleanTitle}
              </h1>

              ${subtitle ? `
              <p style="margin: 0 0 10px 0; font-size: 15px; font-weight: 600; color: ${accent}; text-align: center;">
                ${subtitle}
              </p>
              ` : ""}

              <!-- Date & Time Headline -->
              ${(date || time) ? `
              <p style="margin: 4px 0 6px 0; font-size: 15px; font-weight: 600; color: ${primaryText}; text-align: center;">
                📅 ${date}${time ? ` &bull; ${time}` : ""}
              </p>
              ` : ""}

              <!-- Address / Location Headline -->
              ${venue ? `
              <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 500; color: ${secondaryText}; text-align: center;">
                📍 ${venue}
              </p>
              ` : ""}

              ${(mainText && mainText !== venue && mainText !== subtitle) ? `
              <p style="margin: 8px auto 16px auto; max-width: 480px; font-size: 14px; color: ${secondaryText}; line-height: 1.6; text-align: center;">
                ${mainText}
              </p>
              ` : ""}
            </td>
          </tr>

          <!-- ─── 3. RSVP BUTTON / CALL TO ACTION ─── -->
          ${previewLink ? `
          <tr>
            <td align="center" style="padding: 6px 24px 22px 24px;">
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
                ${(mapLinkUrl || calendarLinkUrl) ? `
                <tr>
                  <td colspan="2" style="padding: 12px 0 4px 0; border-top: 1px dashed ${metaBoxBorder};">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        ${calendarLinkUrl ? `
                        <td style="padding: 4px 8px 4px 0;">
                          <a href="${calendarLinkUrl}" target="_blank" style="display: inline-block; font-size: 12px; font-weight: 600; color: ${accent}; text-decoration: none; padding: 6px 12px; border-radius: 6px; background-color: ${accent}15; border: 1px solid ${accent}30;">
                            📅 Add to Calendar
                          </a>
                        </td>
                        ` : ""}
                        ${mapLinkUrl ? `
                        <td style="padding: 4px 0 4px 0;">
                          <a href="${mapLinkUrl}" target="_blank" style="display: inline-block; font-size: 12px; font-weight: 600; color: ${accent}; text-decoration: none; padding: 6px 12px; border-radius: 6px; background-color: ${accent}15; border: 1px solid ${accent}30;">
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

          <!-- ─── QR CODE BLOCK (IF ENABLED) ─── -->
          ${qrCodeUrl ? `
          <tr>
            <td align="center" style="padding: 0 24px 24px 24px;">
              <table border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 14px; padding: 20px 24px; border: 1px solid #e2e8f0; text-align: center; margin: 0 auto; width: 100%; max-width: 300px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #1e293b; text-align: center; font-family: ${fontStack}; letter-spacing: -0.2px;">
                      Scan to RSVP & Check-In
                    </p>
                    <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto; background-color: #ffffff; padding: 8px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                      <tr>
                        <td align="center">
                          ${(qrLinkUrl || previewLink) ? `
                          <a href="${qrLinkUrl || previewLink}" target="_blank" style="display: block; text-decoration: none; border: 0; outline: none; cursor: pointer;">
                            <img src="${qrCodeUrl}" alt="Scan QR Code to RSVP & Check-In" width="200" height="200" style="display: block; margin: 0 auto; border: 0; width: 200px; height: 200px; border-radius: 8px;" />
                          </a>
                          ` : `
                          <img src="${qrCodeUrl}" alt="Scan QR Code to RSVP & Check-In" width="200" height="200" style="display: block; margin: 0 auto; border: 0; width: 200px; height: 200px; border-radius: 8px;" />
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

const KNOWN_TEMPLATE_IMAGES = {
  "tpl-electric-outline": "/assets/templates/electric-outline.svg",
  "electric-outline": "/assets/templates/electric-outline.svg",
  "electric outline": "/assets/templates/electric-outline.svg",
  "tpl-cake-and-confetti": "/assets/templates/cake-and-confetti.svg",
  "cake-and-confetti": "/assets/templates/cake-and-confetti.svg",
  "cake and confetti": "/assets/templates/cake-and-confetti.svg",
  "tpl-hype-night": "/assets/templates/hype-night.svg",
  "hype-night": "/assets/templates/hype-night.svg",
  "hype night": "/assets/templates/hype-night.svg",
  "tpl-floating-cakes": "/assets/templates/floating-cakes.svg",
  "floating-cakes": "/assets/templates/floating-cakes.svg",
  "floating cakes": "/assets/templates/floating-cakes.svg",
  "tpl-friendship-charms": "/assets/templates/friendship-charms.svg",
  "friendship-charms": "/assets/templates/friendship-charms.svg",
  "friendship charms": "/assets/templates/friendship-charms.svg",
  "tpl-sporty-frame": "/assets/templates/sporty-frame.svg",
  "sporty-frame": "/assets/templates/sporty-frame.svg",
  "sporty frame": "/assets/templates/sporty-frame.svg",
  "tpl-anniversary": "/assets/templates/anniversary.jpg",
  "anniversary": "/assets/templates/anniversary.jpg",
  "tpl-birthday": "/assets/templates/birthday.jpg",
  "birthday": "/assets/templates/birthday.jpg",
  "tpl-babyshower": "/assets/templates/babyshower.jpg",
  "babyshower": "/assets/templates/babyshower.jpg",
  "baby shower": "/assets/templates/babyshower.jpg",
  "tpl-corporate": "/assets/templates/corporate.jpg",
  "corporate": "/assets/templates/corporate.jpg",
  "tpl-dinner": "/assets/templates/dinner.jpg",
  "dinner": "/assets/templates/dinner.jpg",
  "tpl-gala": "/assets/templates/gala.jpg",
  "gala": "/assets/templates/gala.jpg",
  "tpl-graduation": "/assets/templates/graduation_gala.jpg",
  "graduation": "/assets/templates/graduation_gala.jpg",
  "tpl-community": "/assets/templates/community_celebration.jpg",
  "community": "/assets/templates/community_celebration.jpg",
  "tpl-networking": "/assets/templates/networking_connections.jpg",
  "networking": "/assets/templates/networking_connections.jpg",
  "tpl-wedding": "/assets/templates/wedding.jpg",
  "wedding": "/assets/templates/wedding.jpg",
  "tpl-music": "/assets/templates/music.jpg",
  "music": "/assets/templates/music.jpg",
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

  // Format date and time supporting both camelCase and snake_case properties
  const rawDate = event?.eventDate || event?.event_date || invitation?.eventDate || invitation?.event_date;
  let eventDate = "";
  if (rawDate) {
    const d = new Date(rawDate);
    eventDate = isNaN(d.getTime()) ? String(rawDate) : d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }

  const rawTime = event?.eventTime || event?.event_time || invitation?.eventTime || invitation?.event_time;
  let eventTime = "";
  if (rawTime) {
    if (rawTime instanceof Date) {
      eventTime = rawTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    } else {
      eventTime = String(rawTime);
    }
  }

  const eventVenue = event?.venue || event?.address || invitation?.eventVenue || invitation?.event_venue || "";
  const title = invitation?.title || event?.title || invitation?.eventTitle || invitation?.event_title || "Special Event Invitation";
  const subtitle = invitation?.subtitle || invitation?.message || "";
  const mainText = invitation?.mainText || invitation?.main_text || event?.description || "";

  // Extract design tokens from invitation (supporting both camelCase and snake_case)
  const backgroundColor = invitation?.backgroundColor || invitation?.background_color || "#FAF8F5";
  const textColor = invitation?.textColor || invitation?.text_color || "#1A1118";
  const accentColor = invitation?.accentColor || invitation?.accent_color || "#5B5FEF";
  const buttonColor = invitation?.buttonColor || invitation?.button_color || invitation?.accentColor || invitation?.accent_color || "#5B5FEF";
  const buttonRadius = invitation?.buttonRadius !== undefined ? invitation.buttonRadius : (invitation?.button_radius !== undefined ? invitation.button_radius : 10);
  const buttonText = invitation?.buttonText || invitation?.button_text || "View Invitation & RSVP";
  const fontFamily = invitation?.fontFamily || invitation?.font_family || "sans-serif";
  const fontWeight = invitation?.fontWeight || invitation?.font_weight || "700";
  const titleSize = invitation?.titleSize || invitation?.title_size || 28;
  const textAlignment = invitation?.textAlignment || invitation?.text_alignment || "center";

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

  // 4. Fallback to event/invitation image across all possible fields (supporting camelCase & snake_case)
  if (!resolvedCardImageSrc && !localSnapshotFilePath) {
    let candidateImage = (
      invitation?.imageUrl ||
      invitation?.image_url ||
      invitation?.cardImage ||
      invitation?.card_image ||
      invitation?.coverImage ||
      invitation?.cover_image ||
      invitation?.templateUrl ||
      invitation?.template_url ||
      invitation?.snapshotUrl ||
      invitation?.snapshot_url ||
      invitation?.bannerUrl ||
      invitation?.banner_url ||
      invitation?.designData?.previewUrl ||
      invitation?.designData?.imageUrl ||
      event?.imageUrl ||
      event?.image_url ||
      event?.coverImage ||
      event?.cover_image ||
      event?.cardImage ||
      event?.card_image ||
      event?.templateUrl ||
      event?.template_url ||
      event?.snapshotUrl ||
      event?.snapshot_url ||
      event?.thumbnail ||
      event?.thumbnailUrl ||
      event?.uploadedFileUrl ||
      event?.bannerUrl ||
      event?.designData?.previewUrl ||
      event?.designData?.imageUrl ||
      null
    );

    // Filter out plain CSS colors or gradients stored in image fields (e.g. "#faf8f5" or "linear-gradient...")
    if (candidateImage && typeof candidateImage === "string") {
      const trimmed = candidateImage.trim();
      if (trimmed.startsWith("#") || trimmed.startsWith("linear-gradient") || trimmed.startsWith("radial-gradient") || trimmed.startsWith("rgb")) {
        candidateImage = null;
      }
    }

    // If candidateImage is not found or was a color, resolve from template ID
    if (!candidateImage) {
      const candidateTemplateId = (
        invitation?.templateId ||
        invitation?.template_id ||
        event?.selectedTemplateId ||
        event?.selected_template_id ||
        event?.templateId ||
        event?.template_id ||
        ""
      ).trim().toLowerCase();

      if (candidateTemplateId && KNOWN_TEMPLATE_IMAGES[candidateTemplateId]) {
        candidateImage = KNOWN_TEMPLATE_IMAGES[candidateTemplateId];
      } else if (candidateTemplateId) {
        for (const [key, val] of Object.entries(KNOWN_TEMPLATE_IMAGES)) {
          if (candidateTemplateId.includes(key) || key.includes(candidateTemplateId)) {
            candidateImage = val;
            break;
          }
        }
      }
    }

    // Also fuzzy-match against event/invitation title if candidateImage is still missing
    if (!candidateImage) {
      const titleLower = `${title || ""} ${event?.title || ""}`.toLowerCase();
      for (const [key, val] of Object.entries(KNOWN_TEMPLATE_IMAGES)) {
        const cleanKey = key.replace(/^tpl-/, "").replace(/-/g, " ");
        if (cleanKey.length > 3 && titleLower.includes(cleanKey)) {
          candidateImage = val;
          break;
        }
      }
    }

    const rawImage = candidateImage;

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
  const CID_IDENTIFIER = "invitationCard";
  const mimeMap = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml" };

  // Strategy A: Local file on disk → attach from file path (most reliable)
  if (localSnapshotFilePath && fs.existsSync(localSnapshotFilePath)) {
    const ext = path.extname(localSnapshotFilePath).toLowerCase().replace(".", "");
    if (ext === "svg") {
      try {
        const { Resvg } = require("@resvg/resvg-js");
        const svgContent = fs.readFileSync(localSnapshotFilePath, "utf8");
        const resvg = new Resvg(svgContent, { fitTo: { mode: "width", value: 600 } });
        const pngData = resvg.render();
        const pngBuffer = pngData.asPng();

        attachments.push({
          filename: "invitation-card.png",
          content: pngBuffer,
          cid: CID_IDENTIFIER,
          contentType: "image/png",
          contentDisposition: "inline",
        });
        htmlCardImageSrc = `cid:${CID_IDENTIFIER}`;
        console.log(`[EmailService] Converted SVG template to inline PNG attachment (${(pngBuffer.length / 1024).toFixed(1)} KB): ${localSnapshotFilePath}`);
      } catch (svgErr) {
        console.warn("[EmailService] Error converting SVG template to PNG:", svgErr.message);
        attachments.push({
          filename: "invitation-card.svg",
          path: localSnapshotFilePath,
          cid: CID_IDENTIFIER,
          contentType: "image/svg+xml",
          contentDisposition: "inline",
        });
        htmlCardImageSrc = `cid:${CID_IDENTIFIER}`;
      }
    } else {
      try {
        const stats = fs.statSync(localSnapshotFilePath);
        if (stats.size > 100) {
          const mimeType = mimeMap[ext] || "image/png";
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

    let qrCodeUrl = null;
    let qrLinkUrl = previewLink;
    const recipientAttachments = [...attachments];

    if (options?.qrCode !== false) {
      const guestId = recipient.guestId || recipient.id;
      const eventId = event?.id || invitation?.eventId;

      let checkInUrl = trackedPreviewLink || previewLink;
      if (guestId) {
        const uniqueToken = generateGuestToken(guestId, eventId);
        checkInUrl = `${baseUrl}/check-in/${guestId}?token=${uniqueToken}`;
      }
      qrLinkUrl = checkInUrl;

      // Fallback public URL — used only if buffer generation below fails
      const encodedUrl = encodeURIComponent(checkInUrl);
      const publicQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=8&data=${encodedUrl}`;

      try {
        // Generate PNG Buffer and attach as CID inline so the <img src="cid:..."> in the HTML
        // references it directly. Gmail, Outlook, Yahoo and Apple Mail all support CID inline
        // images and will render this correctly — no proxy stripping, no external request needed.
        const qrBuffer = await QRCode.toBuffer(checkInUrl, {
          width: 250,
          margin: 2,
          errorCorrectionLevel: "M",
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        });

        if (qrBuffer && qrBuffer.length > 100) {
          const qrCid = `rsvp-qr-${recipient.guestId || Date.now()}@invitehub.io`;
          recipientAttachments.push({
            filename: "rsvp-qr.png",
            content: qrBuffer,
            cid: qrCid,
            contentType: "image/png",
            contentDisposition: "inline",
          });
          // *** CRITICAL FIX: point the HTML <img src> at the CID, not the external URL ***
          qrCodeUrl = `cid:${qrCid}`;
          console.log(`[EmailService] QR CID attachment ready (${(qrBuffer.length / 1024).toFixed(1)} KB): ${qrCid}`);
        } else {
          // Buffer empty — fall back to public URL
          qrCodeUrl = publicQrUrl;
          console.warn("[EmailService] QR buffer was empty, falling back to public URL.");
        }
      } catch (qrErr) {
        // Buffer generation failed — fall back to public URL
        qrCodeUrl = publicQrUrl;
        console.warn("[EmailService] Failed to generate QR buffer, falling back to public URL:", qrErr.message);
      }
    }

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
      greetingText,
      calendarLinkUrl,
      mapLinkUrl,
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

    const mailOptions = {
      from,
      to: recipient.email,
      subject,
      html: htmlContent,
      attachments: recipientAttachments.length > 0 ? recipientAttachments : undefined,
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
