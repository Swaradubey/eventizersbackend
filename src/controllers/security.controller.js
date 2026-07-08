const prisma = require("../config/prisma");
const { createAuditLog } = require("../utils/auditLogger");

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

module.exports = {
  getSecurityDashboard,
  getSecuritySummary,
  getSecurityAlerts,
  getSecurityAuditLogs,
  deleteAuditLog,
};
