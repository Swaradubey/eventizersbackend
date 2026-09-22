const newTemplatesDataBackend = [
  {
    id: "tpl-chicory-whispers",
    name: "Chicory Whispers",
    category: "Bridal Shower",
    isPremium: true,
    content: JSON.stringify({
      thumbnailUrl: "assets/templates/chicory_whispers_scene.jpg",
      imageUrl: "assets/templates/chicory_whispers_scene.jpg",
      emoji: "💙",
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
    id: "tpl-pumpkin-petals",
    name: "Pumpkin & Petals",
    category: "Bridal Shower",
    isPremium: true,
    content: JSON.stringify({
      thumbnailUrl: "assets/templates/pumpkin_petals_full_scene.jpg",
      imageUrl: "assets/templates/pumpkin_petals_card.jpg",
      emoji: "🎃",
      textElements: [
        { id: "subhdr", text: "Fall in love", x: 0.5, y: 0.35, fontFamily: "Great Vibes", color: "#BE7832", fontSize: 34 },
        { id: "hdr", text: "JOIN US FOR A BRIDAL SHOWER\nHONORING", x: 0.5, y: 0.44, fontFamily: "Montserrat", color: "#BE7832", fontSize: 11 },
        { id: "name", text: "Silvia Stewart", x: 0.5, y: 0.53, fontFamily: "Playfair Display", color: "#BE7832", fontSize: 26 },
        { id: "date", text: "SATURDAY, OCTOBER 5TH AT 2 PM", x: 0.5, y: 0.61, fontFamily: "Playfair Display", color: "#BE7832", fontSize: 10 },
        { id: "venue", text: "THE ANDERSON HOME", x: 0.5, y: 0.65, fontFamily: "Playfair Display", color: "#BE7832", fontSize: 10 },
        { id: "address", text: "819 MAIN ST. VISTA, CA", x: 0.5, y: 0.69, fontFamily: "Playfair Display", color: "#BE7832", fontSize: 10 }
      ]
    })
  }
];

module.exports = { newTemplatesDataBackend };