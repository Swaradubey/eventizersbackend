const settingsService = require("../services/settings.service");

/**
 * GET /api/admin/settings/profile
 */
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await settingsService.getProfile(userId);
    return res.status(200).json({ success: true, data: profile });
  } catch (error) {
    console.error("Get Profile Error:", error);
    return res.status(500).json({ success: false, error: "Failed to retrieve profile settings." });
  }
};

/**
 * PUT /api/admin/settings/profile
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fullName, email, organization, profileImage } = req.body;

    if (!fullName || !email) {
      return res.status(400).json({ success: false, error: "Full Name and Email are required." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim().toLowerCase())) {
      return res.status(400).json({ success: false, error: "Invalid email format." });
    }

    const updated = await settingsService.updateProfile(userId, {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      organization: organization ? organization.trim() : "",
      profileImage: profileImage ? profileImage.trim() : "",
    });

    return res.status(200).json({ success: true, data: updated, message: "Profile updated successfully." });
  } catch (error) {
    console.error("Update Profile Error:", error);
    return res.status(500).json({ success: false, error: "Failed to update profile settings." });
  }
};

/**
 * GET /api/admin/settings/notifications
 */
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = await settingsService.getNotifications(userId);
    return res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    console.error("Get Notifications Error:", error);
    return res.status(500).json({ success: false, error: "Failed to retrieve notification settings." });
  }
};

/**
 * PUT /api/admin/settings/notifications
 */
const updateNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { rsvpResponses, eventReminders, securityAlerts, weeklySummary, productUpdates } = req.body;

    const updated = await settingsService.updateNotifications(userId, {
      rsvpResponses: !!rsvpResponses,
      eventReminders: !!eventReminders,
      securityAlerts: !!securityAlerts,
      weeklySummary: !!weeklySummary,
      productUpdates: !!productUpdates,
    });

    return res.status(200).json({ success: true, data: updated, message: "Notification settings updated." });
  } catch (error) {
    console.error("Update Notifications Error:", error);
    return res.status(500).json({ success: false, error: "Failed to update notification settings." });
  }
};

/**
 * GET /api/admin/settings/security
 */
const getSecurity = async (req, res) => {
  try {
    const userId = req.user.id;
    const security = await settingsService.getSecurity(userId);
    return res.status(200).json({ success: true, data: security });
  } catch (error) {
    console.error("Get Security Error:", error);
    return res.status(500).json({ success: false, error: "Failed to retrieve security settings." });
  }
};

/**
 * PUT /api/admin/settings/security
 */
const updateSecurity = async (req, res) => {
  try {
    const userId = req.user.id;
    const { twoFactorAuth, publicProfile, dataSharing } = req.body;

    const updated = await settingsService.updateSecurity(userId, {
      twoFactorAuth: !!twoFactorAuth,
      publicProfile: !!publicProfile,
      dataSharing: !!dataSharing,
    });

    return res.status(200).json({ success: true, data: updated, message: "Security settings updated." });
  } catch (error) {
    console.error("Update Security Error:", error);
    return res.status(500).json({ success: false, error: "Failed to update security settings." });
  }
};

/**
 * POST /api/admin/settings/change-password
 */
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, error: "All password fields are required." });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, error: "New password and confirmation do not match." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: "New password must be at least 6 characters long." });
    }

    await settingsService.changePassword(userId, currentPassword, newPassword);
    return res.status(200).json({ success: true, message: "Password updated successfully." });
  } catch (error) {
    console.error("Change Password Error:", error);
    if (error.message === "Incorrect current password" || error.message === "User not found") {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: "Failed to update password." });
  }
};

/**
 * GET /api/admin/settings/team
 */
const getTeam = async (req, res) => {
  try {
    const userId = req.user.id;
    const team = await settingsService.getTeamMembers(userId);
    return res.status(200).json({ success: true, data: team });
  } catch (error) {
    console.error("Get Team Error:", error);
    return res.status(500).json({ success: false, error: "Failed to retrieve team members." });
  }
};

/**
 * POST /api/admin/settings/team
 */
const addTeamMember = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, role, status } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, error: "Name and Email are required." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim().toLowerCase())) {
      return res.status(400).json({ success: false, error: "Invalid email format." });
    }

    const newMember = await settingsService.addTeamMember(userId, {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: role || "Member",
      status: status || "active",
    });

    return res.status(201).json({ success: true, data: newMember, message: "Team member added successfully." });
  } catch (error) {
    console.error("Add Team Member Error:", error);
    if (error.code === "P2002") {
      return res.status(400).json({ success: false, error: "A team member with this email already exists." });
    }
    return res.status(500).json({ success: false, error: "Failed to add team member." });
  }
};

/**
 * PUT /api/admin/settings/team/:id
 */
const updateTeamMember = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, email, role, status } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, error: "Name and Email are required." });
    }

    const updated = await settingsService.updateTeamMember(userId, id, {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      status,
    });

    return res.status(200).json({ success: true, data: updated, message: "Team member updated successfully." });
  } catch (error) {
    console.error("Update Team Member Error:", error);
    if (error.message === "Team member not found or unauthorized") {
      return res.status(404).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: "Failed to update team member." });
  }
};

/**
 * DELETE /api/admin/settings/team/:id
 */
const removeTeamMember = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    await settingsService.removeTeamMember(userId, id);
    return res.status(200).json({ success: true, message: "Team member removed successfully." });
  } catch (error) {
    console.error("Remove Team Member Error:", error);
    if (error.message === "Team member not found or unauthorized") {
      return res.status(404).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: "Failed to remove team member." });
  }
};

/**
 * GET /api/admin/settings/preferences
 */
const getPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const preferences = await settingsService.getPreferences(userId);
    return res.status(200).json({ success: true, data: preferences });
  } catch (error) {
    console.error("Get Preferences Error:", error);
    return res.status(500).json({ success: false, error: "Failed to retrieve preferences." });
  }
};

/**
 * PUT /api/admin/settings/preferences
 */
const updatePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const { theme, language, timezone, dateFormat, timeFormat } = req.body;

    const updated = await settingsService.updatePreferences(userId, {
      theme: theme || "light",
      language: language || "en",
      timezone: timezone || "UTC",
      dateFormat: dateFormat || "YYYY-MM-DD",
      timeFormat: timeFormat || "24h",
    });

    return res.status(200).json({ success: true, data: updated, message: "Preferences updated successfully." });
  } catch (error) {
    console.error("Update Preferences Error:", error);
    return res.status(500).json({ success: false, error: "Failed to update preferences." });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getNotifications,
  updateNotifications,
  getSecurity,
  updateSecurity,
  changePassword,
  getTeam,
  addTeamMember,
  updateTeamMember,
  removeTeamMember,
  getPreferences,
  updatePreferences,
};
