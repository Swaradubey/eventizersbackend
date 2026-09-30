// Re-export the canonical 12-template gallery config.
// All existing requires (templates.routes.js, seed_templates.js, event.controller.js)
// continue to work without any changes.
const { newTemplatesDataBackend } = require('./newTemplatesDataBackend');

const newTemplateStylesBackend = {};
for (const t of newTemplatesDataBackend) {
  let c = {};
  try { c = typeof t.content === 'string' ? JSON.parse(t.content) : (t.content || {}); } catch(_) {}
  newTemplateStylesBackend[t.id] = {
    fontFamily: (c.defaultTextLayers && c.defaultTextLayers[0]?.fontFamily) || "Inter",
    background: c.backdrop?.gradient || c.backdrop?.color || "#ffffff",
    cardBackground: c.card?.backgroundColor || "#ffffff",
    buttonColor: c.envelope?.linerColor || "#D4AF37",
    buttonRadius: 10,
    textAlignment: "center"
  };
}

module.exports = { newTemplatesDataBackend, newTemplateStylesBackend };