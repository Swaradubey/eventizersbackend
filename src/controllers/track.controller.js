const db = require("../config/db");

/**
 * Track invitation email open via 1x1 transparent GIF pixel
 * GET /api/track/open
 */
const trackEmailOpen = async (req, res) => {
  const { guestId, eventId } = req.query;

  if (guestId) {
    try {
      await db.query(
        `UPDATE guests 
         SET 
           is_opened = true,
           opened_at = COALESCE(opened_at, CURRENT_TIMESTAMP),
           open_count = COALESCE(open_count, 0) + 1,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [guestId]
      );
      console.log(`[TrackOpen] Successfully recorded email open for guest ${guestId}`);
    } catch (error) {
      console.error("[TrackOpen] Error updating open tracking status:", error.message || error);
    }
  }

  // 1x1 transparent GIF buffer
  const transparentPixelBuffer = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
  );

  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Content-Length", transparentPixelBuffer.length);
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  return res.status(200).send(transparentPixelBuffer);
};

/**
 * Track invitation link click and redirect to target URL
 * GET /api/track/click
 */
const trackEmailClick = async (req, res) => {
  const { guestId, eventId, target } = req.query;

  if (guestId) {
    try {
      await db.query(
        `UPDATE guests 
         SET 
           is_clicked = true,
           is_opened = true,
           clicked_at = COALESCE(clicked_at, CURRENT_TIMESTAMP),
           opened_at = COALESCE(opened_at, CURRENT_TIMESTAMP),
           open_count = CASE WHEN open_count IS NULL OR open_count = 0 THEN 1 ELSE open_count END,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [guestId]
      );
      console.log(`[TrackClick] Successfully recorded link click for guest ${guestId}`);
    } catch (error) {
      console.error("[TrackClick] Error updating click tracking status:", error.message || error);
    }
  }

  const frontendUrl = (process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  let redirectUrl = frontendUrl;

  if (target) {
    try {
      redirectUrl = decodeURIComponent(target);
    } catch (e) {
      redirectUrl = target;
    }
  } else if (eventId) {
    redirectUrl = `${frontendUrl}/invitation/${eventId}`;
  }

  return res.redirect(302, redirectUrl);
};

module.exports = {
  trackEmailOpen,
  trackEmailClick,
};
