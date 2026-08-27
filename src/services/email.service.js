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


const { saveBase64Image } = require("../utils/fileStorage");

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
}) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || "Event Invitation"}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Poppins:wght@500;600;700&display=swap');
    body, table, td, a {
      font-family: 'Inter', 'Poppins', 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
    }
    .cta-button:hover {
      opacity: 0.95;
      box-shadow: 0 6px 20px rgba(0, 198, 255, 0.5) !important;
    }
    @media only screen and (max-width: 620px) {
      .email-container {
        width: 100% !important;
      }
      .content-padding {
        padding: 24px 18px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0072ff; background: linear-gradient(135deg, #0052D4 0%, #4364F7 50%, #6FB1FC 100%); font-family: 'Inter', 'Poppins', 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff; line-height: 1.6;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #0072ff; background: linear-gradient(135deg, #0052D4 0%, #4364F7 50%, #6FB1FC 100%); padding: 36px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table class="email-container" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #1e3c72; background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.18);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #0f2027; background: linear-gradient(180deg, #0f2027 0%, #203a43 50%, #2c5364 100%); padding: 28px 24px 20px 24px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
              <span style="color: #67e8f9; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2.5px; display: block; margin-bottom: 8px;">
                You're Cordially Invited
              </span>
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; line-height: 1.3; letter-spacing: -0.5px;">
                ${title || "Special Event Invitation"}
              </h1>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td class="content-padding" style="padding: 28px 28px 28px 28px;">
              ${subtitle
                ? `<p style="font-size: 18px; font-weight: 600; color: #e0f2fe; margin-top: 0; margin-bottom: 18px; text-align: center; line-height: 1.4;">${subtitle}</p>`
                : ""
              }

              ${mainText
                ? `<div style="font-size: 15px; color: #ffffff; margin-bottom: 26px; text-align: center; background-color: rgba(255, 255, 255, 0.08); padding: 20px; border-radius: 12px; border-left: 4px solid #00c6ff; line-height: 1.6;">
                    ${mainText}
                  </div>`
                : ""
              }

              <!-- Event Details Box -->
              ${(date || time || venue) ? `
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid rgba(255, 255, 255, 0.12);">
                ${date ? `
                <tr>
                  <td width="32" style="vertical-align: top; padding-bottom: 10px; font-size: 16px;">📅</td>
                  <td style="font-size: 14px; color: #e0f2fe; padding-bottom: 10px; vertical-align: middle;">
                    <strong style="color: #67e8f9; font-weight: 600;">Date:</strong> <span style="color: #ffffff; font-weight: 500;">${date}</span>
                  </td>
                </tr>
                ` : ""}
                ${time ? `
                <tr>
                  <td width="32" style="vertical-align: top; padding-bottom: 10px; font-size: 16px;">⏰</td>
                  <td style="font-size: 14px; color: #e0f2fe; padding-bottom: 10px; vertical-align: middle;">
                    <strong style="color: #67e8f9; font-weight: 600;">Time:</strong> <span style="color: #ffffff; font-weight: 500;">${time}</span>
                  </td>
                </tr>
                ` : ""}
                ${venue ? `
                <tr>
                  <td width="32" style="vertical-align: top; font-size: 16px;">📍</td>
                  <td style="font-size: 14px; color: #e0f2fe; vertical-align: middle;">
                    <strong style="color: #67e8f9; font-weight: 600;">Location:</strong> <span style="color: #ffffff; font-weight: 500;">${venue}</span>
                  </td>
                </tr>
                ` : ""}
              </table>
              ` : ""}

              <!-- Invitation Card Snapshot Preview Container (Directly above the RSVP Button) -->
              ${cardImageSrc ? `
              <div style="text-align: center; margin: 24px 0;">
                <!--[if mso]>
                <table align="center" border="0" cellspacing="0" cellpadding="0" width="500">
                <tr>
                <td align="center">
                <![endif]-->
                <img 
                  src="${cardImageSrc}" 
                  alt="${title || "Invitation Card"}" 
                  style="max-width: 100%; width: 500px; height: auto; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: block; margin: 0 auto; border: 0;"
                />
                <!--[if mso]>
                </td>
                </tr>
                </table>
                <![endif]-->
              </div>
              ` : ""}

              <!-- Call to Action Button Container -->
              ${previewLink ? `
              <div style="text-align: center; margin-top: 24px; margin-bottom: 12px;">
                <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto;">
                  <tr>
                    <td align="center" style="border-radius: 10px; background-color: #0072ff; background: linear-gradient(90deg, #00c6ff 0%, #0072ff 100%);">
                      <a class="cta-button" href="${previewLink}" target="_blank" style="background-color: #0072ff; background: linear-gradient(90deg, #00c6ff 0%, #0072ff 100%); color: #ffffff; font-weight: 700; font-size: 15px; border-radius: 10px; padding: 14px 32px; text-decoration: none; display: inline-block; border: none; letter-spacing: 0.3px; box-shadow: 0 4px 15px rgba(0, 198, 255, 0.35);">
                        View Invitation & RSVP
                      </a>
                    </td>
                  </tr>
                </table>
              </div>
              ` : ""}

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: rgba(15, 23, 42, 0.5); padding: 22px 24px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.1); font-size: 12px; color: #bae6fd; line-height: 1.5;">
              <p style="margin: 0 0 6px 0;">Sent via <strong style="color: #ffffff;">InviteHub / Eventizers</strong>${senderName ? ` by <span style="color: #ffffff;">${senderName}</span>` : ""}</p>
              <p style="margin: 0; color: #94a3b8;">If you have any questions, please contact your event host.</p>
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

  const baseUrl = frontendUrl || process.env.FRONTEND_URL || "http://localhost:3000";
  const trackBase = (trackingBaseUrl || process.env.API_BASE_URL || process.env.BACKEND_URL || "http://localhost:5000").replace(/\/+$/, "");
  const invitationTargetId = invitation?.id || invitation?.eventId || event?.id;
  const previewLink = `${baseUrl}/invitation/${invitationTargetId}`;

  // Resolve clean card snapshot image URL
  let resolvedCardImageSrc = null;

  // 1. If an explicit snapshot URL was provided
  const directSnapshotUrl = snapshotUrl || cardSnapshotUrl;
  if (directSnapshotUrl) {
    resolvedCardImageSrc = resolvePublicImageUrl(directSnapshotUrl, trackBase);
  }

  // 2. If Base64 string provided, convert it to a file and obtain clean HTTPS URL
  if (!resolvedCardImageSrc && cardImageBase64 && typeof cardImageBase64 === "string") {
    try {
      const savedRes = await saveBase64Image(cardImageBase64, null, "invitation_snapshot");
      if (savedRes && savedRes.url) {
        resolvedCardImageSrc = savedRes.url;
      }
    } catch (err) {
      console.warn("[EmailService] Failed to save cardImageBase64 snapshot:", err.message);
    }
  }

  // 3. Fallback to event coverImage or invitation imageUrl if not already resolved
  if (!resolvedCardImageSrc) {
    const rawImage = event?.snapshotUrl || event?.coverImage || invitation?.imageUrl;
    if (rawImage) {
      if (rawImage.startsWith("data:")) {
        try {
          const savedRes = await saveBase64Image(rawImage, null, "event_cover");
          if (savedRes && savedRes.url) {
            resolvedCardImageSrc = savedRes.url;
          }
        } catch (e) {}
      } else {
        resolvedCardImageSrc = resolvePublicImageUrl(rawImage, trackBase);
      }
    }
  }

  const subject = `✨ Invitation: ${title}`;
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || `"InviteHub Events" <no-reply@invitehub.com>`;

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
      cardImageSrc: resolvedCardImageSrc,
      previewLink: trackedPreviewLink,
      senderName,
      trackingPixelUrl,
    });

    const mailOptions = {
      from,
      to: recipient.email,
      subject,
      html: htmlContent,
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

  console.log(`[EmailService] Dispatched ${sentCount} personalized invitation email(s) with tracking pixels and card snapshot. Last MessageId: ${lastMessageId}`);

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
};

