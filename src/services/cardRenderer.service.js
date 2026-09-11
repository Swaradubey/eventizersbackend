const path = require("path");
const fs = require("fs");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

// Base directories for template assets
const TEMPLATES_DIRS = [
  path.resolve(__dirname, "../../../public/assets/templates"),
  path.resolve(__dirname, "../../public/assets/templates"),
  path.resolve(__dirname, "../../uploads"),
  path.resolve(__dirname, "../../../public/images"),
  path.resolve(__dirname, "../../public/images"),
];

// Fallback artwork map for categories and template IDs
const CATEGORY_ARTWORK_MAP = {
  birthday: "cake-and-confetti-bg.svg",
  wedding: "floral-wreath-sophia-bg.svg",
  "bridal shower": "floral-wreath-sophia-bg.svg",
  "baby shower": "pastel-garden-brunch-bg.svg",
  dinner: "pastel-garden-brunch-bg.svg",
  "private dinner": "camellia-fields-bg.svg",
  corporate: "electric-outline-bg.svg",
  networking: "electric-outline-bg.svg",
  gala: "floral-wreath-sophia-bg.svg",
  fundraiser: "floral-wreath-sophia-bg.svg",
  graduation: "floral-wreath-sophia-bg.svg",
  anniversary: "floral-wreath-sophia-bg.svg",
};

/**
 * Resolve local or remote image path for template artwork
 */
