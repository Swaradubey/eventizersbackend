const prisma = require("../config/prisma");

/**
 * Fetch published event data for public preview rendering (no auth required)
 * GET /api/public/events/:id
 */
const getPublicEvent = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !id.trim()) {
      return res.status(400).json({ success: false, error: "Event ID or slug is required" });
    }

    const cleanId = id.trim();

    // Check if cleanId is a UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

    let event = null;
    if (isUuid) {
      event = await prisma.event.findUnique({
        where: { id: cleanId },
        include: {
          invitation: true,
          rsvpSettings: true,
          designSettings: true,
        },
      });
    } else {
      // Find by shareSlug
      event = await prisma.event.findFirst({
        where: { shareSlug: cleanId },
        include: {
          invitation: true,
          rsvpSettings: true,
          designSettings: true,
        },
      });
    }

    // Fallback: If not found and not a strict UUID, try finding by id as fallback
    if (!event && !isUuid) {
      try {
        event = await prisma.event.findUnique({
          where: { id: cleanId },
          include: {
            invitation: true,
            rsvpSettings: true,
            designSettings: true,
          },
        });
      } catch (_) {}
    }

    if (!event) {
      return res.status(404).json({
        success: false,
        error: "Event not found or has been removed",
      });
    }

    // Format clean event payload
    const formattedEvent = {
      id: event.id,
      title: event.title,
      description: event.description,
      eventType: event.eventType,
      venue: event.venue,
      location: event.location || event.venue,
      address: event.address,
      city: event.city,
      state: event.state,
      country: event.country,
      eventDate: event.eventDate,
      eventTime: event.eventTime,
      hostName: event.hostName,
      coverImage: event.coverImage,
      previewUrl: event.previewUrl,
      selectedTemplateId: event.selectedTemplateId,
      templateData: event.templateData || event.canvasState || null,
      canvasState: event.canvasState || null,
      isPublished: event.isPublished,
      publishedAt: event.publishedAt,
      shareSlug: event.shareSlug,
      shareLink: event.shareLink,
      status: event.status,
    };

    return res.status(200).json({
      success: true,
      event: formattedEvent,
      invitation: event.invitation || null,
      rsvpSettings: event.rsvpSettings || null,
      designSettings: event.designSettings || null,
    });
  } catch (error) {
    console.error("[PublicController] Error fetching public event:", error);
    return res.status(500).json({
      success: false,
      error: "An error occurred while loading the invitation",
      details: error.message,
    });
  }
};

/**
 * Submit RSVP response directly from public invitation page
 * POST /api/public/events/:id/rsvp
 */
const submitPublicRsvp = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      rsvpStatus,
      adultsCount = 1,
      childrenCount = 0,
      additionalGuests = 0,
      dietaryPreference,
      specialDietaryRequests,
    } = req.body || {};

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, error: "Email address is required to submit RSVP" });
    }

    const cleanId = id.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

    let event = null;
    if (isUuid) {
      event = await prisma.event.findUnique({ where: { id: cleanId } });
    } else {
      event = await prisma.event.findFirst({ where: { shareSlug: cleanId } });
    }

    if (!event) {
      return res.status(404).json({ success: false, error: "Event not found" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const guestName = (name && name.trim()) || normalizedEmail.split("@")[0];
    const statusVal = (rsvpStatus || "ATTENDING").toUpperCase();

    // Check if guest already exists
    let guest = await prisma.guest.findFirst({
      where: {
        eventId: event.id,
        email: normalizedEmail,
      },
    });

    if (guest) {
      guest = await prisma.guest.update({
        where: { id: guest.id },
        data: {
          name: guestName,
          rsvpStatus: statusVal,
          status: statusVal.toLowerCase(),
          respondedAt: new Date(),
          adultsCount: Number(adultsCount) || 1,
          childrenCount: Number(childrenCount) || 0,
          additionalGuests: Number(additionalGuests) || 0,
          dietaryPreference: dietaryPreference || null,
          specialDietaryRequests: specialDietaryRequests || null,
        },
      });
    } else {
      guest = await prisma.guest.create({
        data: {
          eventId: event.id,
          name: guestName,
          email: normalizedEmail,
          rsvpStatus: statusVal,
          status: statusVal.toLowerCase(),
          respondedAt: new Date(),
          adultsCount: Number(adultsCount) || 1,
          childrenCount: Number(childrenCount) || 0,
          additionalGuests: Number(additionalGuests) || 0,
          dietaryPreference: dietaryPreference || null,
          specialDietaryRequests: specialDietaryRequests || null,
          isSelected: true,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: `Thank you, ${guestName}! Your RSVP (${statusVal}) has been received.`,
      guest,
    });
  } catch (error) {
    console.error("[PublicController] Error submitting public RSVP:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to submit RSVP. Please try again.",
      details: error.message,
    });
  }
};

module.exports = {
  getPublicEvent,
  submitPublicRsvp,
};
