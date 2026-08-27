const nodemailer = require("nodemailer");

const getTransporter = async () => {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
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
  // Use custom EMAIL_FROM / SMTP_FROM if defined, else fallback to Resend default onboarding sender
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


const path = require("path");
const fs = require("fs");
const { saveBase64Image, UPLOADS_DIR } = require("../utils/fileStorage");

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
 * Safely parse and process a cover image or snapshot URL
 * @param {string} coverImage - The cover image string from event or invitation
 * @param {string} baseUrl - Backend or app base URL
 * @returns {string|null}
 */
const resolvePublicImageUrl = (coverImage, baseUrl = "http://localhost:5000") => {
  if (!coverImage || typeof coverImage !== "string") {
    return null;
  }

  const trimmed = coverImage.trim();
  if (!trimmed) return null;

  // 1. Full HTTPS/HTTP URL
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // 2. Relative uploads or assets path
  if (trimmed.startsWith("/")) {
    const cleanBase = baseUrl.replace(/\/+$/, "");
    return `${cleanBase}${trimmed}`;
  }

  if (trimmed.startsWith("uploads/") || trimmed.startsWith("assets/")) {
    const cleanBase = baseUrl.replace(/\/+$/, "");
    return `${cleanBase}/${trimmed}`;
  }

  return null;
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
  const safeTitle = title || "Special Event Invitation";

  // Font family resolution for email clients
  let fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  if (fontFamily === "Playfair Display" || fontFamily?.includes("Playfair") || fontFamily?.includes("serif")) {
    fontStack = "'Playfair Display', Georgia, Cambria, 'Times New Roman', serif";
  } else if (fontFamily === "Inter" || fontFamily === "Poppins" || fontFamily === "sans-serif") {
    fontStack = "'Inter', 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  }

  return `
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${safeTitle}</title>
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
      .hero-image-padding {
        padding: 12px 12px 16px 12px !important;
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
        <table class="email-container" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: ${containerBg}; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08); border: 1px solid ${metaBoxBorder};">
          
          <!-- Top Badge & Host Header -->
          <tr>
            <td style="padding: 24px 24px 12px 24px; text-align: center;">
              <span style="display: inline-block; background-color: ${accent}15; color: ${accent}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; padding: 6px 16px; border-radius: 30px; border: 1px solid ${accent}30;">
                You're Cordially Invited
              </span>
              ${senderName ? `
              <p style="margin: 8px 0 0 0; font-size: 13px; color: ${secondaryText}; font-weight: 500;">
                From <strong style="color: ${primaryText};">${senderName}</strong>
              </p>
              ` : ""}
            </td>
          </tr>

          ${cardImageSrc ? `
          <!-- ─── 1. HERO VISUAL CARD SNAPSHOT (TOP / CENTER) ─── -->
          <tr>
            <td class="hero-image-padding" align="center" style="padding: 12px 20px 20px 20px;">
              <!--[if mso]>
              <table align="center" border="0" cellspacing="0" cellpadding="0" width="520">
              <tr>
              <td align="center">
              <![endif]-->
              <a href="${previewLink || "#"}" target="_blank" style="display: block; text-decoration: none;">
                <img 
                  src="${cardImageSrc}" 
                  alt="${safeTitle}" 
                  width="520" 
                  style="max-width: 100%; width: 100%; height: auto; border-radius: 12px; display: block; margin: 0 auto; border: 0; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);" 
                />
              </a>
              <!--[if mso]>
              </td>
              </tr>
              </table>
              <![endif]-->
            </td>
          </tr>
          ` : `
          <!-- ─── FALLBACK THEMED CARD CONTAINER (WHEN NO SNAPSHOT) ─── -->
          <tr>
            <td style="padding: 12px 24px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${backgroundColor}; border-radius: 12px; padding: 28px 20px; text-align: ${textAlignment}; border: 1px solid ${metaBoxBorder};">
                <tr>
                  <td align="${textAlignment}">
                    <h1 class="mobile-title" style="margin: 0 0 10px 0; font-size: ${Math.min(36, titleSize || 28)}px; font-weight: ${fontWeight || "700"}; font-family: ${fontStack}; color: ${textColor}; line-height: 1.25;">
                      ${safeTitle}
                    </h1>
                    ${subtitle ? `
                    <p style="margin: 0 0 14px 0; font-size: 16px; font-weight: 500; color: ${textColor}; opacity: 0.85;">
                      ${subtitle}
                    </p>
                    ` : ""}
                    ${mainText ? `
                    <p style="margin: 0 0 16px 0; font-size: 14px; color: ${textColor}; opacity: 0.75; line-height: 1.6;">
                      ${mainText}
                    </p>
                    ` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `}

          <!-- ─── 2. CALL TO ACTION BUTTON (DIRECTLY BELOW SNAPSHOT) ─── -->
          ${previewLink ? `
          <tr>
            <td align="center" style="padding: 12px 24px 24px 24px;">
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
                    <a class="cta-button" href="${previewLink}" target="_blank" style="background-color: ${btnColor}; color: #ffffff; font-weight: 700; font-size: 15px; border-radius: ${btnRadius}px; padding: 15px 38px; text-decoration: none; display: inline-block; border: none; letter-spacing: 0.3px; box-shadow: 0 4px 16px ${btnColor}40; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
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
            <td style="padding: 0 24px 24px 24px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${metaBoxBg}; border-radius: 12px; padding: 18px 20px; border: 1px solid ${metaBoxBorder};">
                ${date ? `
                <tr>
                  <td width="28" style="vertical-align: middle; padding: 6px 0; font-size: 16px;">📅</td>
                  <td style="font-size: 14px; color: ${primaryText}; padding: 6px 0; vertical-align: middle;">
                    <strong style="color: ${accent}; font-weight: 600;">Date:</strong> <span style="font-weight: 500;">${date}</span>
                  </td>
                </tr>
                ` : ""}
                ${time ? `
                <tr>
                  <td width="28" style="vertical-align: middle; padding: 6px 0; font-size: 16px;">⏰</td>
                  <td style="font-size: 14px; color: ${primaryText}; padding: 6px 0; vertical-align: middle;">
                    <strong style="color: ${accent}; font-weight: 600;">Time:</strong> <span style="font-weight: 500;">${time}</span>
                  </td>
                </tr>
                ` : ""}
                ${venue ? `
                <tr>
                  <td width="28" style="vertical-align: middle; padding: 6px 0; font-size: 16px;">📍</td>
                  <td style="font-size: 14px; color: ${primaryText}; padding: 6px 0; vertical-align: middle;">
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
  ${trackingPixelUrl ? `
  <!-- Invisible 1x1 Open Rate Tracking Pixel -->
  <img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none !important; width:1px !important; height:1px !important; max-height:0px !important; max-width:0px !important; opacity:0 !important; overflow:hidden !important; mso-hide:all !important;" />
  ` : ""}
</body>
</html>
  `;
};

const sendInvitationEmails = async ({
  recipients,
  invitation,
  event,
  senderName,
  frontendUrl,
  snapshotUrl,
  cardSnapshotUrl,
  cardImageBase64,
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

  // Resolve card snapshot image & attachments
  let resolvedCardImageSrc = null;
  let localSnapshotFilePath = null;

  // 1. Direct snapshot URL provided
  const directSnapshotUrl = snapshotUrl || cardSnapshotUrl;
  if (directSnapshotUrl) {
    resolvedCardImageSrc = resolvePublicImageUrl(directSnapshotUrl, trackBase);
    const filename = path.basename(directSnapshotUrl);
    const candidatePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(candidatePath)) {
      localSnapshotFilePath = candidatePath;
    }
  }

  // 2. Base64 string provided: save as file to get local path and public URL
  if (!resolvedCardImageSrc && cardImageBase64 && typeof cardImageBase64 === "string") {
    try {
      const savedRes = await saveBase64Image(cardImageBase64, null, "invitation_snapshot");
      if (savedRes && savedRes.url) {
        resolvedCardImageSrc = savedRes.url;
        const candidatePath = path.join(UPLOADS_DIR, savedRes.filename);
        if (fs.existsSync(candidatePath)) {
          localSnapshotFilePath = candidatePath;
        }
      }
    } catch (err) {
      console.warn("[EmailService] Failed to save cardImageBase64 snapshot:", err.message);
    }
  }

  // 3. Fallback to event/invitation image if not already resolved
  if (!resolvedCardImageSrc) {
    const rawImage = event?.snapshotUrl || event?.coverImage || invitation?.imageUrl;
    if (rawImage) {
      if (rawImage.startsWith("data:")) {
        try {
          const savedRes = await saveBase64Image(rawImage, null, "event_cover");
          if (savedRes && savedRes.url) {
            resolvedCardImageSrc = savedRes.url;
            const candidatePath = path.join(UPLOADS_DIR, savedRes.filename);
            if (fs.existsSync(candidatePath)) {
              localSnapshotFilePath = candidatePath;
            }
          }
        } catch (e) {}
      } else {
        resolvedCardImageSrc = resolvePublicImageUrl(rawImage, trackBase);
        const filename = path.basename(rawImage);
        const candidatePath = path.join(UPLOADS_DIR, filename);
        if (fs.existsSync(candidatePath)) {
          localSnapshotFilePath = candidatePath;
        }
      }
    }
  }

  const subject = `✨ Invitation: ${title}`;
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || `"InviteHub Events" <no-reply@invitehub.com>`;

  // Configure Nodemailer inline CID attachment for instant rendering across all clients
  const attachments = [];
  let htmlCardImageSrc = resolvedCardImageSrc;

  if (localSnapshotFilePath && fs.existsSync(localSnapshotFilePath)) {
    attachments.push({
      filename: "invitation-card.png",
      path: localSnapshotFilePath,
      cid: "invitation-card-preview",
    });
    // Use CID so email clients (Gmail, Outlook, Apple Mail) render the exact image immediately
    htmlCardImageSrc = "cid:invitation-card-preview";
  } else if (resolvedCardImageSrc && /^https?:\/\//i.test(resolvedCardImageSrc)) {
    // If it's a public HTTPS URL (e.g. S3, Cloudinary, or public server), use it directly
    htmlCardImageSrc = resolvedCardImageSrc;
  }

  // Strict SMTP transport
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

  console.log(`[EmailService] Dispatched ${sentCount} personalized invitation email(s) with exact card design snapshot and tracking. Last MessageId: ${lastMessageId}`);

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
  isDarkColor,
};

