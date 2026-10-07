/**
 * Database Sanity Check & Template URL Sanitization Script
 *
 * Scans the database for templates holding broken local paths (/uploads/...)
 * or ephemeral serverless URLs (e.g., template_artwork_*.png) that throw 404s in production.
 *
 * Usage:
 *   node scripts/sanitize_templates.js          # Dry run: inspect and report broken templates
 *   node scripts/sanitize_templates.js --fix    # Repair: replace broken URLs with permanent assets
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const prisma = require("../src/config/prisma");

// Default high-quality fallback artworks mapped by category
const CATEGORY_FALLBACK_ARTWORKS = {
  Wedding: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80",
  Birthday: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1200&q=80",
  "Adult Birthday": "https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=1200&q=80",
  Corporate: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80",
  "Bridal Shower": "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=1200&q=80",
  Holiday: "https://images.unsplash.com/photo-1543257580-7269da773bf5?auto=format&fit=crop&w=1200&q=80",
  Workshop: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1200&q=80",
  "Charity Gala": "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80",
  "Dinner Party": "https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1200&q=80",
  "Baby Shower": "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=1200&q=80",
  General: "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&w=1200&q=80",
};

const isBrokenUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return false;

  // Local uploads paths or raw template_artwork filenames that 404 in serverless
  if (
    trimmed.includes("/uploads/") ||
    trimmed.startsWith("uploads/") ||
    /template_artwork_.*\.png/i.test(trimmed) ||
    trimmed.includes("localhost") ||
    trimmed.includes("127.0.0.1") ||
    trimmed.includes("eventizersbackend.vercel.app/uploads/")
  ) {
    return true;
  }
  return false;
};

const getReplacementArtwork = (template) => {
  const category = template.category || "General";
  return CATEGORY_FALLBACK_ARTWORKS[category] || CATEGORY_FALLBACK_ARTWORKS.General;
};

async function main() {
  const isFixMode = process.argv.includes("--fix");

  console.log("==================================================================");
  console.log("       INVITEHUB TEMPLATE URL SANITY CHECK & MIGRATION TOOL       ");
  console.log("==================================================================");
  console.log(`Mode: ${isFixMode ? "FIX (Repair broken URLs)" : "INSPECT (Dry Run)"}`);
  console.log("");

  try {
    const templates = await prisma.template.findMany({
      orderBy: { createdAt: "desc" },
    });

    console.log(`Found ${templates.length} total templates in database.`);
    console.log("Scanning for broken local / ephemeral upload paths...\n");

    const brokenTemplates = [];

    for (const tpl of templates) {
      let content = {};
      try {
        content = typeof tpl.content === "string" ? JSON.parse(tpl.content) : (tpl.content || {});
      } catch (e) {
        console.warn(`[Template ${tpl.id}] Could not parse content JSON:`, e.message);
        continue;
      }

      const candidateUrls = [
        { field: "imageUrl", val: content.imageUrl },
        { field: "thumbnailUrl", val: content.thumbnailUrl },
        { field: "backgroundImage", val: content.backgroundImage },
        { field: "backgroundUrl", val: content.backgroundUrl },
        { field: "card.artworkUrl", val: content.card?.artworkUrl },
        { field: "canvasData.backgroundImage", val: content.canvasData?.backgroundImage },
      ];

      const brokenFields = candidateUrls.filter((c) => isBrokenUrl(c.val));

      if (brokenFields.length > 0) {
        brokenTemplates.push({
          id: tpl.id,
          name: tpl.name,
          category: tpl.category,
          brokenFields,
          content,
        });
      }
    }

    if (brokenTemplates.length === 0) {
      console.log("✅ Zero broken template paths found! All templates have valid permanent URLs.");
      return;
    }

    console.log(`⚠️  Found ${brokenTemplates.length} templates holding broken / ephemeral local paths:`);
    console.log("------------------------------------------------------------------");

    brokenTemplates.forEach((item, idx) => {
      console.log(`[${idx + 1}] ID: ${item.id} | Name: "${item.name}" | Category: ${item.category}`);
      item.brokenFields.forEach((b) => {
        console.log(`    ❌ ${b.field}: ${b.val}`);
      });
      const suggested = getReplacementArtwork(item);
      console.log(`    💡 Suggested replacement: ${suggested}\n`);
    });

    if (!isFixMode) {
      console.log("------------------------------------------------------------------");
      console.log("To automatically repair these broken templates, run:");
      console.log("  node scripts/sanitize_templates.js --fix");
      console.log("------------------------------------------------------------------");
      return;
    }

    console.log("\nApplying repairs to database records...");
    let repairedCount = 0;

    for (const item of brokenTemplates) {
      const replacementUrl = getReplacementArtwork(item);
      const updatedContent = { ...item.content };

      updatedContent.imageUrl = replacementUrl;
      updatedContent.thumbnailUrl = replacementUrl;
      updatedContent.backgroundImage = replacementUrl;
      updatedContent.backgroundUrl = replacementUrl;

      if (updatedContent.card) {
        updatedContent.card = {
          ...updatedContent.card,
          artworkUrl: replacementUrl,
          fullArtworkUrl: replacementUrl,
        };
      }

      if (updatedContent.canvasData) {
        updatedContent.canvasData = {
          ...updatedContent.canvasData,
          backgroundImage: replacementUrl,
        };
      }

      await prisma.template.update({
        where: { id: item.id },
        data: {
          content: JSON.stringify(updatedContent),
        },
      });

      repairedCount += 1;
      console.log(`  ✅ Repaired template [${item.id}] "${item.name}" -> ${replacementUrl}`);
    }

    console.log(`\n🎉 Successfully repaired ${repairedCount} templates in database!`);
  } catch (err) {
    console.error("Error running template sanitization:", err.message);
  } finally {
    if (prisma && typeof prisma.$disconnect === "function") {
      await prisma.$disconnect();
    }
  }
}

main();
