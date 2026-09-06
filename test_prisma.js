const prisma = require('./src/config/prisma');
async function test() {
  try {
    // We just need any valid eventId and userId. Let's get the first event.
    const event = await prisma.event.findFirst();
    if (!event) {
      console.log("No events found in DB");
      return;
    }
    
    console.log("Testing with event:", event.id, "user:", event.userId);
    
    const result = await prisma.registry.create({
      data: {
        eventId: event.id,
        userId: event.userId,
        type: "GIFT_REGISTRY",
        title: "Test Registry",
        description: null,
        goalAmount: null,
        currentAmount: 0,
        currency: "INR",
        externalUrl: null,
        contributorCount: 0,
        isActive: true,
      },
    });
    console.log("Success:", result);
  } catch (e) {
    console.error("Prisma Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
