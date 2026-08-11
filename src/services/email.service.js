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

/**
 * Generate responsive HTML content for digital invitation
 */
const generateInvitationHtml = ({ title, subtitle, mainText, date, time, venue, imageUrl, previewLink, senderName }) => {
  const primaryColor = "#2D1B3D";
  const accentColor = "#C9A84C";
  const bgColor = "#FAF8F5";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || "Event Invitation"}</title>
</head>
<body style="margin:0; padding:0; background-color:${bgColor}; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333333; line-height: 1.6;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: ${bgColor}; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); border: 1px solid #E8C4B8;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: ${primaryColor}; padding: 28px 24px; text-align: center; color: #FAF8F5;">
              <span style="color: ${accentColor}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; display: block; margin-bottom: 6px;">
                You're Cordially Invited
              </span>
              <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #FAF8F5;">
                ${title || "Special Event Invitation"}
              </h1>
            </td>
          </tr>

          ${imageUrl
      ? `
          <!-- Image Section -->
          <tr>
            <td style="padding: 0; text-align: center; background-color: #f4f0ec;">
              <img src="${imageUrl}" alt="Invitation Cover" style="width: 100%; max-height: 280px; object-fit: cover; display: block;" />
            </td>
          </tr>
          `
      : ""
    }

          <!-- Content Body -->
          <tr>
            <td style="padding: 32px 28px;">
              ${subtitle
      ? `<p style="font-size: 18px; font-weight: 600; color: ${primaryColor}; margin-top: 0; margin-bottom: 16px; text-align: center;">${subtitle}</p>`
      : ""
    }

              ${mainText
      ? `<div style="font-size: 15px; color: #4A3E56; margin-bottom: 28px; text-align: center; background-color: #FAF8F5; padding: 20px; border-radius: 12px; border-left: 4px solid ${accentColor};">
                      ${mainText}
                    </div>`
      : ""
    }

              <!-- Event Details Box -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FAF8F5; border-radius: 12px; padding: 20px; margin-bottom: 28px; border: 1px solid #E8C4B8;">
                ${date
      ? `
                <tr>
                  <td width="30" style="vertical-align: top; padding-bottom: 10px;">📅</td>
                  <td style="font-size: 14px; color: ${primaryColor}; font-weight: 600; padding-bottom: 10px;">
                    <strong>Date:</strong> ${date}
                  </td>
                </tr>
                `
      : ""
    }
                ${time
      ? `
                <tr>
                  <td width="30" style="vertical-align: top; padding-bottom: 10px;">⏰</td>
                  <td style="font-size: 14px; color: ${primaryColor}; font-weight: 600; padding-bottom: 10px;">
                    <strong>Time:</strong> ${time}
                  </td>
                </tr>
                `
      : ""
    }
                ${venue
      ? `
                <tr>
                  <td width="30" style="vertical-align: top;">📍</td>
                  <td style="font-size: 14px; color: ${primaryColor}; font-weight: 600;">
                    <strong>Location:</strong> ${venue}
                  </td>
                </tr>
                `
      : ""
    }
              </table>

              <!-- Call to Action Button -->
              ${previewLink
      ? `
              <div style="text-align: center; margin-top: 20px; margin-bottom: 10px;">
                <a href="${previewLink}" target="_blank" style="background-color: ${primaryColor}; color: #FAF8F5; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 10px; display: inline-block; box-shadow: 0 4px 12px rgba(45, 27, 61, 0.2);">
                  View Invitation & RSVP
                </a>
              </div>
              `
      : ""
    }

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #FAF8F5; padding: 20px 24px; text-align: center; border-top: 1px solid #E8C4B8; font-size: 12px; color: #888888;">
              <p style="margin: 0 0 6px 0;">Sent via <strong>InviteHub / Eventizers</strong>${senderName ? ` by ${senderName}` : ""}</p>
              <p style="margin: 0;">If you have any questions, please contact your event host.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};


const sendInvitationEmails = async ({ recipients, invitation, event, senderName, frontendUrl }) => {
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
  const invitationTargetId = invitation?.id || invitation?.eventId || event?.id;
  const previewLink = `${baseUrl}/invitation/${invitationTargetId}`;

  const htmlContent = generateInvitationHtml({
    title,
    subtitle,
    mainText,
    date: eventDate,
    time: eventTime,
    venue: eventVenue,
    imageUrl: invitation?.imageUrl && !invitation.imageUrl.startsWith("data:") ? invitation.imageUrl : "",
    previewLink,
    senderName,
  });

  const subject = `✨ Invitation: ${title}`;
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || `"InviteHub Events" <no-reply@invitehub.com>`;

  // Strict SMTP transport (bypassing Resend API)
  const transporter = await getTransporter();

  const mailOptions = {
    from,
    to: recipients.join(", "),
    subject,
    html: htmlContent,
  };

  const info = await transporter.sendMail(mailOptions);
  let testMessageUrl = null;

  if (nodemailer.getTestMessageUrl && info) {
    testMessageUrl = nodemailer.getTestMessageUrl(info);
    if (testMessageUrl) {
      console.log(`[EmailService] Ethereal Preview URL: ${testMessageUrl}`);
    }
  }

  console.log(`[EmailService] Invitation email successfully dispatched to ${recipients.length} recipients. MessageId: ${info.messageId || info.response}`);

  return {
    success: true,
    recipientCount: recipients.length,
    messageId: info.messageId || info.response,
    previewUrl: testMessageUrl,
  };
};

module.exports = {
  sendInvitationEmails,
  generateInvitationHtml,
};

