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
