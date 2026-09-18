const prisma = require("../config/prisma");
const bcrypt = require("bcryptjs");

/**
 * Get profile settings for an admin user.
 */
const getProfile = async (userId) => {
  const profile = await prisma.adminProfile.findUnique({
    where: { userId },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!profile) {
    if (user) {
      return {
        fullName: user.name || "",
        name: user.name || "",
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
        phone: user.phoneNumber || "",
        organization: "",
        profileImage: "",
      };
    }
    return {
      fullName: "",
      name: "",
      email: "",
      phoneNumber: "",
      phone: "",
      organization: "",
      profileImage: "",
    };
  }

  return {
    fullName: profile.fullName || user?.name || "",
    name: profile.fullName || user?.name || "",
    email: profile.email || user?.email || "",
    phoneNumber: user?.phoneNumber || "",
    phone: user?.phoneNumber || "",
    organization: profile.organization || "",
    profileImage: profile.profileImage || "",
  };
};

/**
 * Update/upsert profile settings for an admin.
 */
const updateProfile = async (userId, data) => {
  const { fullName, name, email, organization, profileImage, phoneNumber, phone } = data;
  const resolvedName = (fullName || name || "").trim();
  const resolvedPhone = phoneNumber !== undefined ? phoneNumber : phone;

  if (resolvedPhone !== undefined || resolvedName) {
    const userUpdateData = {};
    if (resolvedName) userUpdateData.name = resolvedName;
    if (resolvedPhone !== undefined) userUpdateData.phoneNumber = resolvedPhone ? String(resolvedPhone).trim() : null;
    await prisma.user.update({
      where: { id: userId },
      data: userUpdateData,
    }).catch((err) => console.warn("[SettingsService] User table phone/name update skipped:", err.message));
  }

  return await prisma.adminProfile.upsert({
    where: { userId },
    update: {
      fullName: resolvedName,
      email: (email || "").trim().toLowerCase(),
      organization: organization ? organization.trim() : "",
      profileImage: profileImage !== undefined ? profileImage : undefined,
    },
    create: {
      userId,
      fullName: resolvedName,
      email: (email || "").trim().toLowerCase(),
      organization: organization ? organization.trim() : "",
      profileImage: profileImage || "",
    },
  });
};

/**
 * Get notification settings for an admin user.
 */
const getNotifications = async (userId) => {
  let settings = await prisma.adminNotificationSettings.findUnique({
    where: { userId },
  });

  if (!settings) {
    settings = await prisma.adminNotificationSettings.create({
      data: { userId },
    });
  }

  return {
    rsvpResponses: settings.rsvpResponses,
    eventReminders: settings.eventReminders,
    securityAlerts: settings.securityAlerts,
    weeklySummary: settings.weeklySummary,
    productUpdates: settings.productUpdates,
  };
};

/**
 * Update/upsert notification settings for an admin.
 */
const updateNotifications = async (userId, data) => {
  return await prisma.adminNotificationSettings.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
};

/**
 * Get security settings for an admin user.
 */
const getSecurity = async (userId) => {
  let settings = await prisma.adminSecuritySettings.findUnique({
    where: { userId },
  });

  if (!settings) {
    settings = await prisma.adminSecuritySettings.create({
      data: { userId },
    });
  }

  return {
    twoFactorAuth: settings.twoFactorAuth,
    publicProfile: settings.publicProfile,
    dataSharing: settings.dataSharing,
  };
};

/**
 * Update/upsert security settings for an admin.
 */
const updateSecurity = async (userId, data) => {
  return await prisma.adminSecuritySettings.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
};

/**
 * Change admin user password.
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    throw new Error("Incorrect current password");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  return { success: true };
};

/**
 * Get team members invited/managed by this admin.
 */
const getTeamMembers = async (invitedById) => {
  return await prisma.adminTeamMember.findMany({
    where: { invitedById },
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Invite/Add a team member.
 */
const addTeamMember = async (invitedById, data) => {
  const { name, email, role, status } = data;
  return await prisma.adminTeamMember.create({
    data: {
      name,
      email,
      role,
      status: status || "active",
      invitedById,
    },
  });
};

/**
 * Update a team member's role or details.
 */
const updateTeamMember = async (invitedById, id, data) => {
  const member = await prisma.adminTeamMember.findUnique({
    where: { id },
  });

  if (!member || member.invitedById !== invitedById) {
    throw new Error("Team member not found or unauthorized");
  }

  const { name, email, role, status } = data;
  return await prisma.adminTeamMember.update({
    where: { id },
    data: {
      name,
      email,
      role,
      status,
    },
  });
};

/**
 * Delete/Remove a team member.
 */
const removeTeamMember = async (invitedById, id) => {
  const member = await prisma.adminTeamMember.findUnique({
    where: { id },
  });

  if (!member || member.invitedById !== invitedById) {
    throw new Error("Team member not found or unauthorized");
  }

  return await prisma.adminTeamMember.delete({
    where: { id },
  });
};

/**
 * Get preferences for an admin.
 */
const getPreferences = async (userId) => {
  let prefs = await prisma.adminPreferences.findUnique({
    where: { userId },
  });

  if (!prefs) {
    prefs = await prisma.adminPreferences.create({
      data: { userId },
    });
  }

  return {
    theme: prefs.theme,
    language: prefs.language,
    timezone: prefs.timezone,
    dateFormat: prefs.dateFormat,
    timeFormat: prefs.timeFormat,
  };
};

/**
 * Update/upsert preferences for an admin.
 */
const updatePreferences = async (userId, data) => {
  return await prisma.adminPreferences.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
};

/**
 * Permanently delete ONLY the requesting user's account and their own data.
 */
const deleteAccount = async (userId) => {
  const numericUserId = parseInt(userId, 10);
  if (isNaN(numericUserId)) {
    throw new Error("Invalid user ID");
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Fetch all event IDs created by this user
    const userEvents = await tx.event.findMany({
      where: { createdBy: numericUserId },
      select: { id: true },
    });
    const userEventIds = userEvents.map((e) => e.id);

    // 2. Fetch all ticket orders linked to user's events OR created by this user
    const userOrders = await tx.ticketOrder.findMany({
      where: {
        OR: [
          { userId: numericUserId },
          { eventId: { in: userEventIds } },
        ],
      },
      select: { id: true },
    });
    const userOrderIds = userOrders.map((o) => o.id);

    // 3. Delete ticket order items first to satisfy foreign key constraint on ticket_orders
    if (userOrderIds.length > 0) {
      await tx.ticketOrderItem.deleteMany({
        where: { orderId: { in: userOrderIds } },
      });
      await tx.ticketOrder.deleteMany({
        where: { id: { in: userOrderIds } },
      });
    }

    // 4. Delete all child records belonging to user's events
    if (userEventIds.length > 0) {
      await tx.checkIn.deleteMany({ where: { eventId: { in: userEventIds } } });
      await tx.guest.deleteMany({ where: { eventId: { in: userEventIds } } });
      await tx.invitation.deleteMany({ where: { eventId: { in: userEventIds } } });
      await tx.ticketTier.deleteMany({ where: { eventId: { in: userEventIds } } });
      await tx.message.deleteMany({ where: { eventId: { in: userEventIds } } });
      await tx.registry.deleteMany({ where: { eventId: { in: userEventIds } } });
      await tx.rsvpSettings.deleteMany({ where: { eventId: { in: userEventIds } } });
      await tx.designSettings.deleteMany({ where: { eventId: { in: userEventIds } } });
      await tx.stationeryDesign.deleteMany({ where: { eventId: { in: userEventIds } } });
      await tx.customDomainSettings.deleteMany({ where: { eventId: { in: userEventIds } } });
      await tx.auditLog.deleteMany({ where: { eventId: { in: userEventIds } } });

      // Delete the events created by this user
      await tx.event.deleteMany({
        where: { id: { in: userEventIds } },
      });
    }

    // 5. Delete user-level settings & profile records
    await tx.adminProfile.deleteMany({ where: { userId: numericUserId } });
    await tx.adminNotificationSettings.deleteMany({ where: { userId: numericUserId } });
    await tx.adminSecuritySettings.deleteMany({ where: { userId: numericUserId } });
    await tx.adminPreferences.deleteMany({ where: { userId: numericUserId } });
    await tx.adminTeamMember.deleteMany({ where: { userId: numericUserId } });
    await tx.adminTeamMember.deleteMany({ where: { invitedById: numericUserId } });
    await tx.attendanceGuaranteeSetting.deleteMany({ where: { userId: numericUserId } });
    await tx.guestGroup.deleteMany({ where: { userId: numericUserId } });
    await tx.message.deleteMany({ where: { senderId: numericUserId } });
    await tx.registry.deleteMany({ where: { createdBy: numericUserId } });

    // 6. Delete the User record
    return await tx.user.delete({
      where: { id: numericUserId },
    });
  });
};

module.exports = {
  getProfile,
  updateProfile,
  getNotifications,
  updateNotifications,
  getSecurity,
  updateSecurity,
  changePassword,
  getTeamMembers,
  addTeamMember,
  updateTeamMember,
  removeTeamMember,
  getPreferences,
  updatePreferences,
  deleteAccount,
};
