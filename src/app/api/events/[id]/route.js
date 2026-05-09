// ─────────────────────────────────────────────
// GET  /api/events/[id] — Event detail
// ─────────────────────────────────────────────

import prisma from "@/lib/prisma";
import { authenticate } from "@/lib/auth";
import { success, error, unauthorized, notFound, forbidden } from "@/lib/api";
import { EVENT_STATUS, ROLES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const decoded = authenticate(request);
    if (!decoded) return unauthorized();

    const { id } = await params;
    const { role, userId } = decoded;
    console.log("[events:detail] current session user", userId);
    console.log("[events:detail] current role", role);
    console.log("[events:detail] requested event id", id);

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        club: {
          select: { id: true, name: true, description: true },
        },
        parentEvent: {
          select: { id: true, title: true, status: true, eventType: true },
        },
        subEvents: {
          orderBy: { createdAt: "desc" },
          include: {
            club: { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true, role: true } },
            _count: {
              select: {
                resourceRequests: true,
                tasks: true,
                expenses: true,
              },
            },
          },
        },
        approvalLogs: {
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { id: true, name: true, role: true } },
          },
        },
        budget: true,
        expenses: {
          orderBy: { createdAt: "desc" },
          include: {
            addedBy: { select: { id: true, name: true } },
          },
        },
        tasks: {
          orderBy: { createdAt: "desc" },
          include: {
            assignee: { select: { id: true, name: true } },
            createdBy: { select: { id: true, name: true } },
          },
        },
        participants: {
          include: {
            club: { select: { id: true, name: true } },
          },
        },
        deptNotifications: true,
        resourceRequests: {
          orderBy: { createdAt: "desc" },
          include: {
            club: { select: { id: true, name: true } },
            requestedBy: { select: { id: true, name: true } },
            reviewedBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!event) {
      console.error("[events:detail] event not found", { id, userId, role });
      return notFound("Event not found");
    }

    // --- Access Control Authorization ---
    // Standard events are public to all authenticated users
    if (event.eventType !== "standard") {
      let hasAccess = false;

      // 1. Creator always has access
      if (event.createdById === userId) hasAccess = true;
      // 2. Admins and Deans always have access
      else if (role === ROLES.ADMIN || role === "super_admin" || role === ROLES.DEAN) hasAccess = true;
      // 3. Department roles might have access to approved events
      else if (
        [ROLES.TRANSPORT, ROLES.SECURITY, ROLES.RESOURCE, ROLES.FINANCE].includes(role) &&
        event.status === EVENT_STATUS.APPROVED
      ) {
        hasAccess = true;
      }
      // 4. Approver roles (faculty coordinator, principal) have access
      else if ([ROLES.FACULTY_COORDINATOR, ROLES.PRINCIPAL].includes(role)) hasAccess = true;
      // 5. Club-membership grants access when the event carries a clubId (club events and sub-events)
      else if (event.clubId) {
        const membership = await prisma.clubMember.findUnique({
          where: { userId_clubId: { userId, clubId: event.clubId } }
        });
        if (membership) hasAccess = true;
      }

      if (!hasAccess) {
        const redactId = (value) => (typeof value === "string" ? `${value.slice(0, 6)}...` : null);
        console.error("[events:detail] access denied", {
          userId: redactId(userId),
          role,
          eventId: redactId(event.id),
          eventType: event.eventType,
          eventStatus: event.status,
          eventClubId: redactId(event.clubId),
          createdById: redactId(event.createdById),
        });
        return forbidden("You do not have access to view this event's details");
      }
    }

    // Add computed fields
    const totalExpenses = event.expenses.reduce((sum, e) => sum + e.amount, 0);
    const budgetRemaining = event.budget
      ? event.budget.totalAllocated - totalExpenses
      : 0;

    // Add sub-event statistics for standard events
    const subEventStats = event.eventType === "standard" ? {
      totalSubEvents: event.subEvents.length,
      totalResourceRequests: event.subEvents.reduce((sum, se) => sum + se._count.resourceRequests, 0),
      totalSubEventTasks: event.subEvents.reduce((sum, se) => sum + se._count.tasks, 0),
      totalSubEventExpenses: event.subEvents.reduce((sum, se) => sum + se._count.expenses, 0),
    } : null;

    return success({
      event: {
        ...event,
        totalExpenses,
        budgetRemaining,
        budgetAllocated: event.budget?.totalAllocated || 0,
        subEventStats,
      },
    });
  } catch (err) {
    console.error("[events:detail] fetch error", err);
    return error("Internal server error", 500);
  }
}
