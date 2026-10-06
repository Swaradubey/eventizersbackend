const path = require("path");
const fs = require("fs");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

/**
 * Digital Envelope Renderer for invitation emails.
 *
 * Produces:
 *  1. renderEnvelopePreviewPng()  — Option B: a single composite image (envelope
 *     flap + liner + card + V-cut pocket + seal) delivered as cid:invitation_preview
 *  2. renderEnvelopeFlapBandPng() — Option A piece: flap/liner band (cid:envelope_flap)
 *  3. renderEnvelopePocketBandPng() — Option A piece: pocket front band (cid:envelope_pocket)
 *  4. resolveEnvelopeDesign()/resolveLinerVisual() — shared design + liner resolution
 */

// ─────────────────────────────────────────────────────────────────────────────
// Asset discovery
// ─────────────────────────────────────────────────────────────────────────────
const ENVELOPE_ASSET_DIRS = [
  path.resolve(__dirname, "../../public/templates/envelopes"),
  path.resolve(__dirname, "../../../public/templates/envelopes"),
  path.resolve(__dirname, "../../../invitehub/public/templates/envelopes"),
  path.resolve(__dirname, "../../public/templates"),
  path.resolve(__dirname, "../../../public/templates"),
];

// Mirrors the client-side ENVELOPE_LINERS_DATA lookup table
// (components/designer/InvitationCanvasStage.tsx) so the backend resolves the
// exact same liner the designer showed in the studio.
const LINER_CSS_MAP = {
  "autumn-gingham":
    "repeating-linear-gradient(0deg, #cb925d 0px, #cb925d 14px, #fbf7ee 14px, #fbf7ee 28px), repeating-linear-gradient(90deg, rgba(160, 98, 42, 0.38) 0px, rgba(160, 98, 42, 0.38) 14px, transparent 14px, transparent 28px)",
  "vertical-pink-stripes":
    "repeating-linear-gradient(90deg, #ea5b95 0px, #ea5b95 11px, #ffffff 11px, #ffffff 22px)",
  "pink-stripes":
    "repeating-linear-gradient(90deg, #ea5b95 0px, #ea5b95 11px, #ffffff 11px, #ffffff 22px)",
  none: "rgba(0,0,0,0.02)",
  "gold-grid": "repeating-conic-gradient(#c9a227 0% 25%, #e8bb3a 0% 50%) 0 0 / 14px 14px",
  "gold-checkered": "repeating-conic-gradient(#c9a227 0% 25%, #e8bb3a 0% 50%) 0 0 / 14px 14px",
  "rose-gold":
    "linear-gradient(135deg, #e8c4c4 0%, #d4a0a8 20%, #c490a0 40%, #b87898 60%, #c490a0 80%, #d4a0a8 100%)",
  "rose-gold-metallic":
    "linear-gradient(135deg, #e8c4c4 0%, #d4a0a8 20%, #c490a0 40%, #b87898 60%, #c490a0 80%, #d4a0a8 100%)",
  "gold-foil": "linear-gradient(135deg, #bf953f, #fcf6ba, #b38728)",
  "silver-foil": "linear-gradient(135deg, #cfd9df 0%, #e2ebf0 40%, #b8c6db 70%, #f5f7fa 100%)",
  "pink-gingham":
    "repeating-linear-gradient(0deg, #fcdde3, #fcdde3 14px, #ffffff 14px, #ffffff 28px), repeating-linear-gradient(90deg, rgba(244,114,182,0.3), rgba(244,114,182,0.3) 14px, transparent 14px, transparent 28px)",
  "sage-mist": "linear-gradient(135deg, #a3b899 0%, #8ea383 100%)",
  "ivory-linen": "linear-gradient(135deg, #fdfbf7 0%, #f4f0e8 100%)",
  "pink-glitter": "radial-gradient(circle at 50% 50%, #f472b6, #db2777)",
  sprinkles:
    "repeating-linear-gradient(45deg, #fbcfe8, #fbcfe8 10px, #fef08a 10px, #fef08a 20px, #67e8f9 20px, #67e8f9 30px)",
  "electric-gradient": "conic-gradient(at top left, #f43f5e, #eab308, #06b6d4, #8b5cf6, #f43f5e)",
  marble: "linear-gradient(120deg, #f1f5f9 0%, #e2e8f0 50%, #ffffff 100%)",
  botanical: "linear-gradient(135deg, #dcfce7, #86efac)",
  "blush-burgundy-liner": "url('/templates/envelopes/blush-burgundy-liner.png') center / cover no-repeat",
  "/templates/envelopes/blush-burgundy-liner.png":
    "url('/templates/envelopes/blush-burgundy-liner.png') center / cover no-repeat",
  "blush-gold-foil-liner": "url('/templates/envelopes/blush-gold-foil-liner.svg') center / cover no-repeat",
  "/templates/envelopes/blush-gold-foil-liner.svg":
    "url('/templates/envelopes/blush-gold-foil-liner.svg') center / cover no-repeat",
  "something-blue-liner": "url('/templates/envelopes/something-blue-liner.png') center / cover no-repeat",
  "/templates/envelopes/something-blue-liner.png":
    "url('/templates/envelopes/something-blue-liner.png') center / cover no-repeat",
  "something-blue-toile-liner": "url('/templates/envelopes/something-blue-toile-liner.svg') center / cover no-repeat",
  "/templates/envelopes/something-blue-toile-liner.svg":
    "url('/templates/envelopes/something-blue-toile-liner.svg') center / cover no-repeat",
  "autumn-gingham-liner": "url('/templates/envelopes/autumn-gingham-liner.png') center / cover no-repeat",
  "/templates/envelopes/autumn-gingham-liner.png":
    "url('/templates/envelopes/autumn-gingham-liner.png') center / cover no-repeat",
  "lemons-blossoms-liner": "url('/templates/envelopes/lemons-blossoms-liner.svg') center / cover no-repeat",
  "ribbons-bows-liner": "url('/templates/envelopes/ribbons-bows-liner.svg') center / cover no-repeat",
  "tea-time-liner": "url('/templates/envelopes/tea-time-liner.svg') center / cover no-repeat",
  "woodland-gingham-liner": "url('/templates/envelopes/woodland-gingham-liner.svg') center / cover no-repeat",
};

