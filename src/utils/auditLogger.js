const prisma = require("../config/prisma");

/**
 * Creates an audit log record in the database.
 * @param {Object} params
 * @param {number} [params.userId] - The ID of the authenticated user.
 * @param {string} [params.actorEmail] - The email of the actor. If not provided, it will be looked up using userId.
 * @param {string} params.action - The action being performed (e.g. EVENT_CREATED, SECURITY_PAGE_VIEWED).
 * @param {string} params.eventId - The event ID associated with the audit log.
 */
async function createAuditLog({ userId, actorEmail, action, eventId, userEmail, entityType, entityId, metadata }) {
  try {
    if (!eventId) {
      console.warn("Audit Log ignored: eventId is required");
      return null;
    }

    let email = actorEmail;
    if (!email && userId) {
      const user = await prisma.user.findUnique({
        where: { id: Number(userId) },
        select: { email: true }
      });
      email = user?.email;
    }

    if (!email) {
      email = "system@eventizers.com";
    }

    return await prisma.auditLog.create({
      data: {
        action,
        actorEmail: email,
        userEmail: userEmail || email,
        entityType,
        entityId,
        metadata: metadata ? metadata : undefined,
        eventId,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
    return null;
  }
}

/**
 * Creates a security alert record if an unresolved alert of the same type does not exist.
 * @param {Object} params
 * @param {string} params.type - The alert type (e.g. DUPLICATE_TICKET, VERIFICATION_FAILED).
 * @param {string} params.description - Details of the alert.
 * @param {string} params.severity - Severity level (e.g. HIGH, MEDIUM, LOW).
 * @param {string} params.eventId - The event ID associated with the security alert.
 */
async function createSecurityAlert({ type, description, severity, eventId }) {
  try {
    if (!eventId) {
      console.warn("Security Alert ignored: eventId is required");
      return null;
    }

    // Check if an unresolved alert of this type already exists for this event
    const existing = await prisma.securityAlert.findFirst({
      where: {
        eventId,
        type,
        isResolved: false,
      },
    });

    if (existing) {
      return existing;
    }

    return await prisma.securityAlert.create({
      data: {
        type,
        description,
        severity,
        isResolved: false,
        eventId,
      },
    });
  } catch (error) {
    console.error("Failed to create security alert:", error);
    return null;
  }
}

module.exports = {
  createAuditLog,
  createSecurityAlert,
};
