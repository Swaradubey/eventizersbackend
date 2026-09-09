const newTemplatesDataBackend = [
  {
    id: "tpl-hype-wave",
    name: "Hype Wave",
    category: "Birthday",
    isPremium: true,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
      accentColor: "#3B82F6",
      emoji: "🌊",
      host: "Hosted by Dylan",
      venue: "Dive In, Bruh",
      description: "It's Dylan's Birthday! Saturday | June 10th | 4 PM.",
      imageUrl: "https://g0.evitecdn.com/templates/fabric_templates/initial/image-1777936540093157807.hype-wave.png",
      backgroundColor: "#EFF6FF",
      textColor: "#1E3A8A",
      titleSize: 42,
      fontWeight: "800",
      fontFamily: "Inter",
      buttonColor: "#3B82F6",
      buttonRadius: 8,
      textAlignment: "center"
    })
  },
  {
    id: "tpl-pawpatrol",
    name: "Paw Patrol: Raise the Woof",
    category: "Birthday",
    isPremium: true,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #0061ae 0%, #004b87 100%)",
      accentColor: "#E11D48",
      emoji: "🐾",
      host: "Hosted by Ryder",
      venue: "The Lookout",
      description: "No job is too big, no pup is too small! Join us for a PAWsome Birthday party.",
      imageUrl: "https://g0.evitecdn.com/templates/fabric_templates/initial/image-1771960444987733327.paramount-0004-pawpatrol-raise-the-woof.jpg",
      backgroundColor: "#0061ae",
      textColor: "#FFFFFF",
      titleSize: 42,
      fontWeight: "800",
      fontFamily: "Inter",
      buttonColor: "#E11D48",
      buttonRadius: 8,
      textAlignment: "center"
    })
  },
  {
    id: "tpl-wedding-classic",
    name: "Classic Romance",
    category: "Wedding",
    isPremium: true,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #FFFFFF 0%, #FDFBF7 100%)",
      accentColor: "#D4AF37",
      emoji: "💍",
      host: "Together with their families",
      venue: "The Grand Plaza Hotel",
      description: "Join us in celebrating the marriage of Olivia & James. Reception to follow.",
      imageUrl: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=800&q=80",
      backgroundColor: "#FFFFFF",
      textColor: "#333333",
      titleSize: 42,
      fontWeight: "400",
      fontFamily: "Playfair Display",
      buttonColor: "#D4AF37",
      buttonRadius: 4,
      textAlignment: "center"
    })
  },
  {
    id: "tpl-wedding-rustic",
    name: "Rustic Charm",
    category: "Wedding",
    isPremium: false,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #FDF8F5 0%, #F4EAE6 100%)",
      accentColor: "#8B5A2B",
      emoji: "🌿",
      host: "Emma & Liam",
      venue: "Pineewood Barn, Colorado",
      description: "We are tying the knot! Dinner, drinks, and dancing under the stars.",
      imageUrl: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&q=80",
      backgroundColor: "#FDF8F5",
      textColor: "#4A4A4A",
      titleSize: 42,
      fontWeight: "600",
      fontFamily: "Lora",
      buttonColor: "#8B5A2B",
      buttonRadius: 8,
      textAlignment: "center"
    })
  },
  {
    id: "tpl-wedding-modern",
    name: "Modern Elegance",
    category: "Wedding",
    isPremium: true,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #1A1A1A 0%, #000000 100%)",
      accentColor: "#FFFFFF",
      emoji: "🥂",
      host: "Sophia & Benjamin",
      venue: "The Modern Art Museum",
      description: "You are invited to our wedding celebration. Black tie optional.",
      imageUrl: "https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=800&q=80",
      backgroundColor: "#1A1A1A",
      textColor: "#FFFFFF",
      titleSize: 42,
      fontWeight: "300",
      fontFamily: "Inter",
      buttonColor: "#FFFFFF",
      buttonRadius: 0,
      textAlignment: "center"
    })
  },
  {
    id: "tpl-wedding-boho",
    name: "Boho Dream",
    category: "Wedding",
    isPremium: true,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #FFF5E1 0%, #FFE4B5 100%)",
      accentColor: "#CD853F",
      emoji: "✨",
      host: "Mia & Noah",
      venue: "Desert Botanical Gardens",
      description: "Let love grow. Join us for a bohemian sunset ceremony.",
      imageUrl: "https://images.unsplash.com/photo-1469371670807-013ccf25f16a?w=800&q=80",
      backgroundColor: "#FFF5E1",
      textColor: "#5C4033",
      titleSize: 42,
      fontWeight: "500",
      fontFamily: "Caveat",
      buttonColor: "#CD853F",
      buttonRadius: 16,
      textAlignment: "center"
    })
  },
  {
    id: "tpl-wedding-beach",
    name: "Beach Bliss",
    category: "Wedding",
    isPremium: false,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #E0F7FA 0%, #B2EBF2 100%)",
      accentColor: "#00838F",
      emoji: "🌊",
      host: "Ava & William",
      venue: "Oceanfront Resort, Maui",
      description: "We're making waves! Join us for a beautiful beachfront wedding.",
      imageUrl: "https://images.unsplash.com/photo-1532712938310-34cb3982ef74?w=800&q=80",
      backgroundColor: "#E0F7FA",
      textColor: "#004D40",
      titleSize: 42,
      fontWeight: "700",
      fontFamily: "Lato",
      buttonColor: "#00838F",
      buttonRadius: 9999,
      textAlignment: "center"
    })
  },
  {
    id: "tpl-fall-foliage",
    name: "Fall Foliage",
    category: "Bridal Shower",
    isPremium: true,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #FFF9F2 0%, #FFF3E6 100%)",
      accentColor: "#8B2323",
      emoji: "🍁",
      host: "Amanda Sharpe",
      venue: "2246 Eucalyptus Drive",
      description: "Please join us for a shower honoring Amanda. See registry info below.",
      imageUrl: "https://g0.evitecdn.com/templates/fabric_templates/initial/image-1755560605642499893.fall-foliage.png",
      backgroundColor: "#FFFFFF",
      textColor: "#8B2323",
      titleSize: 42,
      fontWeight: "400",
      fontFamily: "Playfair Display",
      buttonColor: "#8B2323",
      buttonRadius: 0,
      textAlignment: "center"
    })
  }
];

const newTemplateStylesBackend = newTemplatesDataBackend.reduce((acc, t) => {
  const content = JSON.parse(t.content);
  acc[t.id] = {
    imageUrl: content.imageUrl,
    accentColor: content.accentColor,
    backgroundColor: content.backgroundColor,
    textColor: content.textColor,
    titleSize: content.titleSize,
    fontWeight: content.fontWeight,
    fontFamily: content.fontFamily,
    buttonColor: content.buttonColor,
    buttonRadius: content.buttonRadius,
    textAlignment: content.textAlignment
  };
  return acc;
}, {});

module.exports = {
  newTemplatesDataBackend,
  newTemplateStylesBackend
};
