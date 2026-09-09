const newTemplatesDataBackend = [
  // 1. Outer Space Odyssey
  {
    id: "tpl-space-odyssey",
    name: "Outer Space Odyssey",
    category: "Birthday",
    isPremium: false,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)",
      accentColor: "#6366F1",
      emoji: "🚀",
      host: "Hosted by The Armstrong Family",
      venue: "Cosmic Discovery Observatory, Seattle",
      description: "Join us as we blast through constellations with starry snacks, rocket ship crafts, and zero-gravity fun!",
      imageUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80",
      backgroundColor: "#0F172A",
      textColor: "#F8FAFC",
      titleSize: 42,
      fontWeight: "700",
      fontFamily: "Playfair Display",
      buttonColor: "#6366F1",
      buttonRadius: 9999,
      textAlignment: "center"
    })
  },

  // 2. Wild Safari Adventure
  {
    id: "tpl-wild-safari",
    name: "Wild Safari Adventure",
    category: "Birthday",
    isPremium: true,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #FEFCE8 0%, #FEF08A 100%)",
      accentColor: "#D97706",
      emoji: "🦁",
      host: "Hosted by The Wilde Family",
      venue: "Savanna Botanical Conservatory, San Diego",
      description: "Grab your explorer hat! We're trekking through the wild with jungle treats, animal encounters, and safari tunes.",
      imageUrl: "https://images.unsplash.com/photo-1534567153574-2b12153a87f0?auto=format&fit=crop&w=800&q=80",
      backgroundColor: "#FFFDF0",
      textColor: "#78350F",
      titleSize: 42,
      fontWeight: "700",
      fontFamily: "Playfair Display",
      buttonColor: "#D97706",
      buttonRadius: 9999,
      textAlignment: "center"
    })
  },

  // 3. Dino Roar Celebration
  {
    id: "tpl-dino-roar",
    name: "Dino Roar Celebration",
    category: "Birthday",
    isPremium: false,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)",
      accentColor: "#16A34A",
      emoji: "🦖",
      host: "Hosted by Leo & Family",
      venue: "Jurassic Nature Pavilion, Austin",
      description: "Stomp, chomp, and roar into another great year! Dig for real fossils and feast on prehistoric pizza.",
      imageUrl: "https://images.unsplash.com/photo-1583212292454-1fe6229603b7?auto=format&fit=crop&w=800&q=80",
      backgroundColor: "#F7FEE7",
      textColor: "#14532D",
      titleSize: 42,
      fontWeight: "700",
      fontFamily: "Playfair Display",
      buttonColor: "#16A34A",
      buttonRadius: 9999,
      textAlignment: "center"
    })
  },

  // 4. Magical Enchanted Garden
  {
    id: "tpl-enchanted-garden",
    name: "Magical Enchanted Garden",
    category: "Birthday",
    isPremium: true,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #FDF2F8 0%, #FCE7F3 100%)",
      accentColor: "#DB2777",
      emoji: "🌸",
      host: "Hosted by The Harpers",
      venue: "Rosewood Secret Garden, Charleston",
      description: "Enter a whimsical floral realm with fairy wings, butterfly treats, tea sandwiches, and enchanted games.",
      imageUrl: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=800&q=80",
      backgroundColor: "#FFF5F7",
      textColor: "#831843",
      titleSize: 42,
      fontWeight: "700",
      fontFamily: "Playfair Display",
      buttonColor: "#DB2777",
      buttonRadius: 9999,
      textAlignment: "center"
    })
  },

  // 5. Circus Carnival Jubilee
  {
    id: "tpl-circus-carnival",
    name: "Circus Carnival Jubilee",
    category: "Birthday",
    isPremium: false,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #FFF1F2 0%, #FFE4E6 100%)",
      accentColor: "#E11D48",
      emoji: "🎪",
      host: "Hosted by The Ringmaster Family",
      venue: "Grand Carnival Lawn & Carousel, Chicago",
      description: "Popcorn, cotton candy, carnival games, and carousel rides! Join us under the big striped tent for boundless fun.",
      imageUrl: "https://images.unsplash.com/photo-1513889961551-628c1e5e2ee9?auto=format&fit=crop&w=800&q=80",
      backgroundColor: "#FFF8F6",
      textColor: "#881337",
      titleSize: 42,
      fontWeight: "700",
      fontFamily: "Playfair Display",
      buttonColor: "#E11D48",
      buttonRadius: 9999,
      textAlignment: "center"
    })
  },

  // 6. Retro Roller Disco Party
  {
    id: "tpl-roller-disco",
    name: "Retro Roller Disco Party",
    category: "Birthday",
    isPremium: true,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%)",
      accentColor: "#9333EA",
      emoji: "🛼",
      host: "Hosted by Maya & Crew",
      venue: "Starlight Roller Rink, Brooklyn",
      description: "Neon lights, glittering disco balls, and retro roller grooves. Skate rental included for all guests!",
      imageUrl: "https://images.unsplash.com/photo-1545128485-c400e7702796?auto=format&fit=crop&w=800&q=80",
      backgroundColor: "#1A102F",
      textColor: "#FAF5FF",
      titleSize: 42,
      fontWeight: "700",
      fontFamily: "Playfair Display",
      buttonColor: "#9333EA",
      buttonRadius: 9999,
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
