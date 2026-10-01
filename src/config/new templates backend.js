/**
 * Canonical Backend Templates Configuration
 * Exactly 16 Templates:
 *  1. botanical-sketch-art (Botanical Sketch (Art))
 *  2. tpl-chic-dinner-cake (Chic Dinner & Cake Celebration)
 *  3. tpl-modern-gold-black-balloon (Modern Gold & Black Balloon Bash)
 *  4. tpl-gold-ribbons-confetti (Gold Ribbons & Confetti)
 *  5. tpl-sparkle-balloons (Sparkle Balloons)
 *  6. tpl-celestial-flora (Celestial Flora)
 *  7. tpl-abstract-nature-party (Abstract Nature Party)
 *  8. tpl-bright-blooms-garden (Bright Blooms Garden)
 *  9. tpl-vibrant-blooms-wedding (Vibrant Blooms Wedding)
 * 10. tpl-lily-of-the-valley (Lily of the Valley)
 * 11. blush-burgundy-blooms (Blush & Burgundy Blooms)
 * 12. something-blue (Something Blue)
 * 13. autumn-blooms (Autumn Blooms)
 * 14. o-tannenbaum (O Tannenbaum)
 * 15. metallic-paint-splatter (Metallic Paint Splatter)
 * 16. golden-foliage-holiday (Golden Foliage Holiday)
 */

