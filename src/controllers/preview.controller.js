const fs = require("fs");
const path = require("path");
const axios = require("axios");
const nodemailer = require("nodemailer");
const eventService = require("../services/event.service");
const { findLocalFilePath } = require("../utils/fileStorage");

// =============================================================================
// POST /api/events/:id/send-preview-email
//
// Dedicated Node/Express endpoint for the Review-stage "Email me a preview"
// action. Renders an Evite-styled preview email and embeds the rendered canvas
// card as an INLINE CID attachment (cid:event-card-preview). This endpoint only
// ever mails the signed-in host — no guest is invited from here.
// =============================================================================

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CARD_CID = "event-card-preview";
const MAX_SNAPSHOT_BYTES = 5 * 1024 * 1024;

const ACCENT = "#3e5622";
const INK = "#18181b";

const escapeHtml = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** `data:image/png;base64,…` (or bare base64) → nodemailer attachment. */
function snapshotToAttachment(snapshot) {
  if (!snapshot || typeof snapshot !== "string") return null;

  const dataUrlMatch = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/.exec(
    snapshot.trim()
  );

  let contentType = "image/png";
  let base64 = "";

  if (dataUrlMatch) {
    const subtype = dataUrlMatch[1].toLowerCase();
    contentType = `image/${subtype === "jpg" ? "jpeg" : subtype}`;
    base64 = dataUrlMatch[2];
  } else if (/^[A-Za-z0-9+/=\s]{512,}$/.test(snapshot.trim())) {
    base64 = snapshot.trim();
  } else {
    return null;
  }

  try {
    const buffer = Buffer.from(base64.replace(/\s+/g, ""), "base64");
    if (!buffer.length || buffer.length > MAX_SNAPSHOT_BYTES) return null;
    const ext = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];
    return {
      filename: `invitation-preview-card.${ext}`,
      content: buffer,
      contentType,
    };
  } catch {
    return null;
  }
}

/** Resolves a hosted / local / data-URL card image into an attachment. */
async function urlToAttachment(source) {
  if (!source || typeof source !== "string") return null;
  const trimmed = source.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("data:")) return snapshotToAttachment(trimmed);

  try {
    const localPath = findLocalFilePath(trimmed);
    if (localPath && fs.existsSync(localPath)) {
      const buffer = await fs.promises.readFile(localPath);
      if (!buffer.length || buffer.length > MAX_SNAPSHOT_BYTES) return null;
      const ext = path.extname(localPath).slice(1).toLowerCase() || "png";
      const contentType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
      return { filename: `invitation-preview-card.${ext}`, content: buffer, contentType };
    }
  } catch {
    // fall through to the remote fetch below
  }

  if (!/^https?:\/\//i.test(trimmed)) return null;

  try {
    const response = await axios.get(trimmed, {
      responseType: "arraybuffer",
      timeout: 12_000,
      maxContentLength: MAX_SNAPSHOT_BYTES,
      validateStatus: (status) => status < 400,
    });
    const buffer = Buffer.from(response.data);
    if (!buffer.length) return null;
    const contentType = String(response.headers["content-type"] || "image/png").split(";")[0];
    const ext = contentType.includes("jpeg") ? "jpg" : contentType.includes("webp") ? "webp" : "png";
    return { filename: `invitation-preview-card.${ext}`, content: buffer, contentType };
  } catch (error) {
    console.warn("[PreviewEmail] Could not download card image:", error.message);
    return null;
  }
}

