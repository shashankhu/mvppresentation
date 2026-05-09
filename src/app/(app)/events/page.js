"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Calendar, Plus, Filter } from "lucide-react";
import { getStatusBadgeClass, getStatusLabel, formatDate, formatCurrency } from "@/lib/utils";

export default function EventsPage() {
  const { user, apiFetch, loading: authLoading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: "", eventType: "" });

  const fetchEvents = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    console.log("[events] current session user", user?.id || null);
    console.log("[events] current role", user?.role || null);

    const params = new URLSearchParams();
    if (filter.status) params.set("status", filter.status);
    if (filter.eventType) params.set("eventType", filter.eventType);

    try {
      const data = await apiFetch(`/api/events?${params.toString()}`);
      const fetchedEvents = data?.events || [];
      setEvents(fetchedEvents);
      const eventSummaries = fetchedEvents.map((event) => ({ id: event.id, status: event.status }));
      console.log("[events] fetch query results", {
        count: fetchedEvents.length,
        events: eventSummaries,
      });
    } catch (err) {
      console.error("[events] fetch error", err);
    } finally {
      setLoading(false);
    }
  }, [user, filter, apiFetch]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    fetchEvents();
  }, [user, authLoading, router, filter, fetchEvents]);

  if (authLoading || loading || !user) {
    return <div className="page-loader"><div className="spinner" /></div>;
  }

  const canCreate = ["student", "club_head", "dean", "admin"].includes(user?.role);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Events</h1>
          <p className="page-subtitle">Browse and manage all events</p>
        </div>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => router.push("/events/new")}>
            <Plus size={18} />
            Create Event
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-6)", flexWrap: "wrap" }}>
        <select
          className="form-select"
          style={{ width: "auto", minWidth: 160 }}
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
        >
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="WAITING_FOR_FACULTY">Awaiting Faculty</option>
          <option value="WAITING_FOR_DEAN">Awaiting Dean</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
        </select>

        <select
          className="form-select"
          style={{ width: "auto", minWidth: 160 }}
          value={filter.eventType}
          onChange={(e) => setFilter({ ...filter, eventType: e.target.value })}
        >
          <option value="">All Types</option>
          <option value="club">Club Events</option>
          <option value="standard">Standard Events</option>
        </select>
      </div>

      {/* Events Grid */}
      {events.length === 0 ? (
        <div className="empty-state">
          <Calendar size={48} />
          <h3>No events found</h3>
          <p>Try adjusting your filters or create a new event</p>
        </div>
      ) : (
        <div className="events-grid">
          {events.map((event) => (
            <div
              key={event.id}
              className="event-card"
              onClick={() => router.push(`/events/${event.id}`)}
            >
              <div className="event-card-header">
                <div>
                  <span className="event-card-title">{event.title}</span>
                  {event.eventType === "standard" && (
                    <span className="badge badge-progress" style={{ marginLeft: 8, fontSize: 10 }}>STANDARD</span>
                  )}
                </div>
                <span className={`badge ${getStatusBadgeClass(event.status)}`}>
                  {getStatusLabel(event.status)}
                </span>
              </div>

              <p style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-secondary)",
                marginTop: "var(--space-2)",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}>
                {event.description}
              </p>

              <div className="event-card-meta">
                <span>👤 {event.createdBy?.name}</span>
                {event.club && <span>🏢 {event.club.name}</span>}
                {event.budgetEstimate > 0 && <span>💰 {formatCurrency(event.budgetEstimate)}</span>}
                {event.eventDate && <span>📅 {formatDate(event.eventDate)}</span>}
              </div>

              <div className="event-card-meta" style={{ marginTop: "var(--space-2)" }}>
                <span>📋 {event._count?.approvalLogs || 0} reviews</span>
                <span>✅ {event._count?.tasks || 0} tasks</span>
                {event.eventType === "standard" && (
                  <span>🤝 {event._count?.participants || 0} clubs joined</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