const newTemplatesDataBackend = [
  // -------------------------------------------------------------
  // 1. BOTANICAL SKETCH (ART)
  // -------------------------------------------------------------
  {
    id: "botanical-sketch-art",
    title: "Botanical Sketch (Art)",
    name: "Botanical Sketch (Art)",
    category: "Workshop",
    isPremium: true,
    badge: "Premium",
    thumbnailUrl: "/assets/templates/botanical-sketch-art-mockup.svg",
    imageUrl: "/assets/templates/botanical-sketch-art-mockup.svg",
    mockupUrl: "/assets/templates/botanical-sketch-art-mockup.svg",
    backdrop: {
      type: "texture",
      value: "/assets/backdrops/terrazzo.svg",
      color: "#FAF8F5",
      gradient: "linear-gradient(135deg, #FAF8F5 0%, #EDE9E1 100%)"
    },
    envelope: {
      outerColor: "#CFC4B5",
      flapColor: "#DDD2C3",
      linerColor: "#ECE4D8",
      linerCss: "linear-gradient(135deg, #DDD2C3 0%, #CFC4B5 100%)",
      isOpen: true,
      isOpenUpward: true,
      shadowColor: "rgba(0,0,0,0.28)"
    },
    card: {
      backgroundColor: "#A3B899",
      artworkUrl: "/assets/templates/botanical-sketch-art-bg.svg",
      decorativeBorderSvgUrl: "/assets/templates/botanical-sketch-art-bg.svg",
      aspectRatio: "5x7",
      border: "1px solid rgba(0,0,0,0.06)",
      cssConfig: {
        backgroundColor: "#A3B899",
        paperShadow: "0 14px 30px -6px rgba(0, 0, 0, 0.28)",
        borderRadius: "14px"
      }
    },
    elements: [
      {
        id: "photo-botanical-sketch",
        type: "image",
        key: "photo",
        src: "/assets/templates/botanical-sketch-painting.jpg",
        alt: "Botanical painting/sketching in progress",
        frame: {
          borderWidth: 6,
          borderColor: "#FFFFFF",
          borderRadius: 2,
          boxShadow: "0 4px 10px rgba(0,0,0,0.22)"
        },
        position: { top: "18%", left: "14%", width: "72%", height: "42%" },
        coordinates: { x: 50, y: 39, width: 72, height: 42 }
      },
      {
        id: "text-title-elegant-serif",
        type: "text",
        key: "title",
        text: "Botanical Illustration Workshop",
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: 20,
        fontWeight: "600",
        letterSpacing: 0.5,
        color: "#1C2D1A",
        textAlign: "center",
        lineHeight: 1.25,
        position: { top: "66%", left: "10%", width: "80%" },
        coordinates: { x: 50, y: 72 }
      },
      {
        id: "text-subtext-schedule",
        type: "text",
        key: "datetime",
        text: "Artisans June 21 at 12 PM",
        fontFamily: "'Inter', sans-serif",
        fontSize: 12,
        fontWeight: "500",
        letterSpacing: 0.4,
        color: "#30442D",
        textAlign: "center",
        position: { top: "84%", left: "10%", width: "80%" },
        coordinates: { x: 50, y: 86 }
      }
    ],
    defaultTextLayers: [
      {
        id: "layer-title",
        key: "title",
        text: "Botanical Illustration Workshop",
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: 20,
        color: "#1C2D1A",
        fontWeight: "600",
        textAlign: "center",
        top: 72,
        left: 50
      },
      {
        id: "layer-datetime",
        key: "datetime",
        text: "Artisans June 21 at 12 PM",
        fontFamily: "'Inter', sans-serif",
        fontSize: 12,
        color: "#30442D",
        fontWeight: "500",
        textAlign: "center",
        top: 86,
        left: 50
      }
    ],
    content: JSON.stringify({
      badge: "Premium",
      thumbnailUrl: "/assets/templates/botanical-sketch-art-mockup.svg",
      imageUrl: "/assets/templates/botanical-sketch-art-mockup.svg",
      backdrop: {
        type: "texture",
        value: "/assets/backdrops/terrazzo.svg",
        color: "#FAF8F5",
        gradient: "linear-gradient(135deg, #FAF8F5 0%, #EDE9E1 100%)"
      },
      envelope: {
        outerColor: "#CFC4B5",
        flapColor: "#DDD2C3",
        linerColor: "#ECE4D8",
        linerCss: "linear-gradient(135deg, #DDD2C3 0%, #CFC4B5 100%)",
        isOpen: true,
        isOpenUpward: true
      },
      card: {
        backgroundColor: "#A3B899",
        artworkUrl: "/assets/templates/botanical-sketch-bg.svg",
        aspectRatio: "5x7"
      },
      defaultTextLayers: [
        { id: "layer-title", key: "title", text: "Botanical Illustration Workshop", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 20, color: "#1C2D1A", fontWeight: "600", textAlign: "center", top: 72, left: 50 },
        { id: "layer-datetime", key: "datetime", text: "Artisans June 21 at 12 PM", fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#30442D", fontWeight: "500", textAlign: "center", top: 86, left: 50 }
      ]
    })
  },

  // -------------------------------------------------------------
  // 2. CHIC DINNER & CAKE CELEBRATION
  // -------------------------------------------------------------
  {
    id: "tpl-chic-dinner-cake",
    name: "Chic Dinner & Cake Celebration",
    title: "Chic Dinner & Cake Celebration",
    category: "Adult Birthday",
    isPremium: true,
    content: JSON.stringify({
      badge: "Premium",
      thumbnailUrl: "/assets/templates/chic-dinner-cake-mockup.svg",
      imageUrl: "/assets/templates/chic-dinner-cake-mockup.svg",
      backdrop: {
        type: "texture",
        value: "/assets/backdrops/white-embossed-floral.svg",
        color: "#FAF7F2",
        gradient: "linear-gradient(135deg, #FAF7F2 0%, #EDE6D8 100%)"
      },
      envelope: {
        outerColor: "#111111",
        flapColor: "#111111",
        linerCss: "linear-gradient(135deg, #D4AF37 0%, #FFF2A1 25%, #AA771C 50%, #FDF4B8 75%, #B8860B 100%)",
        linerColor: "#D4AF37",
        isOpen: true,
        isOpenUpward: true
      },
      card: {
        artworkUrl: "/assets/templates/chic-dinner-cake-bg.svg",
        backgroundColor: "#F4EFE6",
        aspectRatio: "5x7"
      },
      defaultTextLayers: [
        { id: "layer-header", key: "header", text: "Let's celebrate", fontFamily: "'Great Vibes', cursive", fontSize: 24, color: "#1A1A1A", fontWeight: "400", textAlign: "center", top: 18, left: 50 },
        { id: "layer-title", key: "title", text: "LAURA'S 30TH BIRTHDAY", fontFamily: "'Cinzel', serif", fontSize: 22, letterSpacing: 2, color: "#1A1A1A", fontWeight: "700", textAlign: "center", top: 28, left: 50 },
        { id: "layer-details", key: "details", text: "AUGUST 31ST AT 7 PM\nOUR PLACE", fontFamily: "'Inter', sans-serif", fontSize: 12, letterSpacing: 1.5, lineHeight: 1.6, color: "#1A1A1A", fontWeight: "500", textAlign: "center", top: 38, left: 50 }
      ]
    })
  },

  // -------------------------------------------------------------
  // 3. MODERN GOLD & BLACK BALLOON BASH
  // -------------------------------------------------------------
  {
    id: "tpl-modern-gold-black-balloon",
    name: "Modern Gold & Black Balloon Bash",
    title: "Modern Gold & Black Balloon Bash",
    category: "Adult Birthday",
    isPremium: true,
    content: JSON.stringify({
      badge: "Premium",
      thumbnailUrl: "/assets/templates/modern-gold-black-balloon-mockup.svg",
      imageUrl: "/assets/templates/modern-gold-black-balloon-mockup.svg",
      backdrop: {
        type: "texture",
        value: "/assets/backdrops/subtle-white-marble.svg",
        color: "#F8F9FA",
        gradient: "linear-gradient(135deg, #F8F9FA 0%, #EAECEF 100%)"
      },
      envelope: {
        outerColor: "#111111",
        flapColor: "#111111",
        linerCss: "linear-gradient(135deg, #D4AF37 0%, #FFF2A1 25%, #AA771C 50%, #FDF4B8 75%, #B8860B 100%)",
        linerColor: "#D4AF37",
        isOpen: true,
        isOpenUpward: true
      },
      card: {
        artworkUrl: "/assets/templates/modern-gold-black-balloon-bg.svg",
        backgroundColor: "#FAFAFA",
        aspectRatio: "5x7"
      },
      defaultTextLayers: [
        { id: "layer-heading", key: "heading", text: "let's party", fontFamily: "'Alex Brush', cursive", fontSize: 38, color: "#111111", fontWeight: "400", textAlign: "center", top: 22, left: 55 },
        { id: "layer-intro", key: "intro", text: "PLEASE JOIN US TO CELEBRATE", fontFamily: "'Inter', sans-serif", fontSize: 11, letterSpacing: 2, color: "#555555", fontWeight: "600", textAlign: "center", top: 33, left: 55 },
        { id: "layer-title", key: "title", text: "MORGAN ANDERSON", fontFamily: "'Playfair Display', serif", fontSize: 20, letterSpacing: 1.5, color: "#111111", fontWeight: "700", textAlign: "center", top: 43, left: 55 },
        { id: "layer-datetime", key: "datetime", text: "SATURDAY, JUNE 24 AT 6 PM\nWILLOW TERRACE", fontFamily: "'Inter', sans-serif", fontSize: 11, letterSpacing: 1.5, lineHeight: 1.6, color: "#333333", fontWeight: "500", textAlign: "center", top: 54, left: 55 }
      ]
    })
  },

  // -------------------------------------------------------------
  // 4. GOLD RIBBONS & CONFETTI
  // -------------------------------------------------------------
  {
    id: "tpl-gold-ribbons-confetti",
    name: "Gold Ribbons & Confetti",
    title: "Gold Ribbons & Confetti",
    category: "Birthday",
    isPremium: false,
    content: JSON.stringify({
      badge: "Free",
      thumbnailUrl: "/assets/templates/gold-ribbons-confetti-bg.svg",
      imageUrl: "/assets/templates/gold-ribbons-confetti-bg.svg",
      backdrop: { type: "color", value: "linear-gradient(135deg, #F6F6F6 0%, #E8E8E8 100%)", color: "#F6F6F6", gradient: "linear-gradient(135deg, #F6F6F6 0%, #E8E8E8 100%)" },
      envelope: { outerColor: "#1A1A1A", linerCss: "repeating-linear-gradient(45deg, #D4AF37 0px, #D4AF37 10px, #1A1A1A 10px, #1A1A1A 20px)", isOpen: true },
      card: { artworkUrl: "/assets/templates/gold-ribbons-confetti-bg.svg", backgroundColor: "#FFFFFF", aspectRatio: "5x7" },
      defaultTextLayers: [
        { id: "layer-headline", key: "headline", text: "DAVE IS TURNING", fontFamily: "'Inter', sans-serif", fontSize: 18, letterSpacing: 2, color: "#1A1A1A", fontWeight: "800", textAlign: "center", top: 30, left: 50 },
        { id: "layer-title", key: "title", text: "50", fontFamily: "'Inter', sans-serif", fontSize: 48, color: "#1A1A1A", fontWeight: "900", textAlign: "center", top: 43, left: 50 },
        { id: "layer-subtitle", key: "subtitle", text: "Please join us to celebrate!", fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#555555", fontWeight: "400", textAlign: "center", top: 54, left: 50 },
        { id: "layer-datetime", key: "datetime", text: "Saturday, August 10 at 2 PM", fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#222222", fontWeight: "600", textAlign: "center", top: 62, left: 50 },
        { id: "layer-venue", key: "venue", text: "Downtown Pub\n457 Lakeview Rd.", fontFamily: "'Inter', sans-serif", fontSize: 11, color: "#666666", fontWeight: "400", textAlign: "center", top: 72, left: 50 }
      ]
    })
  },

  // -------------------------------------------------------------
  // 5. SPARKLE BALLOONS
  // -------------------------------------------------------------
  {
    id: "tpl-sparkle-balloons",
    name: "Sparkle Balloons",
    title: "Sparkle Balloons",
    category: "Birthday",
    isPremium: false,
    content: JSON.stringify({
      badge: "Free",
      thumbnailUrl: "/assets/templates/sparkle-balloons-bg.svg",
      imageUrl: "/assets/templates/sparkle-balloons-bg.svg",
      backdrop: { type: "color", value: "linear-gradient(135deg, #F5F2EA 0%, #E8E3D7 100%)", color: "#F5F2EA", gradient: "linear-gradient(135deg, #F5F2EA 0%, #E8E3D7 100%)" },
      envelope: { outerColor: "#26252B", linerCss: "repeating-linear-gradient(135deg, #E8C36A 0px, #E8C36A 12px, #EDE9DF 12px, #EDE9DF 24px)", isOpen: true },
      card: { artworkUrl: "/assets/templates/sparkle-balloons-bg.svg", backgroundColor: "#EDE9DF", aspectRatio: "5x7" },
      defaultTextLayers: [
        { id: "layer-intro", key: "intro", text: "Join us for", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 14, color: "#4A4A4A", fontWeight: "400", textAlign: "center", top: 38, left: 50 },
        { id: "layer-title", key: "title", text: "APRIL'S BIRTHDAY!", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, letterSpacing: 1.5, color: "#1E1E1E", fontWeight: "700", textAlign: "center", top: 48, left: 50 },
        { id: "layer-datetime", key: "datetime", text: "Sunday, May 7th at 1 PM", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 12, color: "#4A4A4A", fontWeight: "500", textAlign: "center", top: 58, left: 50 },
        { id: "layer-venue", key: "venue", text: "The Blais' Backyard\n8739 Shorecrest Drive", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 11, color: "#5C5C5C", fontWeight: "400", textAlign: "center", top: 68, left: 50 }
      ]
    })
  },

  // -------------------------------------------------------------
  // 6. CELESTIAL FLORA
  // -------------------------------------------------------------
  {
    id: "tpl-celestial-flora",
    name: "Celestial Flora",
    title: "Celestial Flora",
    category: "Birthday",
    isPremium: false,
    content: JSON.stringify({
      badge: "Free",
      thumbnailUrl: "/assets/templates/celestial-flora-bg.svg",
      imageUrl: "/assets/templates/celestial-flora-bg.svg",
      backdrop: { type: "color", value: "linear-gradient(135deg, #FCF8F0 0%, #F5EDE0 100%)", color: "#FCF8F0", gradient: "linear-gradient(135deg, #FCF8F0 0%, #F5EDE0 100%)" },
      envelope: { outerColor: "#DE6B35", linerCss: "repeating-linear-gradient(45deg, #F5B842 0px, #F5B842 10px, #FAF7EF 10px, #FAF7EF 20px)", isOpen: true },
      card: { artworkUrl: "/assets/templates/celestial-flora-bg.svg", backgroundColor: "#FAF7EF", aspectRatio: "5x7" },
      defaultTextLayers: [
        { id: "layer-intro", key: "intro", text: "Let's celebrate", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 13, color: "#594D42", fontWeight: "400", textAlign: "center", top: 28, left: 50 },
        { id: "layer-title", key: "title", text: "Another Trip\nAround\nThe Sun", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, color: "#4B5E3C", fontWeight: "700", textAlign: "center", top: 42, left: 50 },
        { id: "layer-name", key: "name", text: "Aria Thompson", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 16, color: "#B85B32", fontWeight: "600", textAlign: "center", top: 58, left: 50 },
        { id: "layer-datetime", key: "datetime", text: "Saturday, May 15 at 2 PM", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 12, color: "#594D42", fontWeight: "500", textAlign: "center", top: 66, left: 50 },
        { id: "layer-venue", key: "venue", text: "412 Sunset Lane", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 11, color: "#6B5E52", fontWeight: "400", textAlign: "center", top: 74, left: 50 }
      ]
    })
  },

  // -------------------------------------------------------------
  // 7. ABSTRACT NATURE PARTY
  // -------------------------------------------------------------
  {
    id: "tpl-abstract-nature-party",
    name: "Abstract Nature Party",
    title: "Abstract Nature Party",
    category: "Wedding",
    isPremium: false,
    content: JSON.stringify({
      badge: "Free",
      thumbnailUrl: "/assets/templates/abstract-nature-party-bg.svg",
      imageUrl: "/assets/templates/abstract-nature-party-bg.svg",
      backdrop: { type: "color", value: "linear-gradient(135deg, #F9F5EE 0%, #EFE7DA 100%)", color: "#F9F5EE", gradient: "linear-gradient(135deg, #F9F5EE 0%, #EFE7DA 100%)" },
      envelope: { outerColor: "#3F5E3D", flapColor: "#2f482d", linerCss: "", isOpen: true },
      card: { artworkUrl: "/assets/templates/abstract-nature-party-bg.svg", backgroundColor: "#FAF3E8", aspectRatio: "5x7" },
      defaultTextLayers: [
        { id: "layer-intro", key: "intro", text: "Please join us to celebrate\nthe marriage ceremony of", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 13, color: "#4A433A", fontWeight: "400", textAlign: "center", top: 28, left: 50 },
        { id: "layer-title", key: "title", text: "Brittany Moore\n&\nDaniel Rodriguez", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, color: "#992847", fontWeight: "600", textAlign: "center", top: 43, left: 50 },
        { id: "layer-datetime", key: "datetime", text: "Saturday, June 30 at 1 PM", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 13, color: "#4A433A", fontWeight: "500", textAlign: "center", top: 58, left: 50 },
        { id: "layer-venue", key: "venue", text: "The Rose Garden\n45 Mountain View Rd. Denver, CO", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 12, color: "#5C5348", fontWeight: "400", textAlign: "center", top: 68, left: 50 }
      ]
    })
  },

  // -------------------------------------------------------------
  // 8. BRIGHT BLOOMS GARDEN
  // -------------------------------------------------------------
  {
    id: "tpl-bright-blooms-garden",
    name: "Bright Blooms Garden",
    title: "Bright Blooms Garden",
    category: "Wedding",
    isPremium: false,
    content: JSON.stringify({
      badge: "Free",
      thumbnailUrl: "/assets/templates/bright-blooms-garden-bg.svg",
      imageUrl: "/assets/templates/bright-blooms-garden-bg.svg",
      backdrop: { type: "color", value: "linear-gradient(135deg, #F8F9FA 0%, #EEF1F5 100%)", color: "#F8F9FA", gradient: "linear-gradient(135deg, #F8F9FA 0%, #EEF1F5 100%)" },
      envelope: { outerColor: "#FA835B", linerCss: "repeating-linear-gradient(90deg, #845EC2 0px, #845EC2 8px, #FFFFFF 8px, #FFFFFF 16px)", isOpen: true },
      card: { artworkUrl: "/assets/templates/bright-blooms-garden-bg.svg", backgroundColor: "#FFFFFF", aspectRatio: "5x7" },
      defaultTextLayers: [
        { id: "layer-intro", key: "intro", text: "PLEASE JOIN US TO CELEBRATE\nTHE WEDDING OF", fontFamily: "'Inter', sans-serif", fontSize: 11, letterSpacing: 2, color: "#6B7280", fontWeight: "600", textAlign: "left", top: 22, left: 38 },
        { id: "layer-title", key: "title", text: "Peyton Barnes\n&\nAnthony Woods", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, color: "#262626", fontWeight: "600", textAlign: "left", top: 38, left: 38 },
        { id: "layer-datetime", key: "datetime", text: "SATURDAY, JUNE 4, 2026 AT 4 PM", fontFamily: "'Inter', sans-serif", fontSize: 10, letterSpacing: 1.5, color: "#525252", fontWeight: "500", textAlign: "left", top: 52, left: 38 },
        { id: "layer-venue", key: "venue", text: "WILDWOOD ESTATE\n45 MOUNTAIN VIEW RD.\nDENVER, CO", fontFamily: "'Inter', sans-serif", fontSize: 10, letterSpacing: 1.2, color: "#737373", fontWeight: "400", textAlign: "left", top: 62, left: 38 }
      ]
    })
  },

  // -------------------------------------------------------------
  // 9. VIBRANT BLOOMS WEDDING
  // -------------------------------------------------------------
  {
    id: "tpl-vibrant-blooms-wedding",
    name: "Vibrant Blooms Wedding",
    title: "Vibrant Blooms Wedding",
    category: "Wedding",
    isPremium: false,
    content: JSON.stringify({
      badge: "Free",
      thumbnailUrl: "/assets/templates/vibrant-blooms-wedding-bg.svg",
      imageUrl: "/assets/templates/vibrant-blooms-wedding-bg.svg",
      backdrop: { type: "color", value: "linear-gradient(135deg, #FBF2E8 0%, #F5DEC7 100%)", color: "#FBF2E8", gradient: "linear-gradient(135deg, #FBF2E8 0%, #F5DEC7 100%)" },
      envelope: { outerColor: "#E67E17", linerCss: "repeating-linear-gradient(45deg, #D91B24 0px, #D91B24 10px, #FFF5DF 10px, #FFF5DF 20px)", isOpen: true },
      card: { artworkUrl: "/assets/templates/vibrant-blooms-wedding-bg.svg", backgroundColor: "#E67E17", aspectRatio: "5x7" },
      defaultTextLayers: [
        { id: "layer-title", key: "title", text: "Emily Taylor\n&\nJoseph Lee", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, color: "#2C241E", fontWeight: "600", textAlign: "center", top: 35, left: 50 },
        { id: "layer-subtitle", key: "subtitle", text: "invite you to\ncelebrate their wedding", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 12, color: "#5C4A3E", fontWeight: "400", textAlign: "center", top: 48, left: 50 },
        { id: "layer-datetime", key: "datetime", text: "Saturday, the sixth of August\ntwo thousand and twenty-seven\nat six o'clock in the evening", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 11, color: "#4A3C31", fontWeight: "500", textAlign: "center", top: 60, left: 50 },
        { id: "layer-venue", key: "venue", text: "Wildwood Gardens\nSan Francisco, CA", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 11, color: "#5C4A3E", fontWeight: "400", textAlign: "center", top: 72, left: 50 }
      ]
    })
  },

  // -------------------------------------------------------------
  // 10. LILY OF THE VALLEY
  // -------------------------------------------------------------
  {
    id: "tpl-lily-of-the-valley",
    name: "Lily of the Valley",
    title: "Lily of the Valley",
    category: "Wedding",
    isPremium: false,
    content: JSON.stringify({
      badge: "Free",
      thumbnailUrl: "/assets/templates/lily-of-the-valley-bg.svg",
      imageUrl: "/assets/templates/lily-of-the-valley-bg.svg",
      backdrop: { type: "color", value: "linear-gradient(135deg, #F8F5ED 0%, #EDE7D8 100%)", color: "#F8F5ED", gradient: "linear-gradient(135deg, #F8F5ED 0%, #EDE7D8 100%)" },
      envelope: { outerColor: "#5A6F4E", linerCss: "repeating-linear-gradient(90deg, #E5B232 0px, #E5B232 8px, #F7F3E7 8px, #F7F3E7 16px)", isOpen: true },
      card: { artworkUrl: "/assets/templates/lily-of-the-valley-bg.svg", backgroundColor: "#F7F3E7", aspectRatio: "5x7" },
      defaultTextLayers: [
        { id: "layer-intro", key: "intro", text: "Please join us for the wedding of", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 13, color: "#54483C", fontWeight: "400", textAlign: "center", top: 30, left: 50 },
        { id: "layer-title", key: "title", text: "Brianna Davis\nand\nThomas Brown", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, color: "#2E251E", fontWeight: "600", textAlign: "center", top: 44, left: 50 },
        { id: "layer-datetime", key: "datetime", text: "Saturday, June 15 at 4 PM", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 12, color: "#54483C", fontWeight: "500", textAlign: "center", top: 58, left: 50 },
        { id: "layer-venue", key: "venue", text: "The Rose Garden\n45 Mountain View Rd.", fontFamily: "'Playfair Display', Georgia, serif", fontSize: 11, color: "#6B5C4D", fontWeight: "400", textAlign: "center", top: 68, left: 50 }
      ]
    })
  },

  // -------------------------------------------------------------
  // 11. BLUSH & BURGUNDY BLOOMS
  // -------------------------------------------------------------
  {
    id: "blush-burgundy-blooms",
    name: "Blush & Burgundy Blooms",
    title: "Blush & Burgundy Blooms",
    category: "Bridal Shower",
    isPremium: true,
    content: JSON.stringify({
      badge: "Premium",
      thumbnailUrl: "/assets/templates/blush-burgundy-blooms-mockup.svg",
      imageUrl: "/assets/templates/blush-burgundy-blooms-mockup.svg",
      backdrop: { type: "texture", value: "/assets/backdrops/off-white-linen.svg", color: "#FAF7F2", gradient: "linear-gradient(135deg, #FAF7F2 0%, #F5EFEB 100%)" },
      envelope: { outerColor: "#722F37", flapColor: "#722F37", flapStyle: "triangle", isOpenUpward: true, linerCss: "url('/templates/envelopes/blush-gold-foil-liner.svg') center / cover no-repeat", linerColor: "#FAE8EC", shadowColor: "rgba(0,0,0,0.28)", isOpen: true },
      card: { artworkUrl: "/templates/bridal/blush-burgundy-frame.png", backgroundColor: "#FFFFFF", aspectRatio: "5x7" },
      defaultTextLayers: [
        { id: "subtitle", key: "subtitle", text: "Something\nold...something new...\nsomething borrowed...\nsomething red and\npink too", fontFamily: "Playfair Display, Georgia, serif", fontSize: 15, lineHeight: 1.45, color: "#5A4A42", fontWeight: "400", textAlign: "center", top: 45, left: 50 },
        { id: "title-name", key: "title", text: "taylor madison", fontFamily: "Great Vibes, Alex Brush, cursive", fontSize: 38, lineHeight: 1.15, color: "#722F37", fontWeight: "600", textAlign: "center", top: 62, left: 50 },
        { id: "details", key: "datetime", text: "Sunday, April 3rd at 1 pm\nThe Rosewood Cafe", fontFamily: "Playfair Display, Georgia, serif", fontSize: 13, lineHeight: 1.5, color: "#5A4A42", fontWeight: "400", textAlign: "center", top: 74, left: 50 }
      ]
    })
  },

  // -------------------------------------------------------------
  // 12. SOMETHING BLUE
  // -------------------------------------------------------------
  {
    id: "something-blue",
    name: "Something Blue",
    title: "Something Blue",
    category: "Bridal Shower",
    isPremium: true,
    content: JSON.stringify({
      badge: "Premium",
      thumbnailUrl: "/assets/templates/something-blue-mockup.svg",
      imageUrl: "/assets/templates/something-blue-mockup.svg",
      backdrop: { type: "texture", value: "/assets/backdrops/subtle-white-marble.svg", color: "#F8F9FA", gradient: "linear-gradient(135deg, #F8F9FA 0%, #EAECEF 100%)" },
      envelope: { outerColor: "#5B7C99", flapColor: "#5B7C99", flapStyle: "triangle", isOpenUpward: true, linerCss: "url('/templates/envelopes/something-blue-toile-liner.svg') center / cover no-repeat", linerColor: "#FFFFFF", shadowColor: "rgba(0,0,0,0.22)", isOpen: true },
      card: { artworkUrl: "/templates/bridal/something-blue-frame.png", backgroundColor: "#FFFFFF", aspectRatio: "5x7" },
      defaultTextLayers: [
        { id: "title-ribbon", key: "headline", text: "Something Blue\nBEFORE \"I DO\"", fontFamily: "Cormorant Garamond, serif", fontSize: 24, lineHeight: 1.25, letterSpacing: 2, color: "#355B82", fontWeight: "600", textAlign: "center", top: 44, left: 50 },
        { id: "subtitle", key: "subtitle", text: "Please join us for a bridal shower honoring", fontFamily: "Montserrat, sans-serif", fontSize: 11, lineHeight: 1.4, color: "#5C768D", fontWeight: "400", textAlign: "center", top: 54, left: 50 },
        { id: "title-name", key: "title", text: "Andrea Ross", fontFamily: "Great Vibes, cursive", fontSize: 38, lineHeight: 1.2, color: "#2D5175", fontWeight: "600", textAlign: "center", top: 62, left: 50 },
        { id: "details", key: "datetime", text: "Saturday, May 14th at 2 pm\nThe Glasshouse", fontFamily: "Montserrat, sans-serif", fontSize: 12, lineHeight: 1.5, color: "#5C768D", fontWeight: "400", textAlign: "center", top: 72, left: 50 }
      ]
    })
  },

  // -------------------------------------------------------------
  // 13. AUTUMN BLOOMS
  // -------------------------------------------------------------
  {
    id: "autumn-blooms",
    name: "Autumn Blooms",
    title: "Autumn Blooms",
    category: "Bridal Shower",
    isPremium: true,
    content: JSON.stringify({
      badge: "Premium",
      thumbnailUrl: "/assets/templates/autumn-blooms-mockup.svg",
      imageUrl: "/assets/templates/autumn-blooms-mockup.svg",
      backdrop: { type: "texture", value: "/assets/backdrops/warm-artisan-kraft.svg", color: "#CDBAA6", gradient: "linear-gradient(135deg, #D4C2AE 0%, #C3AF9B 100%)" },
      envelope: { outerColor: "#B3673B", flapColor: "#B3673B", flapStyle: "triangle", isOpenUpward: true, linerCss: "url('/templates/envelopes/autumn-gingham-liner.png') center / 150px repeat", linerColor: "#F8EFE4", shadowColor: "rgba(0,0,0,0.25)", isOpen: true },
      card: { artworkUrl: "/templates/bridal/autumn-blooms-frame.png", backgroundColor: "#FCFAF6", aspectRatio: "5x7" },
      defaultTextLayers: [
        { id: "subtitle", key: "subtitle", text: "Fall in love", fontFamily: "Great Vibes, cursive", fontSize: 34, color: "#B3673B", fontWeight: "400", textAlign: "center", top: 45, left: 50 },
        { id: "title-name", key: "title", text: "JENNIFER\nHAYWARD", fontFamily: "Cinzel, Cormorant Garamond, serif", fontSize: 20, letterSpacing: 3, lineHeight: 1.3, color: "#6D4427", fontWeight: "600", textAlign: "center", top: 56, left: 50 },
        { id: "details", key: "datetime", text: "OCTOBER 15TH AT 4:00 PM\nOAK GROVE ESTATE", fontFamily: "Montserrat, sans-serif", fontSize: 11, lineHeight: 1.6, letterSpacing: 1.5, color: "#8B6B55", fontWeight: "400", textAlign: "center", top: 67, left: 50 }
      ]
    })
  },

  // -------------------------------------------------------------
  // 14. O TANNENBAUM
  // -------------------------------------------------------------
  {
    id: "o-tannenbaum",
    name: "O Tannenbaum",
    title: "O Tannenbaum",
    category: "Holiday",
    tags: ["Holiday", "Corporate", "All"],
    isPremium: true,
    content: JSON.stringify({
      badge: "Premium",
      thumbnailUrl: "/assets/templates/o-tannenbaum-mockup.svg",
      imageUrl: "/assets/templates/o-tannenbaum-mockup.svg",
      mockupUrl: "/assets/templates/o-tannenbaum-mockup.svg",
      backdrop: {
        type: "texture",
        value: "linear-gradient(135deg, #FAF7F2 0%, #F4EFE6 50%, #EAE3D6 100%)",
        color: "#FAF7F2",
        gradient: "linear-gradient(135deg, #FAF7F2 0%, #F4EFE6 50%, #EAE3D6 100%)"
      },
      envelope: {
        outerColor: "#DACFBC",
        flapColor: "#DACFBC",
        position: "left",
        linerColor: "#D4AF37",
        linerCss: "linear-gradient(135deg, #A67C1E 0%, #D4AF37 25%, #FFF2A1 50%, #D4AF37 75%, #8E6516 100%)",
        shadowColor: "rgba(0,0,0,0.28)",
        isOpen: true
      },
      card: {
        artworkUrl: "/assets/templates/o-tannenbaum-bg.svg",
        borderIllustration: "/assets/templates/o-tannenbaum-bg.svg",
        backgroundColor: "#1C1F1E",
        aspectRatio: "5x7"
      },
      defaultTextLayers: [
        {
          id: "ot-title",
          key: "title",
          text: "Holiday Party",
          fontFamily: "'Great Vibes', cursive",
          fontSize: 38,
          color: "#F6F4ED",
          fontWeight: "400",
          textAlign: "center",
          top: 30,
          left: 64
        },
        {
          id: "ot-subtitle",
          key: "subtitle",
          text: "Join us for light bites & good times",
          fontFamily: "'Montserrat', sans-serif",
          fontSize: 12,
          color: "#CDC9BC",
          fontWeight: "400",
          textAlign: "center",
          top: 48,
          left: 64
        },
        {
          id: "ot-datetime",
          key: "datetime",
          text: "Saturday, December 16\nat 7 PM",
          fontFamily: "'Montserrat', sans-serif",
          fontSize: 12,
          color: "#E2DDD2",
          fontWeight: "500",
          textAlign: "center",
          top: 60,
          left: 64
        },
        {
          id: "ot-venue",
          key: "venue",
          text: "The Smith Home\n5555 Willow Brook St.",
          fontFamily: "'Montserrat', sans-serif",
          fontSize: 11,
          color: "#B3ADA0",
          fontWeight: "400",
          textAlign: "center",
          top: 74,
          left: 64
        }
      ]
    })
  },

  // -------------------------------------------------------------
  // 15. METALLIC PAINT SPLATTER
  // -------------------------------------------------------------
  {
    id: "metallic-paint-splatter",
    name: "Metallic Paint Splatter",
    title: "Metallic Paint Splatter",
    category: "Corporate",
    tags: ["Corporate", "Holiday", "All"],
    isPremium: true,
    content: JSON.stringify({
      badge: "Premium",
      thumbnailUrl: "/assets/templates/metallic-paint-splatter-mockup.svg",
      imageUrl: "/assets/templates/metallic-paint-splatter-mockup.svg",
      mockupUrl: "/assets/templates/metallic-paint-splatter-mockup.svg",
      backdrop: {
        type: "texture",
        value: "linear-gradient(135deg, #F2EEE7 0%, #EBE5DC 50%, #DFD7CB 100%)",
        color: "#F2EEE7",
        gradient: "linear-gradient(135deg, #F2EEE7 0%, #EBE5DC 50%, #DFD7CB 100%)"
      },
      envelope: {
        outerColor: "#141414",
        flapColor: "#181818",
        position: "left",
        linerColor: "#111111",
        linerCss: "#111111",
        shadowColor: "rgba(0,0,0,0.32)",
        isOpen: true
      },
      card: {
        artworkUrl: "/assets/templates/metallic-paint-splatter-bg.svg",
        borderIllustration: "/assets/templates/metallic-paint-splatter-bg.svg",
        backgroundColor: "#FAF8F5",
        aspectRatio: "5x7"
      },
      defaultTextLayers: [
        {
          id: "mps-header",
          key: "title",
          text: "JOIN US",
          fontFamily: "'Cinzel', 'Playfair Display', Georgia, serif",
          fontSize: 28,
          letterSpacing: 4,
          color: "#1C1C1C",
          fontWeight: "600",
          textAlign: "center",
          top: 36,
          left: 50
        },
        {
          id: "mps-subtext",
          key: "subtitle",
          text: "Come raise a glass... we've got so much to celebrate!",
          fontFamily: "'Playfair Display', Georgia, serif",
          fontStyle: "italic",
          fontSize: 13,
          lineHeight: 1.4,
          color: "#4A4A4A",
          fontWeight: "400",
          textAlign: "center",
          top: 48,
          left: 50
        },
        {
          id: "mps-details",
          key: "datetime",
          text: "Friday, February 3 at 7 PM\n835 South Hill St.",
          fontFamily: "'Montserrat', sans-serif",
          fontSize: 12,
          lineHeight: 1.5,
          color: "#5A5A5A",
          fontWeight: "400",
          textAlign: "center",
          top: 66,
          left: 50
        }
      ]
    })
  },

  // -------------------------------------------------------------
  // 16. GOLDEN FOLIAGE HOLIDAY
  // -------------------------------------------------------------
  {
    id: "golden-foliage-holiday",
    name: "Golden Foliage Holiday",
    title: "Golden Foliage Holiday",
    category: "Holiday",
    tags: ["Holiday", "Corporate", "All"],
    isPremium: true,
    content: JSON.stringify({
      badge: "Premium",
      thumbnailUrl: "/assets/templates/golden-foliage-holiday-mockup.svg",
      imageUrl: "/assets/templates/golden-foliage-holiday-mockup.svg",
      mockupUrl: "/assets/templates/golden-foliage-holiday-mockup.svg",
      backdrop: {
        type: "texture",
        value: "linear-gradient(135deg, #FAF7F2 0%, #F3ECE2 50%, #E8DFCFA 100%)",
        color: "#FAF7F2",
        gradient: "linear-gradient(135deg, #FAF7F2 0%, #F3ECE2 50%, #E8DFCFA 100%)"
      },
      envelope: {
        outerColor: "#DACFBC",
        flapColor: "#DACFBC",
        position: "left",
        linerColor: "#D4AF37",
        linerCss: "linear-gradient(135deg, #9E7318 0%, #D4AF37 25%, #FFF4B3 50%, #D4AF37 75%, #7C540C 100%)",
        shadowColor: "rgba(0,0,0,0.28)",
        isOpen: true
      },
      card: {
        artworkUrl: "/assets/templates/golden-foliage-holiday-bg.svg",
        borderIllustration: "/assets/templates/golden-foliage-holiday-bg.svg",
        backgroundColor: "#223326",
        aspectRatio: "5x7"
      },
      defaultTextLayers: [
        {
          id: "gfh-heading",
          key: "title",
          text: "LET'S CELEBRATE\nTHE SEASON",
          fontFamily: "'Cinzel', 'Playfair Display', Georgia, serif",
          fontSize: 22,
          letterSpacing: 2,
          lineHeight: 1.3,
          color: "#222222",
          fontWeight: "600",
          textAlign: "center",
          top: 36,
          left: 50
        },
        {
          id: "gfh-subtitle",
          key: "subtitle",
          text: "JOIN US FOR OUR\nannual holiday party",
          fontFamily: "'Great Vibes', cursive",
          fontSize: 20,
          lineHeight: 1.4,
          color: "#555555",
          fontWeight: "400",
          textAlign: "center",
          top: 50,
          left: 50
        },
        {
          id: "gfh-details",
          key: "datetime",
          text: "SATURDAY, DECEMBER 15TH AT 6 PM\nTHE ANDERSON HOME, 819 HOLLY LANE",
          fontFamily: "'Montserrat', sans-serif",
          fontSize: 9.5,
          letterSpacing: 1.1,
          lineHeight: 1.6,
          color: "#555555",
          fontWeight: "500",
          textAlign: "center",
          top: 66,
          left: 50
        }
      ]
    })
  }
];

// Computed styles map for backend controllers
const newTemplateStylesBackend = {};
for (const t of newTemplatesDataBackend) {
  let c = {};
  try { c = typeof t.content === 'string' ? JSON.parse(t.content) : (t.content || {}); } catch(_) {}
  newTemplateStylesBackend[t.id] = {
    fontFamily: (c.defaultTextLayers && c.defaultTextLayers[0]?.fontFamily) || "Inter",
    background: c.backdrop?.gradient || c.backdrop?.color || "#ffffff",
    cardBackground: c.card?.backgroundColor || "#ffffff",
    buttonColor: c.envelope?.outerColor || c.envelope?.linerColor || "#111111",
    buttonRadius: 10,
    textAlignment: "center"
  };
}

module.exports = {
  newTemplatesDataBackend,
  newTemplateStylesBackend,
  templates: newTemplatesDataBackend,
  TEMPLATES: newTemplatesDataBackend
};
