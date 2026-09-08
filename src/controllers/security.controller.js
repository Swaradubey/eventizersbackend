const prisma = require("../config/prisma");
const db = require("../config/db");
const { createAuditLog } = require("../utils/auditLogger");
const eventService = require("../services/event.service");

/**
 * Get security dashboard statistics, alerts, and audit logs for the authenticated user
 * GET /api/security/dashboard
 */
const getSecurityDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Fetch user's events to verify ownership structure
    const userEvents = await prisma.event.findMany({
      where: {
        createdBy: userId,
      },
      select: {
        id: true,
      },
    });

    const eventIds = userEvents.map((evt) => evt.id);

    // If user has no events, return empty arrays and perfect score of 100
    if (eventIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          stats: {
            activeAlerts: 0,
            duplicateTickets: 0,
            failedVerifications: 0,
            securityScore: 100,
          },
          alerts: [],
          auditLogs: [],
        },
      });
    }

    // Log the "SECURITY_PAGE_VIEWED" action in the audit log for the user's first event
    await createAuditLog({
      userId,
      action: "SECURITY_PAGE_VIEWED",
      eventId: eventIds[0],
    });

    // 2. Fetch security alerts belonging to user's events
    const alerts = await prisma.securityAlert.findMany({
      where: {
        eventId: {
          in: eventIds,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    // 3. Fetch audit logs belonging to user's events
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        eventId: {
          in: eventIds,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    // 4. Calculate Stats
    // Active alerts are unresolved alerts
    const activeAlertsCount = alerts.filter((a) => !a.isResolved).length;

    // Duplicate tickets count
    const duplicateTicketsCount = alerts.filter(
      (a) => a.type === "DUPLICATE_TICKET"
    ).length;

    // Failed verifications count (from SecurityAlert table representing verification issues)
    const failedVerificationsCount = alerts.filter(
      (a) => a.type === "VERIFICATION_FAILED"
    ).length;

    // Calculate Security Score
    let activeHighAlerts = 0;
    let activeMediumAlerts = 0;
    let activeLowAlerts = 0;

    alerts.forEach((alert) => {
      if (!alert.isResolved) {
        const severity = alert.severity?.toUpperCase();
        if (severity === "HIGH") {
          activeHighAlerts++;
        } else if (severity === "MEDIUM") {
          activeMediumAlerts++;
        } else {
          activeLowAlerts++;
        }
      }
    });

    let securityScore = 100;
    securityScore -= activeHighAlerts * 15;
    securityScore -= activeMediumAlerts * 8;
    securityScore -= activeLowAlerts * 3;
    securityScore -= failedVerificationsCount * 2;

    // Clamp score between 0 and 100
    securityScore = Math.max(0, Math.min(100, securityScore));

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          activeAlerts: activeAlertsCount,
          duplicateTickets: duplicateTicketsCount,
          failedVerifications: failedVerificationsCount,
          securityScore: securityScore,
        },
        alerts,
        auditLogs,
      },
    });
  } catch (error) {
    console.error("Get Security Dashboard Error:", error);
    return res.status(500).json({
      success: false,
      error: "Server error retrieving security information.",
    });
  }
};

/**
 * Delete an audit log entry
 * DELETE /api/security/audit-logs/:id
 */
const deleteAuditLog = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify the audit log exists and belongs to the logged-in user's events
    const auditLog = await prisma.auditLog.findUnique({
      where: { id },
      include: {
        event: {
          select: {
            createdBy: true,
          },
        },
      },
    });

    if (!auditLog) {
      return res.status(404).json({
        success: false,
        error: "Audit log not found",
      });
    }

    if (auditLog.event.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        error: "Access Denied. You do not own this audit log.",
      });
    }

    // Delete the audit log
    await prisma.auditLog.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Audit log deleted successfully",
    });
  } catch (error) {
    console.error("Delete Audit Log Error:", error);
    return res.status(500).json({
      success: false,
      error: "Server error deleting audit log.",
    });
  }
};

/**
 * Get security summary statistics (counts and score)
 * GET /api/security/summary
 */
