// ─────────────────────────────────────────────
// GET  /api/events — List events (role-filtered)
// POST /api/events — Create event
// ─────────────────────────────────────────────

import prisma from "@/lib/prisma";
import { authenticate } from "@/lib/auth";
import {
  success,
  error,
  unauthorized,
  forbidden,
  validateRequired,
} from "@/lib/api";
import { EVENT_STATUS, ROLES } from "@/lib/constants";

export const dynamic = "force-dynamic";

// ─── GET: List Events ───

export async function GET(request) {
  try {
    const decoded = authenticate(request);
    if (!decoded) return unauthorized();
    console.log("[events:list] current session user", decoded.userId);
    console.log("[events:list] current role", decoded.role);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const eventType = searchParams.get("eventType");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Build where filter
    const where = { parentEventId: null }; // Only show top-level events, not sub-events
    if (status) where.status = status;
    if (type) where.type = type;
    if (eventType) where.eventType = eventType;

    // Role-based filtering
    if (decoded.role === ROLES.STUDENT || decoded.role === ROLES.CLUB_HEAD) {
      // Students/Club heads see: their own events + standard events
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { clubMemberships: { select: { clubId: true } } },
      });
      const clubIds = user?.clubMemberships.map((m) => m.clubId) || [];

      where.OR = [
        { clubId: { in: clubIds } },
        { eventType: "standard" },
      ];
    }
    // Faculty/Dean/Principal/Admin see all events

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          createdBy: { select: { id: true, name: true, role: true } },
          club: { select: { id: true, name: true } },
          _count: {
            select: {
              approvalLogs: true,
              tasks: true,
              participants: true,
            },
          },
        },
      }),
      prisma.event.count({ where }),
    ]);
    const eventSummaries = events.map((event) => ({ id: event.id, status: event.status }));
    console.log("[events:list] fetch query results", {
      count: events.length,
      total,
      events: eventSummaries,
    });

    return success({
      events,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("[events:list] fetch error", err);
    return error("Internal server error", 500);
  }
}

// ─── POST: Create Event ───

export async function POST(request) {
  try {
    const decoded = authenticate(request);
    if (!decoded) return unauthorized();

    const body = await request.json();

    const missing = validateRequired(body, ["title", "description", "type"]);
    if (missing) return error(missing);

    if (body.title?.length > 200) return error("Title must be under 200 characters");
    if (body.description?.length > 5000) return error("Description too long");

    // ─── Standard Event (Dean creates) ───
    if (body.eventType === "standard") {
      if (decoded.role !== ROLES.DEAN && decoded.role !== ROLES.ADMIN) {
        return forbidden("Only Dean or Admin can create standard events");
      }

      const event = await prisma.event.create({
        data: {
          title: body.title,
          description: body.description,
          type: body.type,
          eventType: "standard",
          status: EVENT_STATUS.APPROVED, // Standard events auto-approved
          objectives: body.objectives || null,
          targetAudience: body.targetAudience || null,
          expectedAttendance: body.expectedAttendance || null,
          venue: body.venue || null,
          eventDate: body.eventDate ? new Date(body.eventDate) : null,
          eventEndDate: body.eventEndDate ? new Date(body.eventEndDate) : null,
          budgetEstimate: body.budgetEstimate || 0,
          needsTransport: body.needsTransport || false,
          needsSecurity: body.needsSecurity || false,
          needsResources: body.needsResources || false,
          transportNotes: body.transportNotes || null,
          securityNotes: body.securityNotes || null,
          resourceNotes: body.resourceNotes || null,
          createdById: decoded.userId,
          clubId: null,
        },
        include: {
          createdBy: { select: { id: true, name: true, role: true } },
        },
      });

      return success({ event }, 201);
    }

    // ─── Club Event (Club members create) ───
    if (
      decoded.role !== ROLES.STUDENT &&
      decoded.role !== ROLES.CLUB_HEAD
    ) {
      return forbidden("Only students and club heads can create club events");
    }

    // Must belong to a club
    if (!body.clubId) {
      return error("clubId is required for club events");
    }

    const membership = await prisma.clubMember.findUnique({
      where: {
        userId_clubId: {
          userId: decoded.userId,
          clubId: body.clubId,
        },
      },
    });

    if (!membership) {
      return forbidden("You are not a member of this club");
    }

    const event = await prisma.event.create({
      data: {
        title: body.title,
        description: body.description,
        type: body.type,
        eventType: "club",
        status: EVENT_STATUS.DRAFT,
        objectives: body.objectives || null,
        targetAudience: body.targetAudience || null,
        expectedAttendance: body.expectedAttendance || null,
        venue: body.venue || null,
        eventDate: body.eventDate ? new Date(body.eventDate) : null,
        eventEndDate: body.eventEndDate ? new Date(body.eventEndDate) : null,
        budgetEstimate: body.budgetEstimate || 0,
        needsTransport: body.needsTransport || false,
        needsSecurity: body.needsSecurity || false,
        needsResources: body.needsResources || false,
        transportNotes: body.transportNotes || null,
        securityNotes: body.securityNotes || null,
        resourceNotes: body.resourceNotes || null,
        createdById: decoded.userId,
        clubId: body.clubId,
      },
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
        club: { select: { id: true, name: true } },
      },
    });

    return success({ event }, 201);
  } catch (err) {
    console.error("[events:create]", err);
    return error("Internal server error", 500);
  }
}
