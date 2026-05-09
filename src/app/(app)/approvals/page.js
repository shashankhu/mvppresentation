"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { getStatusBadgeClass, getStatusLabel, formatDate, formatCurrency } from "@/lib/utils";

export default function ApprovalsPage() {
  const { user, apiFetch, loading: authLoading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    console.log("[approvals] current session user", user?.id || null);
    console.log("[approvals] current role", user?.role || null);

    try {
      const data = await apiFetch("/api/approvals/pending");
      const fetchedEvents = data?.events || [];
      setEvents(fetchedEvents);
      const eventSummaries = fetchedEvents.map((event) => ({ id: event.id, status: event.status }));
      console.log("[approvals] fetch query results", {
        count: fetchedEvents.length,
        events: eventSummaries,
      });
    } catch (err) {
      console.error("[approvals] fetch error", err);
    } finally {
      setLoading(false);
    }
  }, [user, apiFetch]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    fetchEvents();
  }, [user, authLoading, router, apiFetch, fetchEvents]);

  if (authLoading || loading || !user) {
    return <div className="page-loader"><div className="spinner" /></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pending Approvals</h1>
          <p className="page-subtitle">{events.length} event{events.length !== 1 ? "s" : ""} waiting for your review</p>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="empty-state">
          <ClipboardCheck size={48} />
          <h3>All caught up!</h3>
          <p>No events require your approval right now</p>
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
                <span className="event-card-title">{event.title}</span>
                <span className={`badge ${getStatusBadgeClass(event.status)}`}>
                  {getStatusLabel(event.status)}
                </span>
              </div>

              <div className="event-card-meta">
                <span>👤 {event.createdBy?.name}</span>
                {event.club && <span>🏢 {event.club.name}</span>}
                <span>💰 {formatCurrency(event.budgetEstimate)}</span>
              </div>

              {/* Previous approvals */}
              {event.approvalLogs?.length > 0 && (
                <div style={{ marginTop: "var(--space-3)" }}>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: 4 }}>Previous reviews:</div>
                  {event.approvalLogs.map((log) => (
                    <div key={log.id} style={{
                      fontSize: "var(--text-xs)",
                      color: log.action === "approved" ? "var(--accent-success)" : "var(--accent-danger)",
                      padding: "2px 0",
                    }}>
                      {log.action === "approved" ? "✅" : "❌"} {log.user?.name} ({log.stage?.replace("_", " ")}) — {log.action}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
