-- ============================================================================
-- INVITEHUB TEMPLATE URL SANITY CHECK & MIGRATION SQL
-- ============================================================================

-- 1. IDENTIFY ALL TEMPLATES HOLDING BROKEN LOCAL / EPHEMERAL PATHS
-- Searches for /uploads/, template_artwork_*, localhost, or vercel ephemeral paths
SELECT 
    id, 
    name, 
    category,
    "isPremium",
    "createdAt"
FROM templates
WHERE 
    content LIKE '%/uploads/%'
    OR content LIKE '%template_artwork_%'
    OR content LIKE '%localhost%'
    OR content LIKE '%127.0.0.1%'
    OR content LIKE '%eventizersbackend.vercel.app/uploads/%';

-- 2. INSPECT THE EXACT BROKEN URLS STORED IN CONTENT JSON
SELECT 
    id,
    name,
    category,
    content::json->>'imageUrl' as image_url,
    content::json->>'backgroundImage' as background_image,
    content::json->'card'->>'artworkUrl' as card_artwork_url
FROM templates
WHERE 
    content LIKE '%/uploads/%'
    OR content LIKE '%template_artwork_%';

-- 3. BATCH REPAIR: REPLACE BROKEN /uploads/ WITH VALID PERMANENT CDN ARTWORK
-- Example replacement with high-resolution permanent Unsplash artwork for Halloween/Party templates:
-- UPDATE templates
-- SET content = replace(
--     replace(content, 'https://eventizersbackend.vercel.app/uploads/', 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=1200&q=80#'),
--     '/uploads/',
--     'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=1200&q=80#'
-- )
-- WHERE content LIKE '%/uploads/%' OR content LIKE '%template_artwork_%';

-- 4. VERIFY REPAIRS
SELECT 
    COUNT(*) as remaining_broken_templates
FROM templates
WHERE 
    content LIKE '%/uploads/%'
    OR content LIKE '%template_artwork_%';