const DEFAULT_LINER_CSS = LINER_CSS_MAP["gold-foil"];

// ─────────────────────────────────────────────────────────────────────────────
// Color helpers
// ─────────────────────────────────────────────────────────────────────────────
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function parseColor(input) {
  if (!input || typeof input !== "string") return null;
  const c = input.trim();
  let m = c.match(/^#([0-9a-f]{3,8})$/i);
  if (m) {
    let hex = m[1];
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .split("")
        .map((ch) => ch + ch)
        .join("");
    }
    if (hex.length === 6 || hex.length === 8) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
      ];
    }
    return null;
  }
  m = c.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (m) {
    return [
      clamp(Math.round(parseFloat(m[1])), 0, 255),
      clamp(Math.round(parseFloat(m[2])), 0, 255),
      clamp(Math.round(parseFloat(m[3])), 0, 255),
      m[4] !== undefined ? clamp(parseFloat(m[4]), 0, 1) : 1,
    ];
  }
  const NAMED = {
    white: [255, 255, 255, 1],
    black: [0, 0, 0, 1],
    transparent: [0, 0, 0, 0],
    ivory: [255, 255, 240, 1],
    gold: [212, 175, 55, 1],
    cream: [255, 253, 235, 1],
  };
  return NAMED[c.toLowerCase()] || null;
}

function rgbaStr(rgb, alpha) {
  if (!rgb) return `rgba(0,0,0,${alpha === undefined ? 1 : alpha})`;
  const a = alpha === undefined ? rgb[3] : alpha;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
}

