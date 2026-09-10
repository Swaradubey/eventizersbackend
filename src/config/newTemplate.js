/**
 * Evite-style Invitation Templates Configuration with SVG vector definitions,
 * isolated envelope flaps, and interactive text layers.
 */

const newTemplatesDataBackend = [
  {
    id: "tpl-hibiscus-blooms",
    name: "Hibiscus Blooms",
    category: "Bridal Shower",
    isPremium: true,
    content: JSON.stringify({
      thumbnailUrl: "assets/templates/hibiscus_blooms_scene.jpg",
      imageUrl: "assets/templates/hibiscus_blooms_scene.jpg",
      emoji: "🌺",
      svgTemplate: `<svg viewBox="0 0 400 560" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg-hibiscus" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#E0F7FA"/>
            <stop offset="100%" stop-color="#FFFFFF"/>
          </linearGradient>
        </defs>
        <rect width="400" height="560" rx="16" fill="url(#bg-hibiscus)" stroke="#B2EBF2" stroke-width="2"/>
        <!-- Tropical Hibiscus Flowers & Leaves SVG Accents -->
        <g fill="#FF6F61" opacity="0.9">
          <circle cx="50" cy="50" r="28" fill="#FF8A80"/>
          <circle cx="350" cy="50" r="28" fill="#FFA726"/>
          <circle cx="50" cy="510" r="32" fill="#FF5252"/>
          <circle cx="350" cy="510" r="30" fill="#FFD54F"/>
        </g>
        <g fill="#2E7D32" opacity="0.75">
          <path d="M 20 70 Q 50 110 80 80 Q 50 60 20 70 Z"/>
          <path d="M 380 70 Q 350 110 320 80 Q 350 60 380 70 Z"/>
          <path d="M 20 490 Q 50 450 80 480 Q 50 500 20 490 Z"/>
          <path d="M 380 490 Q 350 450 320 480 Q 350 500 380 490 Z"/>
        </g>
      </svg>`,
      envelope: {
        flapColor: "#FF7043",
        linerPattern: "tropical_palm",
        flapSvg: `<svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg">
          <polygon points="0,0 200,180 400,0" fill="#FF7043"/>
          <polygon points="20,0 200,160 380,0" fill="#FFE082" opacity="0.3"/>
        </svg>`
      },
      textElements: [
        { id: "hdr", text: "JOIN US FOR AN AFTERNOON IN PARADISE...", x: 0.5, y: 0.38, fontFamily: "Montserrat", color: "#1E3A8A", fontSize: 9 },
        { id: "names", text: "AMBER'S BEACHY\nBRIDAL SHOWER", x: 0.5, y: 0.48, fontFamily: "Playfair Display", color: "#0F172A", fontSize: 20 },
        { id: "date", text: "SATURDAY, JULY 18TH AT 2 PM", x: 0.5, y: 0.60, fontFamily: "Montserrat", color: "#1E3A8A", fontSize: 11 },
        { id: "venue", text: "THE SURFSIDE INN", x: 0.5, y: 0.66, fontFamily: "Playfair Display", color: "#334155", fontSize: 12 },
        { id: "address", text: "100 OCEAN VIEW DR, MALIBU", x: 0.5, y: 0.72, fontFamily: "Playfair Display", color: "#64748B", fontSize: 10 }
      ]
    })
  },
  {
    id: "tpl-chicory-whispers",
    name: "Chicory Whispers",
    category: "Bridal Shower",
    isPremium: true,
    content: JSON.stringify({
      thumbnailUrl: "assets/templates/chicory_whispers_scene.jpg",
      imageUrl: "assets/templates/chicory_whispers_scene.jpg",
      emoji: "💙",
      svgTemplate: `<svg viewBox="0 0 400 560" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="560" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5"/>
        <!-- Chicory Botanical Watercolor Border SVG -->
        <g stroke="#3B82F6" stroke-width="1.5" fill="none" opacity="0.8">
          <circle cx="45" cy="45" r="14" fill="#93C5FD"/>
          <circle cx="75" cy="35" r="10" fill="#60A5FA"/>
          <circle cx="355" cy="515" r="16" fill="#93C5FD"/>
          <circle cx="325" cy="525" r="12" fill="#60A5FA"/>
          <path d="M 20 20 Q 80 80 40 140" stroke="#16A34A" stroke-width="2"/>
          <path d="M 380 540 Q 320 480 360 420" stroke="#16A34A" stroke-width="2"/>
        </g>
      </svg>`,
      envelope: {
        flapColor: "#1E3A8A",
        flapSvg: `<svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg">
          <polygon points="0,0 200,180 400,0" fill="#1E3A8A"/>
        </svg>`
      },
      textElements: [
        { id: "hdr", text: "Please join us to shower", x: 0.5, y: 0.34, fontFamily: "Great Vibes", color: "#1E3A8A", fontSize: 24 },
        { id: "names", text: "MAGGIE\nCOLLINS", x: 0.5, y: 0.45, fontFamily: "Playfair Display", color: "#0F172A", fontSize: 26 },
        { id: "date", text: "SUNDAY, AUGUST 3RD AT 11 AM", x: 0.5, y: 0.58, fontFamily: "Montserrat", color: "#1E3A8A", fontSize: 10 },
        { id: "venue", text: "The Collins Family Home", x: 0.5, y: 0.64, fontFamily: "Playfair Display", color: "#475569", fontSize: 11 },
        { id: "address", text: "547 LOVELY LANE\nCARLSBAD, CA", x: 0.5, y: 0.69, fontFamily: "Playfair Display", color: "#64748B", fontSize: 10 },
        { id: "rsvp", text: "Light apps and drinks will be served.", x: 0.5, y: 0.76, fontFamily: "Great Vibes", color: "#1E3A8A", fontSize: 15 }
      ]
    })
  },
  {
    id: "tpl-lovely-blossoms",
    name: "Lovely Blossoms",
    category: "Bridal Shower",
    isPremium: true,
    content: JSON.stringify({
      thumbnailUrl: "assets/templates/lovely_blossoms_scene.jpg",
      imageUrl: "assets/templates/lovely_blossoms_scene.jpg",
      emoji: "🌸",
      svgTemplate: `<svg viewBox="0 0 400 560" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="560" rx="14" fill="#FFFDF9" stroke="#FCE7F3" stroke-width="2"/>
        <!-- Ornate Ribbon & Rose Garland Border -->
        <rect x="20" y="20" width="360" height="520" rx="10" fill="none" stroke="#FBCFE8" stroke-width="1.5" stroke-dasharray="6,4"/>
        <g fill="#F472B6" opacity="0.9">
          <!-- Satin Ribbon Bow -->
          <ellipse cx="200" cy="35" rx="36" ry="12" fill="#F472B6"/>
          <circle cx="200" cy="35" r="8" fill="#DB2777"/>
          <!-- Corner Rose Accents -->
          <circle cx="35" cy="35" r="16" fill="#F472B6"/>
          <circle cx="365" cy="35" r="16" fill="#F472B6"/>
          <circle cx="35" cy="525" r="16" fill="#F472B6"/>
          <circle cx="365" cy="525" r="16" fill="#F472B6"/>
        </g>
      </svg>`,
      envelope: {
        flapColor: "#A7C4B5",
        linerPattern: "sage_pinstripe",
        flapSvg: `<svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg">
          <polygon points="0,0 200,180 400,0" fill="#A7C4B5"/>
          <polygon points="20,0 200,160 380,0" fill="#E8F0EC" opacity="0.4"/>
        </svg>`
      },
      textElements: [
        { id: "hdr", text: "JOIN US TO CELEBRATE", x: 0.5, y: 0.32, fontFamily: "Montserrat", color: "#9D174D", fontSize: 9 },
        { id: "names", text: "Josephine\nSanders", x: 0.5, y: 0.44, fontFamily: "Great Vibes", color: "#BE185D", fontSize: 34 },
        { id: "date", text: "SATURDAY, JUNE 19TH AT 1 PM", x: 0.5, y: 0.58, fontFamily: "Montserrat", color: "#9D174D", fontSize: 10 },
        { id: "venue", text: "THE SANDERS HOME", x: 0.5, y: 0.64, fontFamily: "Playfair Display", color: "#475569", fontSize: 11 },
        { id: "address", text: "219 GARDEN LANE", x: 0.5, y: 0.69, fontFamily: "Playfair Display", color: "#64748B", fontSize: 10 },
        { id: "rsvp", text: "Drinks & light bites\nwill be served", x: 0.5, y: 0.76, fontFamily: "Great Vibes", color: "#BE185D", fontSize: 16 }
      ]
    })
  },
  {
    id: "tpl-elegant-lace",
    name: "Elegant Lace",
    category: "Bridal Shower",
    isPremium: true,
    content: JSON.stringify({
      thumbnailUrl: "assets/templates/elegant_lace_scene.jpg",
      imageUrl: "assets/templates/elegant_lace_scene.jpg",
      emoji: "🌸",
      svgTemplate: `<svg viewBox="0 0 400 560" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="560" rx="16" fill="#FDFBF7" stroke="#E5E0D8" stroke-width="2"/>
        <ellipse cx="200" cy="280" rx="160" ry="230" fill="#FFFFFF" stroke="#E5E0D8" stroke-width="3" stroke-dasharray="8,6"/>
      </svg>`,
      envelope: {
        flapColor: "#F4EDE4",
        flapSvg: `<svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg">
          <polygon points="0,0 200,180 400,0" fill="#F4EDE4"/>
        </svg>`
      },
      textElements: [
        { id: "hdr", text: "KINDLY JOIN US\nAS WE HONOR", x: 0.5, y: 0.36, fontFamily: "Montserrat", color: "#2B2927", fontSize: 11 },
        { id: "names", text: "Emma\nJohnson", x: 0.5, y: 0.48, fontFamily: "Great Vibes", color: "#2B2927", fontSize: 32 },
        { id: "date", text: "SATURDAY, APRIL 20TH\nAT 12 O'CLOCK", x: 0.5, y: 0.62, fontFamily: "Playfair Display", color: "#2B2927", fontSize: 10 },
        { id: "venue", text: "JUNIPER CAFE", x: 0.5, y: 0.70, fontFamily: "Playfair Display", color: "#2B2927", fontSize: 10 },
        { id: "address", text: "2345 11TH STREET\nENCINITAS, CA", x: 0.5, y: 0.75, fontFamily: "Playfair Display", color: "#64748B", fontSize: 9 }
      ]
    })
  },
  {
    id: "tpl-painted-petals",
    name: "Painted Petals",
    category: "Bridal Shower",
    isPremium: true,
    content: JSON.stringify({
      thumbnailUrl: "assets/templates/painted_petals_scene.jpg",
      imageUrl: "assets/templates/painted_petals_scene.jpg",
      emoji: "💙",
      svgTemplate: `<svg viewBox="0 0 400 560" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="560" rx="12" fill="#FBF9F4" stroke="#CBD5E1" stroke-width="2"/>
        <rect x="18" y="18" width="364" height="524" rx="8" fill="none" stroke="#93C5FD" stroke-width="1.5"/>
      </svg>`,
      envelope: {
        flapColor: "#0F2A4A",
        flapSvg: `<svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg">
          <polygon points="0,0 200,180 400,0" fill="#0F2A4A"/>
        </svg>`
      },
      textElements: [
        { id: "hdr", text: "JOIN US TO SHOWER", x: 0.5, y: 0.32, fontFamily: "Montserrat", color: "#1E3A8A", fontSize: 11 },
        { id: "names", text: "Emilia\nHernandez", x: 0.5, y: 0.44, fontFamily: "Great Vibes", color: "#1E3A8A", fontSize: 34 },
        { id: "date", text: "SUNDAY, JUNE 7TH AT 1 PM", x: 0.5, y: 0.58, fontFamily: "Playfair Display", color: "#1E3A8A", fontSize: 11 },
        { id: "venue", text: "THE HERNANDEZ HOME", x: 0.5, y: 0.64, fontFamily: "Playfair Display", color: "#475569", fontSize: 10 },
        { id: "address", text: "893 SOUTH HILL ST.", x: 0.5, y: 0.69, fontFamily: "Playfair Display", color: "#64748B", fontSize: 10 },
        { id: "rsvp", text: "Lunch will be served.", x: 0.5, y: 0.75, fontFamily: "Great Vibes", color: "#1E3A8A", fontSize: 16 }
      ]
    })
  },
  {
    id: "tpl-floral-elegance",
    name: "Floral Elegance",
    category: "Bridal Shower",
    isPremium: true,
    content: JSON.stringify({
      thumbnailUrl: "assets/templates/floral_elegance_scene.jpg",
      imageUrl: "assets/templates/floral_elegance_scene.jpg",
      emoji: "🌿",
      svgTemplate: `<svg viewBox="0 0 400 560" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="560" rx="14" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
        <circle cx="200" cy="280" r="170" fill="none" stroke="#86EFAC" stroke-width="2" stroke-dasharray="6,4"/>
      </svg>`,
      envelope: {
        flapColor: "#5B7065",
        flapSvg: `<svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg">
          <polygon points="0,0 200,180 400,0" fill="#5B7065"/>
        </svg>`
      },
      textElements: [
        { id: "title", text: "Brunch\nand\nBubbly", x: 0.5, y: 0.38, fontFamily: "Playfair Display", color: "#B45309", fontSize: 28 },
        { id: "subhdr", text: "PLEASE JOIN US FOR A\nBRIDAL SHOWER HONORING", x: 0.5, y: 0.50, fontFamily: "Montserrat", color: "#D97706", fontSize: 10 },
        { id: "names", text: "Chloe Johnson", x: 0.5, y: 0.58, fontFamily: "Great Vibes", color: "#D97706", fontSize: 30 },
        { id: "date", text: "SATURDAY, MARCH 16TH AT 11 AM", x: 0.5, y: 0.68, fontFamily: "Playfair Display", color: "#4B5563", fontSize: 10 },
        { id: "venue", text: "THE JOHNSON HOME", x: 0.5, y: 0.73, fontFamily: "Playfair Display", color: "#4B5563", fontSize: 10 },
        { id: "address", text: "983 CRESTLINE DRIVE", x: 0.5, y: 0.77, fontFamily: "Playfair Display", color: "#64748B", fontSize: 9 }
      ]
    })
  },
  {
    id: "tpl-floral-arch",
    name: "Floral Arch",
    category: "Bridal Shower",
    isPremium: true,
    content: JSON.stringify({
      thumbnailUrl: "assets/templates/floral_arch_scene.jpg",
      imageUrl: "assets/templates/floral_arch_scene.jpg",
      emoji: "🌺",
      svgTemplate: `<svg viewBox="0 0 400 560" xmlns="http://www.w3.org/2000/svg">
        <path d="M 40 540 L 40 180 A 160 160 0 0 1 360 180 L 360 540 Z" fill="#FFFBF5" stroke="#FDE047" stroke-width="2"/>
      </svg>`,
      envelope: {
        flapColor: "#D87A80",
        flapSvg: `<svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg">
          <polygon points="0,0 200,180 400,0" fill="#D87A80"/>
        </svg>`
      },
      textElements: [
        { id: "title", text: "Love is\nin bloom", x: 0.5, y: 0.44, fontFamily: "Great Vibes", color: "#DB2777", fontSize: 32 },
        { id: "subhdr", text: "JOIN US TO CELEBRATE", x: 0.5, y: 0.56, fontFamily: "Montserrat", color: "#F43F5E", fontSize: 10 },
        { id: "names", text: "AVERY SANDERS", x: 0.5, y: 0.62, fontFamily: "Montserrat", color: "#DB2777", fontSize: 16 },
        { id: "date", text: "SATURDAY, JULY 15TH AT 3:00 PM", x: 0.5, y: 0.70, fontFamily: "Playfair Display", color: "#4B5563", fontSize: 10 },
        { id: "venue", text: "POPLIN BOTANICAL GARDEN", x: 0.5, y: 0.75, fontFamily: "Playfair Display", color: "#64748B", fontSize: 9 }
      ]
    })
  },
  {
    id: "tpl-limoncello",
    name: "Little Limoncello",
    category: "Bridal Shower",
    isPremium: true,
    content: JSON.stringify({
      thumbnailUrl: "assets/templates/limoncello_scene.jpg",
      imageUrl: "assets/templates/limoncello_scene.jpg",
      emoji: "🍋",
      svgTemplate: `<svg viewBox="0 0 400 560" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="560" rx="14" fill="#F8FAFC" stroke="#60A5FA" stroke-width="2"/>
        <ellipse cx="200" cy="280" rx="150" ry="220" fill="#FFFFFF" stroke="#93C5FD" stroke-width="3"/>
      </svg>`,
      envelope: {
        flapColor: "#7AA2E3",
        flapSvg: `<svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg">
          <polygon points="0,0 200,180 400,0" fill="#7AA2E3"/>
        </svg>`
      },
      textElements: [
        { id: "title", text: "Ciao Bella!", x: 0.5, y: 0.40, fontFamily: "Great Vibes", color: "#2563EB", fontSize: 32 },
        { id: "subhdr", text: "PLEASE JOIN US FOR THE\nBRIDAL SHOWER OF", x: 0.5, y: 0.50, fontFamily: "Montserrat", color: "#3B82F6", fontSize: 10 },
        { id: "names", text: "Christina Hirata", x: 0.5, y: 0.58, fontFamily: "Playfair Display", color: "#1E40AF", fontSize: 24 },
        { id: "date", text: "SATURDAY, JULY 27TH AT 11 AM", x: 0.5, y: 0.68, fontFamily: "Playfair Display", color: "#4B5563", fontSize: 10 },
        { id: "venue", text: "THE CARTWRIGHT HOME", x: 0.5, y: 0.73, fontFamily: "Playfair Display", color: "#4B5563", fontSize: 10 },
        { id: "address", text: "See registry details below.", x: 0.5, y: 0.78, fontFamily: "Playfair Display", color: "#64748B", fontSize: 9 }
      ]
    })
  },
  {
    id: "tpl-corporate-summit",
    name: "Global Innovation Summit 2026",
    category: "Corporate Event",
    isPremium: true,
    content: JSON.stringify({
      thumbnailUrl: "assets/templates/corporate_summit_scene.jpg",
      imageUrl: "assets/templates/corporate_summit_scene.jpg",
      emoji: "🚀",
      svgTemplate: `<svg viewBox="0 0 400 560" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="560" rx="10" fill="#0F172A" stroke="#D4AF37" stroke-width="2"/>
        <rect x="20" y="20" width="360" height="520" fill="none" stroke="#D4AF37" stroke-width="1.5" stroke-dasharray="10,6"/>
      </svg>`,
      envelope: {
        flapColor: "#1E293B",
        linerPattern: "gold_foil_diagonal",
        flapSvg: `<svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg">
          <polygon points="0,0 200,180 400,0" fill="#1E293B"/>
          <polygon points="20,0 200,160 380,0" fill="#D4AF37" opacity="0.3"/>
        </svg>`
      },
      textElements: [
        { id: "subhdr", text: "EVENTIZERS ENTERPRISE PRESENTS", x: 0.5, y: 0.28, fontFamily: "Montserrat", color: "#06B6D4", fontSize: 12 },
        { id: "names", text: "NextGen Tech Summit", x: 0.5, y: 0.42, fontFamily: "Cinzel", color: "#FFFFFF", fontSize: 30 },
        { id: "hdr", text: "ANNUAL KEYNOTE & PRODUCT SHOWCASE", x: 0.5, y: 0.54, fontFamily: "Montserrat", color: "#94A3B8", fontSize: 12 },
        { id: "date", text: "THURSDAY, OCTOBER 8TH | 9:00 AM - 5:00 PM", x: 0.5, y: 0.65, fontFamily: "Montserrat", color: "#E2E8F0", fontSize: 12 },
        { id: "venue", text: "METROPOLITAN CONVENTION CENTER", x: 0.5, y: 0.72, fontFamily: "Playfair Display", color: "#F8FAFC", fontSize: 12 },
        { id: "address", text: "100 INNOVATION DRIVE, SEATTLE", x: 0.5, y: 0.78, fontFamily: "Playfair Display", color: "#94A3B8", fontSize: 11 },
        { id: "rsvp", text: "VIP NETWORKING RECEPTION AT 6 PM", x: 0.5, y: 0.85, fontFamily: "Montserrat", color: "#06B6D4", fontSize: 11 }
      ]
    })
  },
  {
    id: "tpl-charity-gala",
    name: "Black Tie Charity Gala",
    category: "Fundraiser",
    isPremium: true,
    content: JSON.stringify({
      thumbnailUrl: "assets/templates/charity_gala_scene.jpg",
      imageUrl: "assets/templates/charity_gala_scene.jpg",
      emoji: "✨",
      svgTemplate: `<svg viewBox="0 0 400 560" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="560" rx="10" fill="#0A0A0A" stroke="#C5A059" stroke-width="2.5"/>
        <rect x="22" y="22" width="356" height="516" fill="none" stroke="#C5A059" stroke-width="1"/>
      </svg>`,
      envelope: {
        flapColor: "#111111",
        linerPattern: "gold_art_deco",
        flapSvg: `<svg viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg">
          <polygon points="0,0 200,180 400,0" fill="#111111"/>
          <polygon points="20,0 200,160 380,0" fill="#C5A059" opacity="0.35"/>
        </svg>`
      },
      textElements: [
        { id: "subhdr", text: "CORDIALLY INVITED TO THE ANNUAL BENEFIT", x: 0.5, y: 0.28, fontFamily: "Montserrat", color: "#D4AF37", fontSize: 11 },
        { id: "names", text: "Charity Gala", x: 0.5, y: 0.44, fontFamily: "Great Vibes", color: "#FCE182", fontSize: 44 },
        { id: "hdr", text: "AN EVENING OF ELEGANCE & BENEFICENCE", x: 0.5, y: 0.56, fontFamily: "Cinzel", color: "#E6CA65", fontSize: 11 },
        { id: "date", text: "SATURDAY, OCTOBER 14TH AT 7:00 PM", x: 0.5, y: 0.65, fontFamily: "Playfair Display", color: "#FBF3D5", fontSize: 12 },
        { id: "venue", text: "THE GRAND PLAZA BALLROOM", x: 0.5, y: 0.72, fontFamily: "Playfair Display", color: "#FFFFFF", fontSize: 13 },
        { id: "address", text: "FIFTH AVENUE AT CENTRAL PARK SOUTH", x: 0.5, y: 0.78, fontFamily: "Montserrat", color: "#E2E8F0", fontSize: 10 },
        { id: "rsvp", text: "BLACK TIE OPTIONAL · SILENT AUCTION & DINNER", x: 0.5, y: 0.85, fontFamily: "Montserrat", color: "#D4AF37", fontSize: 10 }
      ]
    })
  }
];

module.exports = { newTemplatesDataBackend };