const getSecuritySummary = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Fetch user's events to verify ownership structure
    const userEvents = await prisma.event.findMany({
      where: {
        createdBy: userId,
      },
      select: {
        id: true,
      },
    });

    const eventIds = userEvents.map((evt) => evt.id);

    // If user has no events, return empty summary
    if (eventIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          activeAlerts: 0,
          duplicateTickets: 0,
          failedVerifications: 0,
          securityScore: 100,
          recentLogs: 0,
        },
      });
    }

    // Log the "SECURITY_PAGE_VIEWED" action in the audit log for the user's first event
    await createAuditLog({
      userId,
      action: "SECURITY_PAGE_VIEWED",
      eventId: eventIds[0],
    });

    // 2. Fetch security alerts belonging to user's events
    const alerts = await prisma.securityAlert.findMany({
      where: {
        eventId: {
          in: eventIds,
        },
      },
    });

    // 3. Fetch audit logs count
    const auditLogsCount = await prisma.auditLog.count({
      where: {
        eventId: {
          in: eventIds,
        },
      },
    });

    // Calculate stats
    const activeAlertsCount = alerts.filter((a) => !a.isResolved).length;

    const duplicateTicketsCount = alerts.filter(
      (a) => a.type === "DUPLICATE_TICKET"
    ).length;

    const failedVerificationsCount = alerts.filter(
      (a) => a.type === "VERIFICATION_FAILED"
    ).length;

    // Calculate Security Score
    let activeHighAlerts = 0;
    let activeMediumAlerts = 0;
    let activeLowAlerts = 0;

    alerts.forEach((alert) => {
      if (!alert.isResolved) {
        const severity = alert.severity?.toUpperCase();
        if (severity === "HIGH") {
          activeHighAlerts++;
        } else if (severity === "MEDIUM") {
          activeMediumAlerts++;
        } else {
          activeLowAlerts++;
        }
      }
    });

    let securityScore = 100;
    securityScore -= activeHighAlerts * 15;
    securityScore -= activeMediumAlerts * 8;
    securityScore -= activeLowAlerts * 3;
    securityScore -= failedVerificationsCount * 2;

    // Clamp score between 0 and 100
    securityScore = Math.max(0, Math.min(100, securityScore));

    return res.status(200).json({
      success: true,
      data: {
        activeAlerts: activeAlertsCount,
        duplicateTickets: duplicateTicketsCount,
        failedVerifications: failedVerificationsCount,
        securityScore: securityScore,
        recentLogs: auditLogsCount,
      },
    });
  } catch (error) {
    console.error("Get Security Summary Error:", error);
    return res.status(500).json({
      success: false,
      error: "Server error retrieving security summary.",
    });
  }
};

/**
 * Get security alerts
 * GET /api/security/alerts
 */
