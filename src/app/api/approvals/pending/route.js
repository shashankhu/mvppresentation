// ─────────────────────────────────────────────
// GET /api/approvals/pending — Pending approvals for current user's role
// ─────────────────────────────────────────────

import prisma from "@/lib/prisma";
import { authenticateStrict } from "@/lib/auth";
import { success, error, unauthorized, forbidden } from "@/lib/api";
import { ROLES, EVENT_STATUS, APPROVER_ROLES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const decoded = await authenticateStrict(request);
    if (!decoded) return unauthorized();

    if (!APPROVER_ROLES.includes(decoded.role)) {
      return forbidden("Only approver roles can view pending approvals");
    }

    const statusMap = {
      [ROLES.FACULTY_COORDINATOR]: EVENT_STATUS.WAITING_FOR_FACULTY,
      [ROLES.DEAN]: EVENT_STATUS.WAITING_FOR_DEAN,
      [ROLES.PRINCIPAL]: EVENT_STATUS.WAITING_FOR_PRINCIPAL,
      [ROLES.ADMIN]: EVENT_STATUS.WAITING_FOR_ADMIN,
    };

    const targetStatus = statusMap[decoded.role];
    console.log("[approvals:pending] current session user", decoded.userId);
    console.log("[approvals:pending] current role", decoded.role);
    console.log("[approvals:pending] target approval status", targetStatus);

    // Faculty is scoped to coordinated clubs; dean/principal/admin are not scoped by creator.
    let whereClause = { status: targetStatus };

    if (decoded.role === ROLES.FACULTY_COORDINATOR) {
      whereClause = {
        status: targetStatus,
        club: {
          facultyCoordinatorId: decoded.userId,
        },
      };
    }

    const events = await prisma.event.findMany({
      where: whereClause,
      orderBy: { createdAt: "asc" },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        club: {
          select: {
            id: true,
            name: true,
            type: true,
            department: true,
            facultyCoordinatorId: true,
            facultyCoordinator: { select: { id: true, name: true } },
          },
        },
        approvalLogs: {
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { id: true, name: true, role: true } },
          },
        },
      },
    });
    const eventSummaries = events.map((event) => ({ id: event.id, status: event.status }));
    console.log("[approvals:pending] fetch query results", {
      count: events.length,
      events: eventSummaries,
    });

    return success({ events, count: events.length });
  } catch (err) {
    console.error("[approvals:pending] fetch error", err);
    return error("Internal server error", 500);
  }
}