function mixHex(a, b, t) {
  const ca = parseColor(a) || [0, 0, 0, 1];
  const cb = parseColor(b) || [0, 0, 0, 1];
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
  return `#${[r, g, bl].map((v) => clamp(v, 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

function lighten(hex, amount) {
  return mixHex(hex || "#000000", "#ffffff", amount);
}

function darken(hex, amount) {
  return mixHex(hex || "#000000", "#000000", amount);
}

function extractCssColors(css) {
  if (!css) return [];
  const matches =
    css.match(/#[0-9a-f]{8}|#[0-9a-f]{6}|#[0-9a-f]{3}\b|rgba?\([^)]+\)/gi) || [];
  return matches;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS gradient parsing / painting
// ─────────────────────────────────────────────────────────────────────────────
function splitTopLevel(str) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of String(str || "")) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const STOP_RE = /^(#[0-9a-f]{8}|#[0-9a-f]{6}|#[0-9a-f]{3}|rgba?\([^)]+\)|[a-z]+)\s*(-?[\d.]+(?:%|px)?)?/i;

function parseGradientStops(inner) {
  const tokens = splitTopLevel(inner);
  const stops = [];
  for (const t of tokens) {
    const m = t.match(STOP_RE);
    if (!m) continue;
    let pos = null;
    if (m[2]) {
      pos = {
        value: parseFloat(m[2]),
        unit: m[2].includes("%") ? "%" : "px",
      };
    }
    stops.push({ color: m[1], pos });
  }
  return stops;
}

function parseAngleToken(token, fallbackDeg) {
  if (!token) return fallbackDeg;
  const t = String(token).trim();
  const m = t.match(/(-?[\d.]+)(deg|grad|rad|turn)?/i);
  if (!m) return fallbackDeg;
  const v = parseFloat(m[1]);
  const unit = (m[2] || "deg").toLowerCase();
  if (unit === "grad") return v * 0.9;
  if (unit === "rad") return (v * 180) / Math.PI;
  if (unit === "turn") return v * 360;
  return v;
}

function gradientLineRect(x, y, w, h, deg) {
  const rad = (deg * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const len = Math.abs(w * dx) + Math.abs(h * dy) || 1;
  return {
    x0: cx - (dx * len) / 2,
    y0: cy - (dy * len) / 2,
    x1: cx + (dx * len) / 2,
    y1: cy + (dy * len) / 2,
    len,
  };
}

function addCanvasStops(grad, stops, len) {
  if (!stops.length) return;
  if (stops.length === 1) {
    grad.addColorStop(0, stops[0].color);
    grad.addColorStop(1, stops[0].color);
    return;
  }
  let last = -1;
  stops.forEach((s, i) => {
    let p;
    if (s.pos && s.pos.unit === "%") p = (s.pos.value / 100) * len;
    else if (s.pos && s.pos.unit === "px") p = s.pos.value;
    else p = (i / (stops.length - 1)) * len;
    if (!Number.isFinite(p) || p < last) p = last;
    last = p;
    grad.addColorStop(clamp(len ? p / len : 0, 0, 1), s.color);
  });
}

function fillStripes(ctx, x, y, w, h, angleDeg, stops) {
  if (!stops.length) return;
  // Repeating period = position of the final stop (px), or a sane default.
  let period = 26;
  const lastPos = stops[stops.length - 1].pos;
  if (lastPos && lastPos.unit === "px" && lastPos.value > 0) period = lastPos.value;
  else if (lastPos && lastPos.unit === "%" && lastPos.value > 0) period = (lastPos.value / 100) * h;

  const positions = stops.map((s, i) => {
    if (s.pos && s.pos.unit === "px") return s.pos.value;
    if (s.pos && s.pos.unit === "%") return (s.pos.value / 100) * period;
    return (i / Math.max(1, stops.length - 1)) * period;
  });
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] < positions[i - 1]) positions[i] = positions[i - 1];
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(((angleDeg + 180) * Math.PI) / 180);
  const R = Math.hypot(w, h) + period;
  for (let base = -R; base < R; base += period) {
    for (let i = 0; i < stops.length - 1; i++) {
      const from = base + positions[i];
      const to = base + positions[i + 1];
      if (to - from <= 0.01) continue;
      ctx.fillStyle = stops[i].color;
      ctx.fillRect(-R, from, 2 * R, to - from);
    }
  }
  ctx.restore();
}

function fillChecker(ctx, x, y, w, h, colors, tile) {
  const t = Math.max(6, tile || 16);
  const tileCanvas = createCanvas(t * 2, t * 2);
  const tctx = tileCanvas.getContext("2d");
  tctx.fillStyle = colors[0];
  tctx.fillRect(0, 0, t * 2, t * 2);
  tctx.fillStyle = colors[1] || colors[0];
  tctx.fillRect(t, 0, t, t);
  tctx.fillRect(0, t, t, t);
  const pattern = ctx.createPattern(tileCanvas, "repeat");
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = pattern || colors[0];
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/**
 * Paint any resolved liner visual (image / css gradient / solid color) into a rect.
 */
function paintLiner(ctx, visual, image, x, y, w, h) {
  if (!visual) return;
  if (visual.kind === "image" && image) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    drawImageCover(ctx, image, x, y, w, h);
    ctx.restore();
    return;
  }
  if (visual.kind === "solid") {
    ctx.fillStyle = visual.color || "#F4EFE4";
    ctx.fillRect(x, y, w, h);
    return;
  }
  const css = visual.css || DEFAULT_LINER_CSS;

  // Layered backgrounds: "gradientA, gradientB" — the FIRST layer paints on top,
  // so render the layers in reverse order.
  const layers = splitTopLevel(css);
  if (layers.length > 1) {
    for (let i = layers.length - 1; i >= 0; i--) {
      paintSingleGradient(ctx, layers[i], x, y, w, h);
    }
    return;
  }
  paintSingleGradient(ctx, css, x, y, w, h);
}

function paintSingleGradient(ctx, css, x, y, w, h) {
  const trimmed = String(css || "").trim();

  let m = trimmed.match(/repeating-linear-gradient\(\s*([^,]+),([\s\S]*)\)/i);
  if (m) {
    const angle = parseAngleToken(m[1], 180);
    const stops = parseGradientStops(m[2]);
    if (stops.length >= 2) {
      fillStripes(ctx, x, y, w, h, angle, stops);
      return;
    }
  }

  m = trimmed.match(/(?:repeating-)?conic-gradient\(([^)]*(?:\([^)]*\)[^)]*)*)\)/i);
  if (m) {
    const colors = extractCssColors(trimmed);
    const tileMatch = trimmed.match(/\/\s*([\d.]+)px\s+([\d.]+)px/i);
    if (colors.length >= 2) {
      fillChecker(ctx, x, y, w, h, colors.slice(0, 2), tileMatch ? parseFloat(tileMatch[1]) : 16);
      return;
    }
  }

  m = trimmed.match(/radial-gradient\(([^)]*(?:\([^)]*\)[^)]*)*)\)/i);
  if (m) {
    const stops = parseGradientStops(m[1]);
    if (stops.length) {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.max(w, h) / 2;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      addCanvasStops(grad, stops, r);
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);
      return;
    }
  }

  m = trimmed.match(/linear-gradient\(\s*([^,]+),([\s\S]*)\)/i);
  if (m) {
    const angle = parseAngleToken(m[1], 180);
    const stops = parseGradientStops(m[2]);
    if (stops.length) {
      const line = gradientLineRect(x, y, w, h, angle);
      const grad = ctx.createLinearGradient(line.x0, line.y0, line.x1, line.y1);
      addCanvasStops(grad, stops, line.len);
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);
      return;
    }
  }

  const colors = extractCssColors(trimmed);
  ctx.fillStyle = colors[0] || "#F4EFE4";
  ctx.fillRect(x, y, w, h);
}

function drawImageCover(ctx, img, x, y, w, h) {
  const iw = img.width || img.naturalWidth;
  const ih = img.height || img.naturalHeight;
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

// ─────────────────────────────────────────────────────────────────────────────
// Design + liner resolution
// ─────────────────────────────────────────────────────────────────────────────
function safeJsonParse(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

/**
 * Resolve the envelope design from the invitation / event payload.
 * Mirrors what the designer saves (designState.envelope) plus template fallbacks.
 */
function resolveEnvelopeDesign(invitation = {}, event = {}, accentColor = null) {
  const inv = invitation || {};
  const evt = event || {};
  const canvasState = safeJsonParse(inv.canvasState) || safeJsonParse(evt.canvasState) || {};
  const raw =
    (inv.envelope && typeof inv.envelope === "object" ? inv.envelope : null) ||
    (inv.designData && inv.designData.envelope) ||
    (inv.designData && inv.designData.canvasState && inv.designData.canvasState.envelope) ||
    (inv.designData && inv.designData.canvas && inv.designData.canvas.envelope) ||
    (canvasState && canvasState.envelope) ||
    (evt.envelope && typeof evt.envelope === "object" ? evt.envelope : null) ||
    {};

  const accent = accentColor || inv.accentColor || evt.accentColor || "#5B5FEF";

  const linerRaw =
    raw.innerLiner ||
    raw.linerPatternUrl ||
    raw.linerColor ||
    raw.liner ||
    "";

  const outerColor =
    raw.color ||
    raw.outerColor ||
    mixHex(accent, "#111827", 0.42);

  const linerBaseColor = /^#|^rgba?\(/i.test(String(raw.linerColor || ""))
    ? raw.linerColor
    : null;

  return {
    outerColor,
    flapColor: raw.flapColor || raw.color || outerColor,
    linerCss: typeof raw.linerCss === "string" ? raw.linerCss.trim() : "",
    linerRaw: typeof linerRaw === "string" ? linerRaw.trim() : "",
    linerColor: linerBaseColor,
    shadowColor: raw.shadowColor || "rgba(0,0,0,0.28)",
    stamp: raw.stamp || null,
    sticker: raw.sticker || null,
    accent,
  };
}

function contentTypeForExt(ext) {
  const e = (ext || "").toLowerCase();
  if (e === ".svg") return "image/svg+xml";
  if (e === ".png") return "image/png";
  if (e === ".jpg" || e === ".jpeg") return "image/jpeg";
  if (e === ".webp") return "image/webp";
  if (e === ".gif") return "image/gif";
  return "application/octet-stream";
}

function findLinerAssetFile(ref) {
  if (!ref || /^https?:/i.test(ref)) return null;
  const rel = String(ref).replace(/^\/+/, "");
  const candidates = [
    path.resolve(__dirname, "../../public", rel),
    path.resolve(__dirname, "../../../public", rel),
    path.resolve(__dirname, "../../../invitehub/public", rel),
  ];
  const base = path.basename(rel);
  for (const dir of ENVELOPE_ASSET_DIRS) {
    candidates.push(path.join(dir, base));
  }
  for (const cand of candidates) {
    try {
      if (cand && fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
    } catch (_) {}
  }
  return null;
}

/**
 * Resolve the liner visual for email rendering.
 * @returns {{kind:"image"|"css"|"solid", buffer?:Buffer, contentType?:string,
 *            absoluteUrl?:string, css?:string, colors?:string[], color?:string}}
 */
function resolveLinerVisual(design = {}, baseUrl = "") {
  const origin = String(baseUrl || process.env.FRONTEND_URL || "").replace(/\/+$/, "");
  let css = (design.linerCss || "").trim();
  const rawKey = (design.linerRaw || "").trim();

  if (!css && rawKey) {
    if (LINER_CSS_MAP[rawKey]) css = LINER_CSS_MAP[rawKey];
    else if (rawKey.includes("gradient(")) css = rawKey;
    else if (/\.(png|jpe?g|svg|webp)($|\?)/i.test(rawKey)) css = `url('${rawKey}') center / cover no-repeat`;
    else if (/^#|^rgba?\(/i.test(rawKey)) return { kind: "solid", color: rawKey };
  }
  if (!css && design.linerColor) {
    return { kind: "solid", color: design.linerColor };
  }
  if (!css) css = DEFAULT_LINER_CSS;

  const urlMatch = css.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/i);
  if (urlMatch) {
    const ref = urlMatch[1].trim();
    const filePath = findLinerAssetFile(ref);
    if (filePath) {
      try {
        const buffer = fs.readFileSync(filePath);
        let absoluteUrl;
        if (/^https?:/i.test(ref)) absoluteUrl = ref;
        else absoluteUrl = `${origin}${ref.startsWith("/") ? "" : "/"}${ref}`;
        return {
          kind: "image",
          buffer,
          contentType: contentTypeForExt(path.extname(filePath)),
          absoluteUrl,
          fileName: path.basename(filePath),
        };
      } catch (_) {}
    }
    if (/^https?:/i.test(ref)) {
      return { kind: "image", buffer: null, absoluteUrl: ref, fileName: path.basename(ref) };
    }
    // Local asset could not be read — fall through to color extraction
    const colors = extractCssColors(css);
    if (colors.length) return { kind: "css", css: DEFAULT_LINER_CSS, colors: extractCssColors(DEFAULT_LINER_CSS) };
    return { kind: "solid", color: design.linerColor || "#F4EFE4" };
  }

  if (/gradient\(/.test(css)) {
    return { kind: "css", css, colors: extractCssColors(css) };
  }
  if (/^#|^rgba?\(|^[a-z]+$/i.test(css)) {
    return { kind: "solid", color: css };
  }
  return { kind: "css", css: DEFAULT_LINER_CSS, colors: extractCssColors(DEFAULT_LINER_CSS) };
}

async function loadLinerImage(visual) {
  if (!visual || visual.kind !== "image" || !visual.buffer || !visual.buffer.length) return null;
  try {
    return await loadImage(visual.buffer);
  } catch (err) {
    console.warn("[EnvelopeRenderer] Could not decode liner image:", err.message);
    return null;
  }
}

function linerBaseColor(design = {}, visual = null) {
  if (design && design.linerColor) return design.linerColor;
  if (visual && visual.kind === "solid" && visual.color) return visual.color;
  if (visual && Array.isArray(visual.colors) && visual.colors.length) return visual.colors[0];
  return "#F5EFE3";
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared drawing helpers
// ─────────────────────────────────────────────────────────────────────────────
function roundedRectPath(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function trianglePath(ctx, a, b, c) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.closePath();
}

function applyPaperLighting(ctx, x, y, w, h) {
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, "rgba(255,255,255,0.16)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.00)");
  grad.addColorStop(1, "rgba(0,0,0,0.16)");
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
}

function drawWaxSeal(ctx, cx, cy, radius, accent) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  const g = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.4, radius * 0.1, cx, cy, radius);
  g.addColorStop(0, lighten(accent, 0.42));
  g.addColorStop(0.55, accent);
  g.addColorStop(1, darken(accent, 0.3));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = Math.max(1.5, radius * 0.07);
  ctx.beginPath();
  ctx.arc(cx, cy, radius - radius * 0.22, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  const d = radius * 0.28;
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillRect(-d / 2, -d / 2, d, d);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Option B — composite envelope + card preview
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render the invitation card tucked inside its envelope as ONE high-resolution
 * PNG (flap + liner + card + V-cut pocket + wax seal) for cid:invitation_preview.
 *
 * @param {Object} params
 * @param {Buffer} params.cardBuffer - invitation card PNG/JPEG buffer
 * @param {Object} params.envelope - envelope design (resolveEnvelopeDesign output or raw)
 * @param {string} [params.accentColor]
 * @param {string} [params.backgroundColor]
 * @param {string} [params.baseUrl]
 * @returns {Promise<{buffer:Buffer,width:number,height:number}|null>}
 */
async function renderEnvelopePreviewPng({
  cardBuffer,
  envelope = {},
  accentColor = null,
  backgroundColor = "#FAF8F5",
  baseUrl = "",
} = {}) {
  if (!cardBuffer || !cardBuffer.length) return null;

  let cardImg;
  try {
    cardImg = await loadImage(cardBuffer);
  } catch (err) {
    console.warn("[EnvelopeRenderer] Could not decode card image:", err.message);
    return null;
  }

  const design =
    envelope && envelope.outerColor ? envelope : resolveEnvelopeDesign(envelope || {}, {}, accentColor);
  const accent = design.accent || accentColor || "#5B5FEF";
  const outer = design.outerColor || "#2F3A4A";
  const flapColor = design.flapColor || outer;
  const visual = resolveLinerVisual(design, baseUrl);
  const linerImg = await loadLinerImage(visual);

  const W = 1000;
  const PAD = 64;
  const envL = PAD;
  const envR = W - PAD;
  const envW = envR - envL;
  const flapApexY = 16;
  const bodyTop = 262;
  const bodyR = 22;

  const cardW = 648;
  const cardX = (W - cardW) / 2;
  const cardAspect = (cardImg.height || 1120) / (cardImg.width || 800);
  const cardH = Math.round(cardW * cardAspect);
  const cardTop = bodyTop + 60;
  const tuck = clamp(Math.round(cardH * 0.15), 70, 170);
  const vDepth = 104;
  const pocketH = 318;
  const pocketTop = cardTop + cardH - tuck;
  const bodyBottom = pocketTop + pocketH;
  const H = bodyBottom + 72;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // ── 1. Backdrop ──
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, mixHex(backgroundColor || "#FAF8F5", "#FFFFFF", 0.6));
  bg.addColorStop(0.5, mixHex(backgroundColor || "#FAF8F5", "#FFFFFF", 0.22));
  bg.addColorStop(1, mixHex(backgroundColor || "#FAF8F5", "#D8DEE8", 0.4));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── 2. Envelope silhouette (flap + body) with drop shadow ──
  ctx.save();
  ctx.shadowColor = design.shadowColor || "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 42;
  ctx.shadowOffsetY = 24;
  ctx.shadowOffsetX = 0;
  ctx.fillStyle = outer;
  trianglePath(
    ctx,
    { x: envL, y: bodyTop },
    { x: W / 2, y: flapApexY },
    { x: envR, y: bodyTop }
  );
  ctx.fill();
  roundedRectPath(ctx, envL, bodyTop, envW, bodyBottom - bodyTop, bodyR);
  ctx.fill();
  ctx.restore();

  // ── 3. Open flap (paper + inset liner) ──
  ctx.save();
  trianglePath(
    ctx,
    { x: envL, y: bodyTop },
    { x: W / 2, y: flapApexY },
    { x: envR, y: bodyTop }
  );
  ctx.fillStyle = flapColor;
  ctx.fill();

  // Inset liner inside flap
  const inset = 18;
  const linerFlap = {
    a: { x: envL + inset * 1.6, y: bodyTop - inset * 0.4 },
    b: { x: W / 2, y: flapApexY + inset * 1.7 },
    c: { x: envR - inset * 1.6, y: bodyTop - inset * 0.4 },
  };
  ctx.save();
  trianglePath(ctx, linerFlap.a, linerFlap.b, linerFlap.c);
  ctx.clip();
  paintLiner(ctx, visual, linerImg, envL, flapApexY, envW, bodyTop - flapApexY);
  applyPaperLighting(ctx, envL, flapApexY, envW, bodyTop - flapApexY);
  ctx.restore();
  ctx.restore();

  // ── 4. Envelope interior (liner behind the card) ──
  const innerX = envL + 14;
  const innerY = bodyTop + 8;
  const innerW = envW - 28;
  const innerH = bodyBottom - 24 - innerY;
  ctx.save();
  roundedRectPath(ctx, innerX, innerY, innerW, innerH, bodyR - 8);
  ctx.clip();
  paintLiner(ctx, visual, linerImg, innerX, innerY, innerW, innerH);
  // Flap crease shadow just under the top edge
  const crease = ctx.createLinearGradient(0, innerY, 0, innerY + 30);
  crease.addColorStop(0, "rgba(0,0,0,0.34)");
  crease.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = crease;
  ctx.fillRect(innerX, innerY, innerW, 30);
  ctx.restore();

  // ── 5. Invitation card ──
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.32)";
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 16;
  ctx.shadowOffsetX = 0;
  ctx.fillStyle = "#ffffff";
  roundedRectPath(ctx, cardX, cardTop, cardW, cardH, 18);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundedRectPath(ctx, cardX, cardTop, cardW, cardH, 18);
  ctx.clip();
  drawImageCover(ctx, cardImg, cardX, cardTop, cardW, cardH);
  ctx.restore();

  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 1.5;
  roundedRectPath(ctx, cardX, cardTop, cardW, cardH, 18);
  ctx.stroke();

  // ── 6. Shadow cast by the pocket onto the card / liner ──
  ctx.save();
  roundedRectPath(ctx, innerX, innerY, innerW, innerH, bodyR - 8);
  ctx.clip();
  const pocketShadow = ctx.createLinearGradient(0, pocketTop - 76, 0, pocketTop + 14);
  pocketShadow.addColorStop(0, "rgba(0,0,0,0)");
  pocketShadow.addColorStop(1, "rgba(0,0,0,0.34)");
  ctx.fillStyle = pocketShadow;
  ctx.fillRect(innerX, pocketTop - 76, innerW, 90);
  ctx.restore();

  // ── 7. Front pocket (V-cut) ──
  const pocketPath = () => {
    ctx.beginPath();
    ctx.moveTo(envL, pocketTop);
    ctx.lineTo(W / 2, pocketTop + vDepth);
    ctx.lineTo(envR, pocketTop);
    ctx.lineTo(envR, bodyBottom - bodyR);
    ctx.quadraticCurveTo(envR, bodyBottom, envR - bodyR, bodyBottom);
    ctx.lineTo(envL + bodyR, bodyBottom);
    ctx.quadraticCurveTo(envL, bodyBottom, envL, bodyBottom - bodyR);
    ctx.closePath();
  };

  // Edge separation above the pocket rim
  pocketPath();
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.lineWidth = 9;
  ctx.stroke();

  pocketPath();
  const pocketGrad = ctx.createLinearGradient(0, pocketTop, 0, bodyBottom);
  pocketGrad.addColorStop(0, lighten(outer, 0.14));
  pocketGrad.addColorStop(0.45, outer);
  pocketGrad.addColorStop(1, darken(outer, 0.2));
  ctx.fillStyle = pocketGrad;
  ctx.fill();

  // Fold creases from the lower corners (side flaps)
  ctx.save();
  pocketPath();
  ctx.clip();
  const creaseLen = 300;
  const leftCrease = ctx.createLinearGradient(envL, bodyBottom, envL + creaseLen, bodyBottom - creaseLen * 0.75);
  leftCrease.addColorStop(0, "rgba(0,0,0,0.16)");
  leftCrease.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = leftCrease;
  ctx.fillRect(envL, bodyBottom - creaseLen, creaseLen, creaseLen);
  const rightCrease = ctx.createLinearGradient(envR, bodyBottom, envR - creaseLen, bodyBottom - creaseLen * 0.75);
  rightCrease.addColorStop(0, "rgba(0,0,0,0.16)");
  rightCrease.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rightCrease;
  ctx.fillRect(envR - creaseLen, bodyBottom - creaseLen, creaseLen, creaseLen);
  // Ambient lighting
  const ambient = ctx.createLinearGradient(envL, pocketTop, envR, bodyBottom);
  ambient.addColorStop(0, "rgba(255,255,255,0.10)");
  ambient.addColorStop(0.4, "rgba(255,255,255,0)");
  ambient.addColorStop(1, "rgba(0,0,0,0.16)");
  ctx.fillStyle = ambient;
  ctx.fillRect(envL, pocketTop, envW, bodyBottom - pocketTop);
  ctx.restore();

  // Rim highlight along the V edge
  ctx.beginPath();
  ctx.moveTo(envL + 2, pocketTop + 2);
  ctx.lineTo(W / 2, pocketTop + vDepth + 2);
  ctx.lineTo(envR - 2, pocketTop + 2);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // ── 8. Wax seal accent ──
  const sealY = pocketTop + vDepth + (bodyBottom - pocketTop - vDepth) * 0.46;
  drawWaxSeal(ctx, W / 2, sealY, 46, accent);

  // ── 9. Crisp outer edge ──
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 2;
  trianglePath(
    ctx,
    { x: envL, y: bodyTop },
    { x: W / 2, y: flapApexY },
    { x: envR, y: bodyTop }
  );
  ctx.stroke();
  roundedRectPath(ctx, envL, bodyTop, envW, bodyBottom - bodyTop, bodyR);
  ctx.stroke();
  ctx.restore();

  return { buffer: canvas.toBuffer("image/png"), width: W, height: H };
}

// ─────────────────────────────────────────────────────────────────────────────
// Option A — envelope pieces for table-based HTML layout
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Flap + liner band rendered as a single PNG (cid:envelope_flap).
 * Transparent-free: the base color matches the envelope outer color so it
 * blends seamlessly with the wrapper table cell background.
 */
function renderEnvelopeFlapBandPng({
  envelope = {},
  visual = null,
  linerImage = null,
  width = 1200,
  height = 340,
} = {}) {
  const design = envelope && envelope.outerColor ? envelope : {};
  const outer = design.outerColor || "#2F3A4A";
  const flapColor = design.flapColor || outer;
  const liner = visual || resolveLinerVisual(design, "");

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, lighten(outer, 0.1));
  base.addColorStop(1, outer);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // Outer flap paper triangle
  trianglePath(
    ctx,
    { x: 0, y: height },
    { x: width / 2, y: 10 },
    { x: width, y: height }
  );
  ctx.fillStyle = flapColor;
  ctx.fill();

  // Inset liner triangle (base stays flush with the band bottom edge)
  const apex = { x: width / 2, y: 42 };
  const left = { x: 26, y: height };
  const right = { x: width - 26, y: height };
  ctx.save();
  trianglePath(ctx, apex, left, right);
  ctx.clip();
  paintLiner(ctx, liner, linerImage, 0, 10, width, height - 10);
  applyPaperLighting(ctx, 0, 10, width, height - 10);
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(apex.x, apex.y);
  ctx.lineTo(left.x, left.y);
  ctx.moveTo(apex.x, apex.y);
  ctx.lineTo(right.x, right.y);
  ctx.strokeStyle = "rgba(0,0,0,0.14)";
  ctx.lineWidth = 4;
  ctx.stroke();

  return canvas.toBuffer("image/png");
}

/**
 * Front pocket band with rim highlight, fold creases and wax seal
 * (cid:envelope_pocket) for the table-based HTML layout.
 */
function renderEnvelopePocketBandPng({
  envelope = {},
  accentColor = "#5B5FEF",
  width = 1200,
  height = 300,
} = {}) {
  const design = envelope && envelope.outerColor ? envelope : {};
  const outer = design.outerColor || "#2F3A4A";
  const accent = (design && design.accent) || accentColor || "#5B5FEF";

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, lighten(outer, 0.14));
  grad.addColorStop(0.4, outer);
  grad.addColorStop(1, darken(outer, 0.18));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Crease shadow immediately under the top rim (reads as pocket overlap)
  const rimShadow = ctx.createLinearGradient(0, 0, 0, 26);
  rimShadow.addColorStop(0, "rgba(0,0,0,0.3)");
  rimShadow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rimShadow;
  ctx.fillRect(0, 0, width, 26);

  // Rim highlight
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.fillRect(0, 24, width, 3);

  // Diagonal fold creases from the lower corners
  const creaseLen = Math.min(width * 0.32, 380);
  const leftCrease = ctx.createLinearGradient(0, height, creaseLen, height - creaseLen * 0.7);
  leftCrease.addColorStop(0, "rgba(0,0,0,0.18)");
  leftCrease.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = leftCrease;
  ctx.fillRect(0, height - creaseLen, creaseLen, creaseLen);
  const rightCrease = ctx.createLinearGradient(width, height, width - creaseLen, height - creaseLen * 0.7);
  rightCrease.addColorStop(0, "rgba(0,0,0,0.18)");
  rightCrease.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rightCrease;
  ctx.fillRect(width - creaseLen, height - creaseLen, creaseLen, creaseLen);

  // Ambient lighting
  const ambient = ctx.createLinearGradient(0, 0, width, height);
  ambient.addColorStop(0, "rgba(255,255,255,0.10)");
  ambient.addColorStop(0.45, "rgba(255,255,255,0)");
  ambient.addColorStop(1, "rgba(0,0,0,0.16)");
  ctx.fillStyle = ambient;
  ctx.fillRect(0, 0, width, height);

  // Wax seal centered on the pocket
  drawWaxSeal(ctx, width / 2, height * 0.56, Math.min(64, height * 0.24), accent);

  return canvas.toBuffer("image/png");
}

module.exports = {
  resolveEnvelopeDesign,
  resolveLinerVisual,
  linerBaseColor,
  loadLinerImage,
  renderEnvelopePreviewPng,
  renderEnvelopeFlapBandPng,
  renderEnvelopePocketBandPng,
  LINER_CSS_MAP,
};
