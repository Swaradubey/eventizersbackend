const prisma = require("../config/prisma");
const bcrypt = require("bcryptjs");

/**
 * Get profile settings for an admin user.
 */
const getProfile = async (userId) => {
  const profile = await prisma.adminProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (user) {
      return {
        fullName: user.name,
        email: user.email,
        organization: "",
        profileImage: "",
      };
    }
    return {
      fullName: "",
      email: "",
      organization: "",
      profileImage: "",
    };
  }

  return {
    fullName: profile.fullName,
    email: profile.email,
    organization: profile.organization || "",
    profileImage: profile.profileImage || "",
  };
};

/**
 * Update/upsert profile settings for an admin.
 */
const updateProfile = async (userId, data) => {
  const { fullName, email, organization, profileImage } = data;
  return await prisma.adminProfile.upsert({
    where: { userId },
    update: {
      fullName,
      email,
      organization,
      profileImage,
    },
    create: {
      userId,
      fullName,
      email,
      organization,
      profileImage,
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
};
