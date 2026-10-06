const path = require("path");
const fs = require("fs");
const napiCanvas = require("@napi-rs/canvas");
const { createCanvas, loadImage } = napiCanvas;
const GlobalFonts = napiCanvas.GlobalFonts || null;

// Base directories for template assets
const TEMPLATES_DIRS = [
  path.resolve(__dirname, "../../../public/templates/bridal"),
  path.resolve(__dirname, "../../../public/templates/envelopes"),
  path.resolve(__dirname, "../../../public/templates"),
  path.resolve(__dirname, "../../../public/assets/templates"),
  path.resolve(__dirname, "../../../invitehub/public/templates/bridal"),
  path.resolve(__dirname, "../../../invitehub/public/templates"),
  path.resolve(__dirname, "../../../invitehub/public/assets/templates"),
  path.resolve(__dirname, "../../public/assets/templates"),
  path.resolve(__dirname, "../../uploads"),
  path.resolve(__dirname, "../../../public/images"),
  path.resolve(__dirname, "../../public/images"),
];

// ─── Backend canvas font registration ───────────────────────────────────────────
// @napi-rs/canvas has no browser, so it can only draw families that are installed on the
// host or explicitly registered from a font file. Drop .ttf/.otf/.woff2 files into
// backend/public/fonts/ to make template typography render exactly as in the designer.
// Absence of font files must NEVER break rendering.
const FONT_DIRS = [
  path.resolve(__dirname, "../../public/fonts"),
  path.resolve(__dirname, "../../../public/fonts"),
  path.resolve(__dirname, "../../fonts"),
];

const GENERIC_FALLBACKS = [
  { match: ["caveat", "dancing script", "great vibes", "alex brush", "pinyon script", "parisienne", "pacifico", "permanent marker", "londrina", "satisfy", "allura", "sacramento"], generic: "cursive" },
  { match: ["playfair", "cinzel", "cormorant", "bodoni", "prata", "marcellus", "libre baskerville", "lora", "merriweather", "garamond", "georgia", "times"], generic: "serif" },
  { match: ["questrial", "inter", "montserrat", "poppins", "raleway", "lato", "roboto", "open sans", "nunito", "work sans", "dm sans"], generic: "sans-serif" },
];

let FONT_REGISTRY_ATTEMPTED = false;
let REGISTERED_FAMILIES = null;

function registerLocalFonts() {
  if (FONT_REGISTRY_ATTEMPTED) return;
  FONT_REGISTRY_ATTEMPTED = true;
  if (!GlobalFonts || typeof GlobalFonts.registerFromPath !== "function") return;
  try {
    let registeredCount = 0;
    for (const dir of FONT_DIRS) {
      if (!fs.existsSync(dir)) continue;
      for (const file of fs.readdirSync(dir)) {
        if (!/\.(ttf|otf|ttc|woff2?)$/i.test(file)) continue;
        try {
          if (GlobalFonts.registerFromPath(path.join(dir, file))) registeredCount += 1;
        } catch (fontErr) {
          console.warn(`[CardRenderer] Skipped font ${file}: ${fontErr.message}`);
        }
      }
    }
    REGISTERED_FAMILIES = new Set(
      (GlobalFonts.families || [])
        .map((f) => String((f && (f.family || f.name)) || f || "").trim().toLowerCase())
        .filter(Boolean)
    );
    if (registeredCount > 0) {
      console.log(`[CardRenderer] Registered ${registeredCount} custom font file(s) for canvas rendering`);
    }
  } catch (err) {
    console.warn("[CardRenderer] Font registration skipped:", err.message);
  }
}

/**
 * Resolve a CSS font-family stack into something canvas can actually paint.
 * Prefers an installed/registered family, otherwise degrades to the closest generic family
 * so text never renders in an unintended default face.
 */
