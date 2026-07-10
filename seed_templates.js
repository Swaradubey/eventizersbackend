const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const templatesData = [
  {
    id: "tpl-birthday-maya",
    name: "Maya's 5th Birthday",
    category: "Birthday",
    isPremium: false,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #f9c5d1 0%, #f5a7b8 100%)",
      accentColor: "#e07090",
      emoji: "🎂",
      host: "Hosted by The Patels",
      venue: "Sweet Retreat Bakery",
      description: "Come celebrate Maya's 5th birthday with cupcakes, games, and lots of fun!"
    })
  },
  {
    id: "tpl-wedding-liam",
    name: "Liam & Sofia Wedding",
    category: "Wedding",
    isPremium: true,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #d4b8e8 0%, #b8a0d4 100%)",
      accentColor: "#9070c0",
      emoji: "💍",
      host: "Together with their families",
      venue: "Vineyard Estate",
      description: "Join us in celebrating the love and marriage of Liam and Sofia."
    })
  },
  {
    id: "tpl-corporate-launch",
    name: "Annual Product Launch",
    category: "Corporate",
    isPremium: false,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #a8c8e8 0%, #80a8d0 100%)",
      accentColor: "#4080b0",
      emoji: "🚀",
      host: "Northwind Technologies",
      venue: "The Innovation Hub",
      description: "Be the first to see our next generation of software products and network with industry leaders."
    })
  },
  {
    id: "tpl-dinner-party",
    name: "Supper Club No. 7",
    category: "Dinner Party",
    isPremium: false,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #d4c8a0 0%, #c0b080 100%)",
      accentColor: "#907030",
      emoji: "🍽️",
      host: "Hosted by Chef Amara",
      venue: "Chef's Table Lounge",
      description: "An intimate evening of gourmet dining, fine wine, and great conversation."
    })
  },
  {
    id: "tpl-baby-shower",
    name: "A Little One is Coming",
    category: "Baby Shower",
    isPremium: false,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #c8e8c8 0%, #a8d0a8 100%)",
      accentColor: "#4a9a4a",
      emoji: "🍼",
      host: "Celebrating Baby Reyes",
      venue: "Garden Terrace",
      description: "A sweet baby shower to celebrate the upcoming arrival of the new baby!"
    })
  },
  {
    id: "tpl-charity-gala",
    name: "Bright Futures Gala",
    category: "Charity Gala",
    isPremium: true,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #c9a84c 0%, #a07820 100%)",
      accentColor: "#a07820",
      emoji: "✨",
      host: "Bright Futures Foundation",
      venue: "Grand Ballroom",
      description: "An elegant charity gala raising funds for education and youth empowerment."
    })
  },
  {
    id: "tpl-live-music",
    name: "Rooftop Sessions",
    category: "Live Music",
    isPremium: false,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #2D1B3D 0%, #4a2a6a 100%)",
      accentColor: "#9970d0",
      emoji: "🎵",
      host: "Presented by Echo Collective",
      venue: "Skyline Loft",
      description: "An evening of live music, delicious drinks, and views of the city skyline."
    })
  },
  {
    id: "tpl-anniversary-james",
    name: "25 Years Together",
    category: "Anniversary",
    isPremium: false,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #e8c4b8 0%, #d0a090 100%)",
      accentColor: "#c06840",
      emoji: "🥂",
      host: "Celebrating James & Elena",
      venue: "Lakeside Manor",
      description: "Please join us in celebrating the 25th wedding anniversary of James and Elena."
    })
  },
  {
    id: "tpl-grad-gala",
    name: "Graduation Gala",
    category: "Graduation",
    isPremium: true,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
      accentColor: "#d4af37",
      emoji: "🎓",
      host: "Hosted by The Office of the Dean",
      venue: "University Grand Hall",
      description: "Join us for an elegant evening of celebration and dining to honor the outstanding accomplishments of our graduating class."
    })
  },
  {
    id: "tpl-grad-class2026",
    name: "Class of 2026 Celebration",
    category: "Graduation",
    isPremium: true,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #f39c12 0%, #d35400 100%)",
      accentColor: "#e67e22",
      emoji: "🥂",
      host: "Hosted by The Senior Class Committee",
      venue: "Sunset Terrace Garden",
      description: "Raise a glass to the memories we've shared and the bright futures ahead of the class of 2026!"
    })
  },
  {
    id: "tpl-grad-degree",
    name: "Degree Award Ceremony",
    category: "Graduation",
    isPremium: true,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
      accentColor: "#1abc9c",
      emoji: "📜",
      host: "Faculty of Science and Arts",
      venue: "Main Auditorium",
      description: "You are cordially invited to witness the formal conferring of degrees and academic achievements."
    })
  },
  {
    id: "tpl-comm-meetup",
    name: "Community Meetup",
    category: "Community",
    isPremium: true,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
      accentColor: "#11998e",
      emoji: "🏡",
      host: "Oakwood Neighborhood Association",
      venue: "Oakwood Community Park",
      description: "Connect with your neighbors for a lovely afternoon of conversation, sharing local updates, and outdoor fun."
    })
  },
  {
    id: "tpl-comm-celebration",
    name: "Neighbourhood Celebration",
    category: "Community",
    isPremium: true,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #ff9966 0%, #ff5e62 100%)",
      accentColor: "#ff5e62",
      emoji: "🎈",
      host: "Maple Street Neighbors",
      venue: "Maple Street Block",
      description: "Join us for our annual block party! Expect live music, potluck tables, and games for all ages."
    })
  },
  {
    id: "tpl-comm-volunteer",
    name: "Volunteer Appreciation Event",
    category: "Community",
    isPremium: true,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #ffc3a0 0%, #ffafbd 100%)",
      accentColor: "#e91e63",
      emoji: "💖",
      host: "Helping Hands Coalition",
      venue: "Unity Civic Center",
      description: "To the volunteers who make a difference: this evening is all about celebrating and thanking you."
    })
  },
  {
    id: "tpl-net-professional",
    name: "Professional Networking Evening",
    category: "Networking",
    isPremium: true,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #2b5876 0%, #4e4376 100%)",
      accentColor: "#6f86d6",
      emoji: "🤝",
      host: "Metro Business Alliance",
      venue: "The Summit Boardroom",
      description: "Expand your network and share industry insights with leading professionals and executives in a relaxed setting."
    })
  },
  {
    id: "tpl-net-founders",
    name: "Founders & Creators Meetup",
    category: "Networking",
    isPremium: true,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #141e30 0%, #243b55 100%)",
      accentColor: "#00c6ff",
      emoji: "💡",
      host: "Launchpad Tech Hub",
      venue: "Co-Work Innovation space",
      description: "A gathering of minds for startup founders, product creators, and innovators. Let's discuss ideas, challenges, and collaborations."
    })
  },
  {
    id: "tpl-net-connections",
    name: "Business Connections Night",
    category: "Networking",
    isPremium: true,
    content: JSON.stringify({
      gradient: "linear-gradient(135deg, #3a7bd5 0%, #3a6073 100%)",
      accentColor: "#3a7bd5",
      emoji: "📈",
      host: "Chamber of Commerce",
      venue: "Downtown Sky Lounge",
      description: "Join local entrepreneurs and business owners to build meaningful connections, explore opportunities, and grow together."
    })
  }
];

async function seed() {
  console.log("Starting to seed templates database...");
  try {
    for (const t of templatesData) {
      await prisma.template.upsert({
        where: { id: t.id },
        update: {
          name: t.name,
          category: t.category,
          content: t.content,
          isPremium: t.isPremium
        },
        create: {
          id: t.id,
          name: t.name,
          category: t.category,
          content: t.content,
          isPremium: t.isPremium
        }
      });
      console.log(`Upserted template: ${t.name}`);
    }
    console.log("Seeding templates completed successfully.");
  } catch (err) {
    console.error("Seeding templates failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