const getSecurityAlerts = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch user's events
    const userEvents = await prisma.event.findMany({
      where: {
        createdBy: userId,
      },
      select: {
        id: true,
      },
    });

    const eventIds = userEvents.map((evt) => evt.id);

    if (eventIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    const alerts = await prisma.securityAlert.findMany({
      where: {
        eventId: {
          in: eventIds,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    return res.status(200).json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    console.error("Get Security Alerts Error:", error);
    return res.status(500).json({
      success: false,
      error: "Server error retrieving security alerts.",
    });
  }
};

/**
 * Get security audit logs
 * GET /api/security/audit-logs
 */
const getSecurityAuditLogs = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch user's events
    const userEvents = await prisma.event.findMany({
      where: {
        createdBy: userId,
      },
      select: {
        id: true,
      },
    });

    const eventIds = userEvents.map((evt) => evt.id);

    if (eventIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        eventId: {
          in: eventIds,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    // Map log action to requested space-separated format (Requirement 4)
    const mappedAuditLogs = auditLogs.map((log) => {
      let mappedAction = log.action;
      const upperAction = log.action?.toUpperCase();
      if (upperAction === "TICKET_SCANNED" || upperAction === "TICKET_VERIFIED") {
        mappedAction = "TICKET VERIFIED";
      } else if (upperAction === "SECURITY_PAGE_VIEWED") {
        mappedAction = "SECURITY PAGE VIEWED";
      } else if (upperAction === "EVENT_CREATED") {
        mappedAction = "EVENT CREATED";
      } else if (upperAction === "EVENT_UPDATED") {
        mappedAction = "EVENT UPDATED";
      } else if (upperAction === "VERIFICATION_FAILED") {
        mappedAction = "VERIFICATION FAILED";
      } else if (upperAction === "DUPLICATE_TICKET_DETECTED") {
        mappedAction = "DUPLICATE TICKET DETECTED";
      } else {
        mappedAction = log.action.replace(/_/g, " ");
      }

      return {
        ...log,
        action: mappedAction,
      };
    });

    return res.status(200).json({
      success: true,
      data: mappedAuditLogs,
    });
  } catch (error) {
    console.error("Get Security Audit Logs Error:", error);
    return res.status(500).json({
      success: false,
      error: "Server error retrieving security audit logs.",
    });
  }
};

/**
 * Get attendance guarantee settings
 * GET /api/security/attendance-guarantee
 */
const getAttendanceGuarantee = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT is_enabled, guarantee_amount, review_window_days FROM attendance_guarantee_settings WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return res.status(200).json({
        success: true,
        data: {
          isEnabled: Boolean(row.is_enabled),
          guaranteeAmount: parseFloat(row.guarantee_amount) || 25,
          reviewWindowDays: parseInt(row.review_window_days, 10) || 7,
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        isEnabled: true,
        guaranteeAmount: 25,
        reviewWindowDays: 7,
      },
    });
  } catch (error) {
    console.error("Get Attendance Guarantee Error:", error);
    return res.status(500).json({
      success: false,
      error: "Server error retrieving attendance guarantee settings.",
    });
  }
};

/**
 * Update attendance guarantee settings
 * PUT, PATCH, or POST /api/security/attendance-guarantee
 * or /api/events/:id/reservation-guarantee
 */
const updateAttendanceGuarantee = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User session not found.",
        error: "Unauthorized",
      });
    }

    // 1. Flexible parsing & sanitization of field names/types
    const rawEnabled =
      req.body.isGuaranteeEnabled !== undefined
        ? req.body.isGuaranteeEnabled
        : req.body.isEnabled !== undefined
        ? req.body.isEnabled
        : req.body.enabled;
    const enabledVal = rawEnabled !== undefined ? Boolean(rawEnabled) : true;

    let rawAmount =
      req.body.guaranteeFeeAmount !== undefined
        ? req.body.guaranteeFeeAmount
        : req.body.guaranteeAmount !== undefined
        ? req.body.guaranteeAmount
        : req.body.amount;

    if (typeof rawAmount === "string") {
      rawAmount = parseFloat(rawAmount.replace(/[^0-9.]/g, ""));
    }
    const amountVal = !isNaN(rawAmount) && rawAmount !== null ? Number(rawAmount) : 25;

    let rawWindow =
      req.body.hostReviewWindow !== undefined
        ? req.body.hostReviewWindow
        : req.body.reviewWindowDays;

    if (typeof rawWindow === "string") {
      rawWindow = parseInt(rawWindow.replace(/[^0-9]/g, ""), 10);
    }
    const windowVal = !isNaN(rawWindow) && rawWindow !== null ? Number(rawWindow) : 7;

    // 2. Input validation
    if (isNaN(amountVal) || amountVal < 0) {
      return res.status(400).json({
        success: false,
        message: "Guarantee fee amount must be a positive number.",
        error: "Invalid guarantee fee amount",
      });
    }

    if (isNaN(windowVal) || windowVal < 1 || windowVal > 90) {
      return res.status(400).json({
        success: false,
        message: "Host review window must be between 1 and 90 days.",
        error: "Invalid review window",
      });
    }

    // 3. Upsert user guarantee settings
    const upsertQuery = `
      INSERT INTO attendance_guarantee_settings (user_id, is_enabled, guarantee_amount, review_window_days, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        is_enabled = EXCLUDED.is_enabled,
        guarantee_amount = EXCLUDED.guarantee_amount,
        review_window_days = EXCLUDED.review_window_days,
        updated_at = NOW()
      RETURNING is_enabled, guarantee_amount, review_window_days;
    `;

    const result = await db.query(upsertQuery, [userId, enabledVal, amountVal, windowVal]);
    const row = result.rows[0];

    // 4. Handle event ID and optional guarantee reminders sync
    const effectiveEventId =
      req.body.eventId ||
      req.body.id ||
      req.params.id ||
      req.params.eventId;

    const guaranteeReminders = req.body.guaranteeReminders || req.body.reminders;

    if (effectiveEventId && Array.isArray(guaranteeReminders)) {
      try {
        // Fetch existing event reminders
        const existingReminders = await eventService.findRemindersByEventId(effectiveEventId);
        // Keep non-GUARANTEED reminders intact, replace GUARANTEED ones
        const nonGuaranteeReminders = (existingReminders || []).filter(
          (r) => r.targetAudience !== "GUARANTEED"
        );
        const newGuaranteeReminders = guaranteeReminders.map((r) => ({
          ...r,
          targetAudience: "GUARANTEED",
          daysBefore: !isNaN(Number(r.daysBefore)) ? Number(r.daysBefore) : 3,
          sendVia: ["Email", "SMS", "WhatsApp"].includes(r.sendVia) ? r.sendVia : "Email",
          enabled: r.enabled !== undefined ? Boolean(r.enabled) : true,
          message: typeof r.message === "string" ? r.message : "",
        }));
        const mergedReminders = [...nonGuaranteeReminders, ...newGuaranteeReminders];
        await eventService.updateRemindersForEvent(effectiveEventId, mergedReminders);
        console.log(`[SecurityController] Successfully synced ${newGuaranteeReminders.length} guarantee reminder(s) for event ${effectiveEventId}`);
      } catch (remErr) {
        console.warn("[SecurityController] Warning: Could not merge guarantee reminders:", remErr.message);
      }
    }

    // 5. Attempt audit log safely
    try {
      const auditEventId =
        effectiveEventId ||
        (await prisma.event.findFirst({
          where: { createdBy: userId },
          select: { id: true },
        }))?.id;

      if (auditEventId) {
        await createAuditLog({
          userId,
          action: "ATTENDANCE_GUARANTEE_UPDATED",
          eventId: auditEventId,
        });
      }
    } catch (auditErr) {
      console.warn("[SecurityController] Audit log failed (non-critical):", auditErr.message);
    }

    return res.status(200).json({
      success: true,
      data: {
        isEnabled: Boolean(row.is_enabled),
        guaranteeAmount: parseFloat(row.guarantee_amount) || 25,
        reviewWindowDays: parseInt(row.review_window_days, 10) || 7,
      },
      message: "Attendance guarantee settings updated successfully.",
    });
  } catch (error) {
    console.error("[SecurityController] Update Attendance Guarantee Error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update attendance guarantee settings.",
      error: error.message || "Failed to update attendance guarantee settings.",
    });
  }
};

/**
 * Trigger manual execution of auto-waive job
 * POST /api/security/attendance-guarantee/auto-waive
 */
const triggerAutoWaive = async (req, res) => {
  try {
    const { processAutoWaive } = require("../jobs/autoWaive.job");
    const result = await processAutoWaive();
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }
    return res.status(200).json({
      success: true,
      message: `Auto-waive job executed. Waived ${result.totalWaived} pending guarantee fees.`,
      data: result,
    });
  } catch (error) {
    console.error("Trigger Auto-Waive Error:", error);
    return res.status(500).json({
      success: false,
      error: "Server error executing auto-waive job.",
    });
  }
};

module.exports = {
  getSecurityDashboard,
  getSecuritySummary,
  getSecurityAlerts,
  getSecurityAuditLogs,
  deleteAuditLog,
  getAttendanceGuarantee,
  updateAttendanceGuarantee,
  triggerAutoWaive,
};