function resolveCanvasFontFamily(rawFamily) {
  const raw = String(rawFamily || "").trim();
  if (!raw) return "serif";
  const primary = raw.split(",")[0].replace(/^['"]|['"]$/g, "").replace(/\s*!important$/i, "").trim();
  if (!primary) return "serif";

  registerLocalFonts();
  const lower = primary.toLowerCase();
  if (REGISTERED_FAMILIES && REGISTERED_FAMILIES.has(lower)) {
    return `'${primary}', serif`;
  }

  const rest = raw
    .split(",")
    .slice(1)
    .map((f) => f.replace(/^['"]|['"]$/g, "").trim())
    .filter((f) => f && !/^(sans-serif|serif|monospace|cursive|fantasy|system-ui|inherit|initial)$/i.test(f));

  for (const rule of GENERIC_FALLBACKS) {
    if (rule.match.some((m) => lower.includes(m))) {
      return [`'${primary}'`, ...rest.map((f) => `'${f}'`), rule.generic].join(", ");
    }
  }
  return [`'${primary}'`, ...rest.map((f) => `'${f}'`), "serif"].join(", ");
}

/**
 * Resolve the template schema for an invitation/event.
 * Priority: frontend-sent templateConfig → backend template registry → canvasState-derived.
 */
function resolveTemplateConfig(invitation = {}, event = {}) {
  if (invitation.templateConfig && typeof invitation.templateConfig === "object") {
    return invitation.templateConfig;
  }

  const candidateIds = [
    invitation.templateId,
    event.selectedTemplateId,
    event.templateId,
    typeof invitation.canvasState === "object" ? invitation.canvasState?.templateId : null,
    typeof invitation.canvasState === "object" ? invitation.canvasState?.activeTemplateId : null,
  ].filter(Boolean);

  try {
    const { newTemplatesDataBackend } = require("../config/newTemplatesBackend");
    for (const id of candidateIds) {
      const found = (newTemplatesDataBackend || []).find(
        (t) => t && typeof t.id === "string" && t.id.toLowerCase() === String(id).toLowerCase()
      );
      if (found) return found;
    }
  } catch (registryErr) {
    console.warn("[CardRenderer] Template registry unavailable:", registryErr.message);
  }

  // Derive a minimal config straight from the persisted canvasState
  const cs =
    (typeof invitation.canvasState === "object" && invitation.canvasState) ||
    (typeof event.canvasState === "object" && event.canvasState) ||
    null;
  if (cs) {
    return {
      id: cs.templateId || cs.activeTemplateId || null,
      card: cs.card,
      envelope: cs.envelope,
      backdrop: cs.backdrop || cs.stageBackdrop,
      backgroundColor: cs.cardBg && cs.cardBg.type === "color" ? cs.cardBg.value : null,
    };
  }
  return null;
}

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

  // If this is an SVG template asset, prefer the textless '-bg.svg' variant to prevent double text
  if (clean.endsWith(".svg") && !clean.endsWith("-bg.svg")) {
    const bgCandidate = clean.replace(/\.svg$/i, "-bg.svg");
    const resolvedBg = resolveAssetPath(bgCandidate);
    if (resolvedBg) return resolvedBg;
  }

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
 * Lighten (amount > 0) or darken (amount < 0) a hex colour by a 0-255 channel delta.
 */
function shiftColor(hex, amount) {
  const m = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.exec(String(hex || "").trim());
  if (!m) return hex;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) + amount);
  const g = clamp(((n >> 8) & 255) + amount);
  const b = clamp((n & 255) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/**
 * Parse a CSS gradient (e.g. "linear-gradient(135deg, #A 0%, #B 100%)") into canvas stops.
 * Returns null when the input cannot be interpreted.
 */
function parseGradientStops(css) {
  if (!css || typeof css !== "string") return null;
  const innerMatch = css.match(/gradient\((.*)\)/);
  if (!innerMatch) return null;
  const body = innerMatch[1];
  // Drop leading direction/position arguments such as 135deg, to right, 0px 0px
  const parts = body.split(",").map((p) => p.trim());
  const stops = [];
  let positionalSeen = false;
  for (const part of parts) {
    const colorMatch = part.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))/);
    if (!colorMatch) {
      positionalSeen = true;
      continue;
    }
    if (positionalSeen && !/\d/.test(part.replace(colorMatch[0], ""))) {
      positionalSeen = false;
    }
    const afterColor = part.slice(part.indexOf(colorMatch[0]) + colorMatch[0].length).trim();
    const pct = afterColor.match(/(-?\d*\.?\d+)%/);
    stops.push({ color: colorMatch[1], offsetPct: pct ? parseFloat(pct[1]) : null });
  }
  if (stops.length < 2) return null;
  // Normalise offsets
  let sawOffset = false;
  stops.forEach((s) => {
    if (s.offsetPct !== null) sawOffset = true;
  });
  if (!sawOffset) {
    stops.forEach((s, i) => {
      s.offsetPct = (i / (stops.length - 1)) * 100;
    });
  } else {
    let last = 0;
    stops.forEach((s) => {
      if (s.offsetPct === null) s.offsetPct = last;
      last = s.offsetPct;
    });
  }
  const min = stops[0].offsetPct;
  const max = stops[stops.length - 1].offsetPct;
  const span = max - min || 100;
  return stops.map((s) => ({
    offset: Math.min(1, Math.max(0, (s.offsetPct - min) / span)),
    color: s.color,
  }));
}

/**
 * Helper to wrap text into lines fitting within maxWidth (accounting for letter spacing)
 */
function wrapText(ctx, text, maxWidth, letterSpacing = 0) {
  if (!text) return [];
  const ls = Number(letterSpacing) || 0;
  const measure = (s) => ctx.measureText(s).width + (s.length > 0 ? (s.length - 1) * ls : 0);
  const rawParagraphs = String(text).split("\n");
  const lines = [];

  for (const paragraph of rawParagraphs) {
    const words = paragraph.split(" ");
    let currentLine = words[0] || "";

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = measure(currentLine + " " + word);
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
 * Draw a single line of text honouring ctx.textAlign, with manual letter-spacing support.
 */
function drawTextLine(ctx, text, x, y, letterSpacing = 0) {
  const ls = Number(letterSpacing) || 0;
  if (!ls) {
    ctx.fillText(text, x, y);
    return;
  }
  const width = ctx.measureText(text).width + (text.length > 0 ? (text.length - 1) * ls : 0);
  let startX = x;
  const align = ctx.textAlign;
  if (align === "center") startX = x - width / 2;
  else if (align === "right" || align === "end") startX = x - width;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  for (const ch of text) {
    ctx.fillText(ch, startX, y);
    startX += ctx.measureText(ch).width + ls;
  }
  ctx.textAlign = prevAlign;
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

  registerLocalFonts();

  // Resolve the chosen template schema — without this the composite falls back to a generic
  // layout with default colours instead of the designer's template.
  if (!templateConfig) {
    templateConfig = resolveTemplateConfig(invitation, event);
  }

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

  // Color tokens — resolve from the designer's 4-layer model before falling back to defaults
  const canvasState =
    (typeof invitation.canvasState === "object" && invitation.canvasState) ||
    (typeof event.canvasState === "object" && event.canvasState) ||
    null;

  const colorToken = (v) =>
    typeof v === "string" && v.trim() && (v.startsWith("#") || /^(rgb|hsl)a?\(/i.test(v.trim()))
      ? v.trim()
      : null;

  const cardBgToken = invitation.cardBg || invitation.background || canvasState?.cardBg || null;
  const cardBgColor =
    colorToken(invitation.card?.backgroundColor) ||
    colorToken(invitation.backgroundColor) ||
    (cardBgToken && cardBgToken.type === "color" ? colorToken(cardBgToken.value) : null) ||
    colorToken(templateConfig?.card?.backgroundColor) ||
    colorToken(templateConfig?.innerCardLayer?.backgroundColor) ||
    colorToken(templateConfig?.backgroundColor) ||
    "#FAF9F6";

  const accentColor =
    colorToken(invitation.accentColor) ||
    colorToken(invitation.eventDetails?.accentColor) ||
    colorToken(templateConfig?.accentColor) ||
    colorToken(templateConfig?.envelope?.outerColor) ||
    "#C49B45";
  const textColor =
    colorToken(invitation.textColor) ||
    colorToken(canvasState?.textColor) ||
    colorToken(templateConfig?.textColor) ||
    "#1E293B";
  const secondaryColor = colorToken(templateConfig?.secondaryColor) || "#64748B";
  const envelopeOuterColor =
    colorToken(invitation.envelope?.outerColor) ||
    colorToken(canvasState?.envelope?.outerColor) ||
    colorToken(templateConfig?.envelope?.outerColor) ||
    (invitation.accentColor ? `${invitation.accentColor}dd` : "#1E293B");

  // ─── 1. BACKDROP LAYER ───
  const backdropCss = templateConfig?.backdrop?.gradient || null;
  const backdropStops = parseGradientStops(backdropCss);
  const backdropColor =
    colorToken(templateConfig?.backdrop?.color) || colorToken(templateConfig?.backdrop?.value) || null;
  if (backdropStops && backdropStops.length >= 2) {
    const grad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    backdropStops.forEach((s) => grad.addColorStop(s.offset, s.color));
    ctx.fillStyle = grad;
  } else if (backdropColor) {
    ctx.fillStyle = backdropColor;
  } else {
    const backdropGrad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    backdropGrad.addColorStop(0, "#F3F0EA");
    backdropGrad.addColorStop(0.5, "#EAE5DC");
    backdropGrad.addColorStop(1, "#DFD8CC");
    ctx.fillStyle = backdropGrad;
  }
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

  // Envelope liner flap — honour the template's liner colour, otherwise gold foil shimmer
  const linerBase =
    colorToken(templateConfig?.envelope?.linerColor) ||
    colorToken(invitation.envelope?.linerColor) ||
    null;
  const linerGrad = ctx.createLinearGradient(envX, envY, envX + envWidth, envY + envHeight * 0.55);
  if (linerBase) {
    linerGrad.addColorStop(0, shiftColor(linerBase, 34));
    linerGrad.addColorStop(0.35, linerBase);
    linerGrad.addColorStop(0.7, shiftColor(linerBase, -26));
    linerGrad.addColorStop(1, shiftColor(linerBase, 14));
  } else {
    linerGrad.addColorStop(0, "#FDF2B8");
    linerGrad.addColorStop(0.3, "#D4AF37");
    linerGrad.addColorStop(0.6, "#AA771C");
    linerGrad.addColorStop(0.85, "#F3E5AB");
    linerGrad.addColorStop(1, "#8B5E14");
  }

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
  const canvasStateArt =
    (typeof invitation.canvasState === "object" && invitation.canvasState) ||
    (typeof event.canvasState === "object" && event.canvasState) ||
    null;
  const templateIdForArt =
    invitation.templateId || event.selectedTemplateId || event.templateId ||
    canvasStateArt?.templateId || canvasStateArt?.activeTemplateId || null;

  const candidateArtworks = [
    // Template schema supplied by the designer (authoritative)
    templateConfig?.card?.artworkUrl,
    templateConfig?.card?.decorativeBorderSvgUrl,
    templateConfig?.card?.borderIllustration,
    templateConfig?.canvasData?.backgroundImage,
    templateConfig?.imageUrl,
    // Template-ID derived textless asset — preferred over any stored snapshot
    templateIdForArt ? `/assets/templates/${templateIdForArt}-bg.svg` : null,
    templateIdForArt ? `/assets/templates/${templateIdForArt}.svg` : null,
    // Full 4-layer card object (when available from frontend payload)
    invitation.card?.artworkUrl,
    invitation.card?.decorativeBorderSvgUrl,
    invitation.card?.borderIllustration,
    typeof invitation.cardBg?.value === "string" && invitation.cardBg.type === "image" ? invitation.cardBg.value : null,
    typeof invitation.background?.value === "string" && invitation.background.type === "image" ? invitation.background.value : null,
    canvasStateArt?.backgroundImageUrl || null,
    // LAST RESORT: stored snapshots / cover images (these bake in text — avoid when we
    // are about to draw our own text layers on top)
    invitation.imageUrl,
    invitation.coverImage,
    event.coverImage,
    event.imageUrl,
  ];

  const hasCustomTextLayers = Boolean(
    (Array.isArray(invitation.textElements) && invitation.textElements.length > 0) ||
    (Array.isArray(invitation.textLayers) && invitation.textLayers.length > 0)
  );

  const isSnapshotLike = (cand) => {
    const lower = String(cand).toLowerCase();
    return (
      lower.includes("snapshot") ||
      lower.includes("canvas_snapshot") ||
      lower.includes("invitation_snapshot") ||
      lower.includes("invitation_cover") ||
      lower.includes("/uploads/") && (lower.includes("cover") || lower.includes("preview"))
    );
  };

  for (const cand of candidateArtworks) {
    if (cand && typeof cand === "string" && !cand.startsWith("#") && !cand.startsWith("data:")) {
      // When we draw our own text layers on top, never reuse a rendered snapshot that already
      // contains text — it would double-print the copy.
      if (hasCustomTextLayers && isSnapshotLike(cand)) continue;
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
      // Template artwork IS the card design (paper colour + border illustrations) so it must be
      // composited at full opacity; photos/textures blend over the card colour instead.
      const isTemplateArtwork =
        /-bg\.svg$/i.test(artworkPath) ||
        artworkPath.includes(`assets${path.sep}templates`) ||
        artworkPath.includes(`/assets/templates/`) ||
        artworkPath.includes(`templates${path.sep}`);
      ctx.globalAlpha = isTemplateArtwork ? 1 : 0.85;
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
      const cleanFamily = resolveCanvasFontFamily(layer.fontFamily || "serif");

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
        ctx.fillStyle = colorToken(layer.color) || textColor;
      }

      const rotation = Number(layer.rotation || layer.rotate || 0);
      const letterSpacing = Number(layer.letterSpacing || 0);

      ctx.save();
      if (rotation) {
        ctx.translate(textX, textY);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-textX, -textY);
      }

      const maxLineWidth = Math.max(100, cardWidth - 80);
      const lines = wrapText(ctx, displayText, maxLineWidth, letterSpacing);
      const lineHeight = scaledSize * (layer.lineHeight || 1.25);
      const totalTextHeight = lines.length * lineHeight;
      const startY = textY - (totalTextHeight / 2) + (lineHeight / 2);

      for (let i = 0; i < lines.length; i++) {
        drawTextLine(ctx, lines[i], textX, startY + i * lineHeight, letterSpacing);
      }
      ctx.restore();
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
  resolveTemplateConfig,
};
