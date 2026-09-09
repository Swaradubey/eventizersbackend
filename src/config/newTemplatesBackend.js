const newTemplatesDataBackend = [
  {
    id: "tpl-neon-splash",
    name: "Neon Splash",
    category: "Birthday",
    isPremium: true,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #000000 0%, #111111 100%)",
      accentColor: "#39FF14",
      emoji: "🎨",
      host: "Hosted by Seth Ritter",
      venue: "50 Chestnut St.",
      description: "Join us for pizza, games & cake to celebrate Bruh it's my 10th Birthday!",
      imageUrl: "https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80",
      backgroundColor: "#000000",
      textColor: "#FFFFFF",
      titleSize: 42,
      fontWeight: "900",
      fontFamily: "Inter",
      buttonColor: "#39FF14",
      buttonRadius: 8,
      textAlignment: "center"
    })
  },
  {
    id: "tpl-glow-swimming",
    name: "Let's Glow Swimming",
    category: "Birthday",
    isPremium: true,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #A78BFA 0%, #F472B6 100%)",
      accentColor: "#F472B6",
      emoji: "🏊",
      host: "Celebrating Carter & Noah's Birthday",
      venue: "1840 Meadowbrook Ave",
      description: "Come splash and swim at a Pool Party! July 17th at 1 PM.",
      imageUrl: "https://images.unsplash.com/photo-1576610616656-d3aa5d1f4534?w=800&q=80",
      backgroundColor: "#FDF4FF",
      textColor: "#831843",
      titleSize: 42,
      fontWeight: "800",
      fontFamily: "Inter",
      buttonColor: "#F472B6",
      buttonRadius: 8,
      textAlignment: "center"
    })
  },
  {
    id: "tpl-spiderman",
    name: "Marvel's Spider-Man: Swinging Webs",
    category: "Birthday",
    isPremium: true,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #DC2626 0%, #991B1B 100%)",
      accentColor: "#DC2626",
      emoji: "🕷️",
      host: "Hosted by Owen",
      venue: "1020 Web Way",
      description: "Swing on over to celebrate Owen's 7th Birthday! Sunday, July 14th at 2 PM.",
      imageUrl: "https://images.unsplash.com/photo-1608889825103-eb5ed706fc64?w=800&q=80",
      backgroundColor: "#171717",
      textColor: "#FFFFFF",
      titleSize: 42,
      fontWeight: "900",
      fontFamily: "Inter",
      buttonColor: "#DC2626",
      buttonRadius: 8,
      textAlignment: "center"
    })
  },
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
      imageUrl: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?w=800&q=80",
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
    id: "tpl-playful-polka",
    name: "Playful Polka (Photo)",
    category: "Birthday",
    isPremium: true,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #FFFFFF 0%, #F3F4F6 100%)",
      accentColor: "#F59E0B",
      emoji: "🎈",
      host: "Hosted by Sophie",
      venue: "Sophie's Backyard",
      description: "Let's party! You're invited to celebrate Sophie's Birthday.",
      imageUrl: "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&q=80",
      backgroundColor: "#FFFFFF",
      textColor: "#4B5563",
      titleSize: 42,
      fontWeight: "700",
      fontFamily: "Inter",
      buttonColor: "#F59E0B",
      buttonRadius: 8,
      textAlignment: "center"
    })
  },
  {
    id: "tpl-sugar-soiree",
    name: "Sugar Soiree",
    category: "Birthday",
    isPremium: true,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #FCE7F3 0%, #FBCFE8 100%)",
      accentColor: "#EC4899",
      emoji: "🧁",
      host: "Hosted by Emily",
      venue: "The Johnson Home, Pasadena, CA",
      description: "Come on over to celebrate Emily's Birthday! Saturday, April 30th at 11 O'Clock.",
      imageUrl: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800&q=80",
      backgroundColor: "#FFF1F2",
      textColor: "#9F1239",
      titleSize: 42,
      fontWeight: "700",
      fontFamily: "Inter",
      buttonColor: "#EC4899",
      buttonRadius: 8,
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