function formatDateLabel(date, time) {
  if (!date) return "";
  const parsed = new Date(time ? `${date}T${time}` : `${date}T00:00`);
  if (isNaN(parsed.getTime())) return String(date);
  const label = parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  if (!time) return label;
  return `${label} · ${parsed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function buildTransport() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === "true"
    : port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (user && pass) {
    return {
      name: "smtp",
      transport: nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      }),
    };
  }

  if (process.env.NODE_ENV !== "production") {
    return {
      name: "json",
      transport: nodemailer.createTransport({ jsonTransport: true }),
    };
  }

  throw new Error(
    "Missing email credentials. Configure SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS."
  );
}

function buildPreviewHtml({ to, title, subtitle, hostName, when, venue, address, hostNote, accent, rsvpUrl, hasCard }) {
  const safeTitle = escapeHtml(title || "You're Invited");
  const safeSubtitle = escapeHtml(subtitle || "");
  const safeHost = escapeHtml(hostName || "");
  const safeWhen = escapeHtml(when || "");
  const safeVenue = escapeHtml(venue || "");
  const safeAddress = escapeHtml(address || "");
  const safeNote = escapeHtml(hostNote || "");
  const safeTo = escapeHtml(to);
  const safeAccent = escapeHtml(accent || ACCENT);
  const safeRsvp = escapeHtml(rsvpUrl || "#");

  const detailRow = (label, value) =>
    value
      ? `<tr>
          <td style="padding:0 0 10px 0;width:88px;font:700 10px/1.4 Arial,Helvetica,sans-serif;letter-spacing:1.6px;text-transform:uppercase;color:#8b8b93;">${label}</td>
          <td style="padding:0 0 10px 0;font:600 15px/1.5 Arial,Helvetica,sans-serif;color:${INK};">${value}</td>
        </tr>`
      : "";

  const details = [detailRow("When", safeWhen), detailRow("Where", safeVenue), detailRow("Address", safeAddress)]
    .filter(Boolean)
    .join("");

  const cardMarkup = hasCard
    ? `<img src="cid:${CARD_CID}" alt="${safeTitle} invitation card" width="520" style="display:block;width:100%;max-width:520px;height:auto;border:0;border-radius:16px;box-shadow:0 18px 40px rgba(24,24,27,0.18);margin:0 auto;" />`
    : `<div style="max-width:520px;margin:0 auto;border-radius:16px;overflow:hidden;background:linear-gradient(135deg, ${safeAccent}, #7a9e5a);padding:56px 24px;text-align:center;color:#fff;font:700 30px/1.25 Georgia,serif;">${safeTitle}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Preview: ${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f1;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${safeAccent};">
    <tr>
      <td align="center" style="padding:12px 16px;font:700 12px/1.5 Arial,Helvetica,sans-serif;color:#ffffff;">
        &#11088; Preview Mode: this is how your guests will receive your invitation &mdash; sent to ${safeTo}
      </td>
    </tr>
  </table>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f1;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 16px 44px rgba(24,24,27,0.12);">
          <tr>
            <td style="padding:26px 28px 6px 28px;text-align:center;">
              <span style="display:inline-block;font:700 10px/1 Arial,Helvetica,sans-serif;letter-spacing:3px;text-transform:uppercase;color:${safeAccent};background:${safeAccent}14;border:1px solid ${safeAccent}33;border-radius:999px;padding:8px 16px;">
                InviteHub Preview
              </span>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 28px 8px 28px;text-align:center;">
              <h1 style="margin:0;font:700 32px/1.2 Georgia,'Times New Roman',serif;color:${INK};">${safeTitle}</h1>
              ${safeSubtitle ? `<p style="margin:10px 0 0 0;font:600 13px/1.5 Arial,Helvetica,sans-serif;letter-spacing:1.4px;text-transform:uppercase;color:${safeAccent};">${safeSubtitle}</p>` : ""}
              ${safeHost ? `<p style="margin:8px 0 0 0;font:400 14px/1.5 Arial,Helvetica,sans-serif;color:#6b6b73;">Hosted by ${safeHost}</p>` : ""}
            </td>
          </tr>

          <tr>
            <td style="padding:20px 28px 8px 28px;">${cardMarkup}</td>
          </tr>

          ${
            details
              ? `<tr>
                  <td style="padding:22px 32px 4px 32px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${details}</table>
                  </td>
                </tr>`
              : ""
          }

          ${
            safeNote
              ? `<tr>
                  <td style="padding:6px 32px 4px 32px;">
                    <p style="margin:0;font:italic 400 14px/1.6 Georgia,serif;color:#71717a;">&ldquo;${safeNote}&rdquo;</p>
                  </td>
                </tr>`
              : ""
          }

          <tr>
            <td align="center" style="padding:18px 28px 34px 28px;">
              <p style="margin:0 0 14px 0;font:700 13px/1.5 Arial,Helvetica,sans-serif;color:#52525b;">Will you be attending?</p>
              <a href="${safeRsvp}" target="_blank"
                style="display:inline-block;background-color:${safeAccent};color:#ffffff;text-decoration:none;font:700 15px/1 Arial,Helvetica,sans-serif;letter-spacing:0.4px;padding:17px 40px;border-radius:9999px;box-shadow:0 10px 24px ${safeAccent}40;">
                RSVP Now
              </a>
              <p style="margin:16px 0 0 0;font:400 11px/1.6 Arial,Helvetica,sans-serif;color:#9a9aa2;">
                This is a preview &mdash; no guest has received an invitation.
              </p>
            </td>
          </tr>
        </table>

        <p style="margin:18px 0 0 0;font:400 11px/1.6 Arial,Helvetica,sans-serif;color:#9a9aa2;">
          Powered by InviteHub &bull; Built with AI Canvas Engine
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const sendPreviewEmailHandler = async (req, res) => {
  try {
    const eventId = req.params.id;
    const userId = req.user && req.user.id;

    if (!eventId) {
      return res.status(400).json({ success: false, error: "Missing event id." });
    }

    const body = req.body || {};
    const recipientEmail = String(
      body.recipientEmail || body.toEmail || body.email || ""
    )
      .trim()
      .toLowerCase();

    if (!EMAIL_RE.test(recipientEmail)) {
      return res.status(400).json({ success: false, error: "Enter a valid email address." });
    }

    // ── Ownership check (also supplies canonical event + invitation details) ──
    let event = null;
    try {
      event = await eventService.findEventByIdAndUserId(eventId, userId);
    } catch (error) {
      console.error("[PreviewEmail] Event lookup failed:", error.message);
    }
    if (!event) {
      return res
        .status(404)
        .json({ success: false, error: "Event not found or unauthorized access." });
    }

    const invitationId =
      String(body.invitationId || event.invitationId || eventId).trim() || eventId;

    const title =
      String(body.eventTitle || event.invitationEventTitle || event.title || "You're Invited").trim() ||
      "You're Invited";
    const subtitle = String(body.eventSubtitle || event.invitationSubtitle || "").trim();
    const hostName = String(body.hostName || event.hostName || "").trim();

    const whenLabel = String(body.eventDate || "").trim() || formatDateLabel(event.eventDate, event.eventTime);
    const venue = String(body.eventLocation || event.invitationEventVenue || event.venue || "").trim();
    const address = String(
      body.eventAddress ||
        [event.address, event.city, event.state, event.country].filter(Boolean).join(", ")
    ).trim();
    const hostNote = String(body.hostNote || event.description || "").trim();

    // ── Rendered canvas card → inline CID attachment ────────────────────────
    let attachment =
      snapshotToAttachment(body.cardSnapshot || body.cardSnapshotBase64) ||
      (await urlToAttachment(body.cardImageUrl || null)) ||
      (await urlToAttachment(
        event.invitationImageUrl || event.previewUrl || event.coverImage || null
      ));

    const appBase = (
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      process.env.FRONTEND_URL ||
      "http://localhost:3000"
    ).replace(/\/+$/, "");
    const rsvpUrl = body.rsvpUrl
      ? String(body.rsvpUrl)
      : `${appBase}/invitation/${encodeURIComponent(invitationId)}?mode=guest`;

    const html = buildPreviewHtml({
      to: recipientEmail,
      title,
      subtitle,
      hostName,
      when: whenLabel,
      venue,
      address,
      hostNote,
      accent: event.invitationAccentColor || ACCENT,
      rsvpUrl,
      hasCard: Boolean(attachment),
    });

    const { transport, name } = buildTransport();

    const from =
      process.env.EMAIL_FROM ||
      (process.env.SMTP_USER
        ? `InviteHub <${process.env.SMTP_USER}>`
        : "InviteHub <no-reply@invitehub.app>");

    const info = await transport.sendMail({
      from,
      to: recipientEmail,
      subject: `Preview: You're invited to ${title}`,
      html,
      text: `Preview only — your guests have not been invited yet.\n\n${title}\n${whenLabel}\n${venue}\n\nRSVP: ${rsvpUrl}`,
      attachments: attachment
        ? [
            {
              filename: attachment.filename,
              content: attachment.content,
              cid: CARD_CID,
              contentType: attachment.contentType,
            },
          ]
        : [],
    });

    console.log(
      `[PreviewEmail] Sent preview to ${recipientEmail} (transport: ${name}, card: ${attachment ? `${Math.round(attachment.content.length / 1024)} KB` : "none"})`
    );

    return res.status(200).json({
      success: true,
      recipientEmail,
      recipientCount: 1,
      messageId: info && info.messageId ? info.messageId : null,
      transport: name,
      hasCardSnapshot: Boolean(attachment),
      previewUrl: nodemailer.getTestMessageUrl(info) || null,
      message: `Preview email sent to ${recipientEmail}`,
    });
  } catch (error) {
    console.error("[PreviewEmail] Error:", error && error.message, error && error.stack);
    return res.status(500).json({
      success: false,
      error:
        "Failed to send preview email. Check the SMTP configuration (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) and try again.",
    });
  }
};

module.exports = {
  sendPreviewEmailHandler,
  buildPreviewHtml,
  snapshotToAttachment,
  buildTransport,
};