const resolveAssetPath = (assetUrl) => {
  if (!assetUrl || typeof assetUrl !== "string") return null;
  const clean = assetUrl.trim();

  // If full HTTPS/HTTP URL
  if (/^https?:\/\//i.test(clean)) {
    return clean;
  }

  // Extract base filename without leading slashes or directories
  const filename = path.basename(clean);

  // Check in known template directories
  for (const dir of TEMPLATES_DIRS) {
    const candidatePath = path.join(dir, filename);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
    const directRelPath = path.resolve(__dirname, "../../", clean.replace(/^\/+/, ""));
    if (fs.existsSync(directRelPath)) {
      return directRelPath;
    }
    const publicRelPath = path.resolve(__dirname, "../../../public", clean.replace(/^\/+/, "").replace(/^assets\/templates\//, "assets/templates/"));
    if (fs.existsSync(publicRelPath)) {
      return publicRelPath;
    }
  }

  return null;
};

/**
 * Helper to wrap text into lines fitting within maxWidth
 */
function wrapText(ctx, text, maxWidth) {
  if (!text) return [];
  const rawParagraphs = String(text).split("\n");
  const lines = [];

  for (const paragraph of rawParagraphs) {
    const words = paragraph.split(" ");
    let currentLine = words[0] || "";

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + " " + word).width;
      if (width < maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

/**
 * Draw a rounded rectangle path on canvas
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draw an ornamental divider line with a centered rotated diamond
 */
function drawOrnamentalDivider(ctx, centerX, y, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1;

  // Left and right line wings
  ctx.beginPath();
  ctx.moveTo(centerX - 70, y);
  ctx.lineTo(centerX - 15, y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(centerX + 15, y);
  ctx.lineTo(centerX + 70, y);
  ctx.stroke();

  // Center diamond
  ctx.translate(centerX, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-4.5, -4.5, 9, 9);
  ctx.restore();
}

/**
 * Render invitation card directly on the backend as a single merged PNG image buffer.
 *
 * @param {Object} params
 * @param {Object} params.invitation - Invitation record / design tokens
 * @param {Object} params.event - Event record details
 * @param {Object} [params.templateConfig] - Optional template schema / config
 * @param {Object} [params.options] - Custom rendering options
 * @returns {Promise<Buffer>} High-resolution PNG Buffer
 */
async function renderInvitationCardPng({ invitation = {}, event = {}, templateConfig = null, options = {} }) {
  // Canvas configuration - High Resolution 5:7 ratio (800 x 1120)
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 1120;
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext("2d");

  // Extract core design parameters
  const title = (
    invitation.eventTitle ||
    invitation.title ||
    event.title ||
    "Special Celebration"
  ).trim();

  const subtitle = (invitation.subtitle || "").trim();
  const hostName = (event.hostName || event.host_name || invitation.hostName || "").trim();

  // Format date and time
  let eventDate = "";
  if (invitation.eventDate || event.eventDate) {
    const rawDate = invitation.eventDate || event.eventDate;
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      eventDate = d.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } else {
      eventDate = String(rawDate);
    }
  }

  let eventTime = "";
  if (invitation.eventTime || event.eventTime) {
    const rawTime = invitation.eventTime || event.eventTime;
    if (rawTime instanceof Date) {
      eventTime = rawTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    } else {
      eventTime = String(rawTime);
    }
  }

  const venue = (invitation.eventVenue || event.venue || "").trim();
  const address = (event.address || "").trim();

  // Color tokens
  const accentColor = invitation.accentColor || templateConfig?.accentColor || "#C49B45";
  const textColor = invitation.textColor || templateConfig?.textColor || "#1E293B";
  const secondaryColor = "#64748B";
  const cardBgColor = invitation.backgroundColor || templateConfig?.card?.backgroundColor || "#FAF9F6";
  const envelopeOuterColor = templateConfig?.envelope?.outerColor || (invitation.accentColor ? `${invitation.accentColor}dd` : "#1E293B");

  // ─── 1. BACKDROP LAYER ───
  const backdropGrad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  backdropGrad.addColorStop(0, "#F3F0EA");
  backdropGrad.addColorStop(0.5, "#EAE5DC");
  backdropGrad.addColorStop(1, "#DFD8CC");
  ctx.fillStyle = backdropGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Subtle vignette / grain effect
  ctx.fillStyle = "rgba(0, 0, 0, 0.02)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // ─── 2. ENVELOPE LAYER (Behind Card, angled 10deg) ───
  ctx.save();
  ctx.translate(CANVAS_WIDTH * 0.58, CANVAS_HEIGHT * 0.46);
  ctx.rotate((10 * Math.PI) / 180);

  const envWidth = 660;
  const envHeight = 880;
  const envX = -envWidth / 2;
  const envY = -envHeight / 2;

  // Envelope soft shadow
  ctx.shadowColor = "rgba(0, 0, 0, 0.14)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetX = 8;
  ctx.shadowOffsetY = 16;

  // Envelope outer body
  ctx.fillStyle = envelopeOuterColor;
  drawRoundedRect(ctx, envX, envY, envWidth, envHeight, 14);
  ctx.fill();

  // Reset shadow for inner elements
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Envelope liner flap (gold foil shimmer gradient)
  const linerGrad = ctx.createLinearGradient(envX, envY, envX + envWidth, envY + envHeight * 0.55);
  linerGrad.addColorStop(0, "#FDF2B8");
  linerGrad.addColorStop(0.3, "#D4AF37");
  linerGrad.addColorStop(0.6, "#AA771C");
  linerGrad.addColorStop(0.85, "#F3E5AB");
  linerGrad.addColorStop(1, "#8B5E14");

  ctx.save();
  ctx.beginPath();
  drawRoundedRect(ctx, envX + 16, envY + 16, envWidth - 32, envHeight * 0.5, 10);
  ctx.clip();
  ctx.fillStyle = linerGrad;
  ctx.fillRect(envX + 16, envY + 16, envWidth - 32, envHeight * 0.5);

  // Subtle geometric diamond foil pattern on liner
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 1.5;
  for (let px = envX + 16; px < envX + envWidth; px += 42) {
    ctx.beginPath();
    ctx.moveTo(px, envY + 16);
    ctx.lineTo(px + 42, envY + envHeight * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px + 42, envY + 16);
    ctx.lineTo(px, envY + envHeight * 0.5);
    ctx.stroke();
  }
  ctx.restore();

  ctx.restore();

  // ─── 3. CARD SURFACE LAYER (Centered, crisp drop shadow) ───
  const cardWidth = 620;
  const cardHeight = 940;
  const cardX = (CANVAS_WIDTH - cardWidth) / 2;
  const cardY = (CANVAS_HEIGHT - cardHeight) / 2;
  const cardRadius = 14;

  ctx.save();
  // Realistic paper drop shadow
  ctx.shadowColor = "rgba(0, 0, 0, 0.18)";
  ctx.shadowBlur = 32;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 14;

  // Card surface base
  ctx.fillStyle = cardBgColor;
  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, cardRadius);
  ctx.fill();
  ctx.restore();

  // Card outer hairline gold border
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, cardRadius);
  ctx.stroke();

  // Card inner ornamental double-line
  ctx.strokeStyle = `${accentColor}55`;
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, cardX + 12, cardY + 12, cardWidth - 24, cardHeight - 24, cardRadius - 4);
  ctx.stroke();

  // ─── 4. TEMPLATE ARTWORK / FLORAL FRAME LAYER ───
  let artworkPath = null;
  const candidateArtworks = [
    templateConfig?.card?.decorativeBorderSvgUrl,
    templateConfig?.card?.artworkUrl,
    templateConfig?.imageUrl,
    invitation.imageUrl,
    invitation.coverImage,
    typeof invitation.cardBg?.value === "string" ? invitation.cardBg.value : null,
    typeof invitation.background?.value === "string" ? invitation.background.value : null,
    event.coverImage,
    event.imageUrl,
    event.selectedTemplateId ? `/assets/templates/${event.selectedTemplateId}.svg` : null,
    invitation.templateId ? `/assets/templates/${invitation.templateId}.svg` : null,
  ];

  for (const cand of candidateArtworks) {
    if (cand && typeof cand === "string" && !cand.startsWith("#") && !cand.startsWith("data:")) {
      const resolved = resolveAssetPath(cand);
      if (resolved) {
        artworkPath = resolved;
        break;
      }
    }
  }

  // Category-based fallback artwork
  if (!artworkPath && event.eventType) {
    const cat = String(event.eventType).toLowerCase().trim();
    if (CATEGORY_ARTWORK_MAP[cat]) {
      artworkPath = resolveAssetPath(CATEGORY_ARTWORK_MAP[cat]);
    }
  }

  // Default elegant floral wreath if none found
  if (!artworkPath) {
    artworkPath = resolveAssetPath("floral-wreath-sophia-bg.svg") || resolveAssetPath("floral-wreath-sophia.svg") || resolveAssetPath("blue-botanical.svg");
  }

  if (artworkPath) {
    try {
      const artImg = await loadImage(artworkPath);
      ctx.save();
      // Clip inside card rounded rectangle
      drawRoundedRect(ctx, cardX + 6, cardY + 6, cardWidth - 12, cardHeight - 12, cardRadius - 2);
      ctx.clip();
      // Render crisp decorative frame / floral border
      ctx.globalAlpha = 0.85;
      ctx.drawImage(artImg, cardX, cardY, cardWidth, cardHeight);
      ctx.restore();
    } catch (artErr) {
      console.warn("[CardRenderer] Could not load artwork image:", artErr.message);
    }
  }

  // ─── 5. DYNAMIC TYPOGRAPHY OVERLAY (CUSTOM DESIGNER LAYERS OR FALLBACK) ───
  const customLayers =
    (Array.isArray(invitation.textElements) && invitation.textElements.length > 0 && invitation.textElements) ||
    (Array.isArray(invitation.textLayers) && invitation.textLayers.length > 0 && invitation.textLayers) ||
    null;

  if (customLayers && customLayers.length > 0) {
    ctx.save();
    for (const layer of customLayers) {
      if (!layer || !layer.text) continue;
      const layerText = String(layer.text).trim();
      if (!layerText) continue;

      const layerX = layer.x !== undefined ? layer.x : (layer.left !== undefined ? layer.left : 50);
      const layerY = layer.y !== undefined ? layer.y : (layer.top !== undefined ? layer.top : 50);

      // Map percentage (0-100%) to card coordinate space
      const textX = cardX + (layerX / 100) * cardWidth;
      const textY = cardY + (layerY / 100) * cardHeight;

      const align = layer.textAlign || layer.align || "center";
      ctx.textAlign = align;
      ctx.textBaseline = "middle";

      const baseSize = layer.fontSize || 20;
      // Scale from web designer canvas (approx 500px width) to high-res card width (620px)
      const scaledSize = Math.max(12, Math.round(baseSize * 1.24));

      const fontWeight = layer.fontWeight || (baseSize > 28 ? "bold" : "normal");
      const rawFamily = layer.fontFamily || "serif";
      let cleanFamily = "serif";
      if (rawFamily.includes("Playfair")) cleanFamily = "'Playfair Display', Georgia, 'Times New Roman', serif";
      else if (rawFamily.includes("Montserrat")) cleanFamily = "'Montserrat', 'Inter', sans-serif";
      else if (rawFamily.includes("Inter") || rawFamily.includes("sans-serif")) cleanFamily = "'Inter', 'Segoe UI', Arial, sans-serif";
      else cleanFamily = rawFamily;

      ctx.font = `${fontWeight} ${scaledSize}px ${cleanFamily}`;

      // Handle text casing
      let displayText = layerText;
      if (layer.casing === "uppercase") displayText = displayText.toUpperCase();
      else if (layer.casing === "lowercase") displayText = displayText.toLowerCase();
      else if (layer.casing === "capitalize") {
        displayText = displayText.replace(/\b\w/g, (c) => c.toUpperCase());
      }

      // Handle Foil effect if configured
      if (layer.isFoil || layer.foilGradient) {
        const foilGrad = ctx.createLinearGradient(textX - 120, textY - 20, textX + 120, textY + 20);
        if (layer.isFoil === "rose-gold") {
          foilGrad.addColorStop(0, "#B76E79");
          foilGrad.addColorStop(0.5, "#ECC5C8");
          foilGrad.addColorStop(1, "#B76E79");
        } else if (layer.isFoil === "silver") {
          foilGrad.addColorStop(0, "#C0C0C0");
          foilGrad.addColorStop(0.5, "#FFFFFF");
          foilGrad.addColorStop(1, "#A8A8A8");
        } else {
          // Gold foil
          foilGrad.addColorStop(0, "#D4AF37");
          foilGrad.addColorStop(0.4, "#FDF2B8");
          foilGrad.addColorStop(0.7, "#AA771C");
          foilGrad.addColorStop(1, "#D4AF37");
        }
        ctx.fillStyle = foilGrad;
      } else {
        ctx.fillStyle = layer.color || textColor;
      }

      const maxLineWidth = Math.max(100, cardWidth - 80);
      const lines = wrapText(ctx, displayText, maxLineWidth);
      const lineHeight = scaledSize * (layer.lineHeight || 1.25);
      const totalTextHeight = lines.length * lineHeight;
      const startY = textY - (totalTextHeight / 2) + (lineHeight / 2);

      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], textX, startY + i * lineHeight);
      }
    }
    ctx.restore();
  } else {
    // ── FALLBACK STRUCTURED LAYOUT (WHEN NO CUSTOM LAYERS PROVIDED) ──
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const centerX = CANVAS_WIDTH / 2;

    // A) Top Header Badge (14% from card top)
    const headerY = cardY + 80;
    ctx.font = "bold 15px 'Montserrat', 'Inter', 'Segoe UI', sans-serif";
    ctx.fillStyle = accentColor;
    const headerText = "YOU'RE CORDIALLY INVITED";
    ctx.fillText(headerText, centerX, headerY);

    // Decorative top flourish under header
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - 60, headerY + 16);
    ctx.lineTo(centerX + 60, headerY + 16);
    ctx.stroke();

    // B) Host Name / Presentation (23% from card top)
    let currentY = headerY + 60;
    if (hostName) {
      ctx.font = "italic 20px 'Playfair Display', Georgia, 'Times New Roman', serif";
      ctx.fillStyle = secondaryColor;
      ctx.fillText(`Hosted by ${hostName}`, centerX, currentY);
      currentY += 40;
    }

    // C) Prominent Event Title (34% - 48% from card top)
    currentY = Math.max(currentY, cardY + 230);
    ctx.fillStyle = textColor;

    let titleFontSize = 42;
    if (title.length > 40) {
      titleFontSize = 30;
    } else if (title.length > 25) {
      titleFontSize = 36;
    }

    ctx.font = `bold ${titleFontSize}px 'Playfair Display', Georgia, 'Times New Roman', serif`;
    const titleLines = wrapText(ctx, title, cardWidth - 120);
    const titleLineHeight = titleFontSize * 1.25;

    for (let i = 0; i < titleLines.length; i++) {
      ctx.fillText(titleLines[i], centerX, currentY + i * titleLineHeight);
    }
    currentY += titleLines.length * titleLineHeight + 10;

    // D) Subtitle or Description (if present)
    if (subtitle) {
      ctx.font = "500 18px 'Inter', 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = secondaryColor;
      const subLines = wrapText(ctx, subtitle, cardWidth - 140);
      for (const line of subLines) {
        ctx.fillText(line, centerX, currentY);
        currentY += 26;
      }
      currentY += 10;
    }

    // E) Ornamental Divider
    currentY = Math.max(currentY + 10, cardY + 490);
    drawOrnamentalDivider(ctx, centerX, currentY, accentColor);

    // F) Event Date & Time Block (58% - 68% from card top)
    currentY += 50;
    if (eventDate) {
      ctx.font = "bold 24px 'Montserrat', 'Inter', 'Segoe UI', sans-serif";
      ctx.fillStyle = textColor;
      ctx.fillText(eventDate.toUpperCase(), centerX, currentY);
      currentY += 34;
    }

    if (eventTime) {
      ctx.font = "600 20px 'Montserrat', 'Inter', 'Segoe UI', sans-serif";
      ctx.fillStyle = accentColor;
      ctx.fillText(eventTime.toUpperCase(), centerX, currentY);
      currentY += 45;
    }

    // G) Venue & Address Block (74% - 84% from card top)
    currentY = Math.max(currentY, cardY + 680);
    if (venue) {
      ctx.font = "bold 22px 'Playfair Display', Georgia, 'Times New Roman', serif";
      ctx.fillStyle = textColor;
      const venueLines = wrapText(ctx, venue, cardWidth - 140);
      for (const vl of venueLines) {
        ctx.fillText(vl, centerX, currentY);
        currentY += 28;
      }
    }

    if (address) {
      ctx.font = "16px 'Inter', 'Segoe UI', Arial, sans-serif";
      ctx.fillStyle = secondaryColor;
      const addrLines = wrapText(ctx, address, cardWidth - 160);
      for (const al of addrLines) {
        ctx.fillText(al, centerX, currentY);
        currentY += 24;
      }
    }

    // H) Bottom RSVP Callout (92% from card top)
    const bottomY = cardY + cardHeight - 55;
    ctx.font = "bold 13px 'Montserrat', 'Inter', 'Segoe UI', sans-serif";
    ctx.fillStyle = accentColor;
    ctx.fillText("PLEASE VIEW DETAILS & RSVP BELOW", centerX, bottomY);

    ctx.restore();
  }

  ctx.restore();

  // Export high-resolution PNG buffer
  return canvas.toBuffer("image/png");
}

module.exports = {
  renderInvitationCardPng,
  resolveAssetPath,
};
