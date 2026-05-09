"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import {
  ArrowLeft, Send, CheckCircle, XCircle, Clock, Users,
  DollarSign, ListTodo, Plus, MessageSquare, UserPlus, Calendar,
} from "lucide-react";
import { getStatusBadgeClass, getStatusLabel, formatDate, formatDateTime, formatCurrency } from "@/lib/utils";

export default function EventDetailPage({ params }) {
  const { id } = use(params);
  const { user, apiFetch, loading: authLoading } = useAuth();
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [eventError, setEventError] = useState("");
  const [tab, setTab] = useState("overview");
  const [actionLoading, setActionLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [deptNotifs, setDeptNotifs] = useState([]);

  // Task form
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "medium", deadline: "" });
  const [showTaskForm, setShowTaskForm] = useState(false);

  // Expense form
  const [expenseForm, setExpenseForm] = useState({ amount: "", description: "", category: "other" });
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  // User's clubs (for joining standard events)
  const [userClubs, setUserClubs] = useState([]);
  const [selectedClubToJoin, setSelectedClubToJoin] = useState("");

  // Sub-event form (for standard events)
  const [subEventForm, setSubEventForm] = useState({
    title: "",
    description: "",
    type: "tech",
    objectives: "",
    targetAudience: "",
    expectedAttendance: "",
    venue: "",
    eventDate: "",
    eventEndDate: "",
    budgetEstimate: "",
    clubId: "",
    needsTransport: false,
    needsSecurity: false,
    needsResources: false,
    transportNotes: "",
    securityNotes: "",
    resourceNotes: "",
  });
  const [showSubEventForm, setShowSubEventForm] = useState(false);

  // Resource request form
  const [resourceForm, setResourceForm] = useState({
    title: "",
    description: "",
    category: "equipment",
    amount: "",
    quantity: "",
    priority: "medium",
    clubId: "",
  });
  const [showResourceForm, setShowResourceForm] = useState(false);

  const fetchEvent = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setEventError("");
    console.log("[events:detail:page] current session user", user?.id || null);
    console.log("[events:detail:page] current role", user?.role || null);
    console.log("[events:detail:page] requested event id", id);

    try {
      const data = await apiFetch(`/api/events/${id}`);
      setEvent(data?.event || null);
      console.log("[events:detail:page] fetch query results", {
        eventId: data?.event?.id || null,
        approvalStatus: data?.event?.status || null,
      });
    } catch (err) {
      const message = err?.message || "Failed to load event";
      console.error("[events:detail:page] fetch error", err);
      setEvent(null);
      setEventError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [apiFetch, id, showToast, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }

    fetchEvent();

    // Fetch user's clubs for joining standard events
    apiFetch("/api/clubs/my")
      .then((data) => setUserClubs(data.clubs || []))
      .catch((err) => console.error("[events:detail:page] clubs fetch error", err));
  }, [id, user, authLoading, router, apiFetch, fetchEvent]);

  const handleSubmitForApproval = async () => {
    setActionLoading(true);
    try {
      await apiFetch(`/api/events/${id}/submit`, { method: "POST" });
      showToast("Event submitted for approval!", "success");
      fetchEvent();
    } catch (err) {
      showToast(err.message, "error");
    }
    setActionLoading(false);
  };

  const handleApproval = async (action) => {
    if (action === "rejected" && !comment) {
      showToast("Comment required when rejecting", "error");
      return;
    }
    setActionLoading(true);
    try {
      await apiFetch(`/api/events/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ action, comment, notifyDepartments: deptNotifs }),
      });
      showToast(`Event ${action}!`, action === "approved" ? "success" : "info");
      fetchEvent();
      setComment("");
      setDeptNotifs([]);
    } catch (err) {
      showToast(err.message, "error");
    }
    setActionLoading(false);
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/events/${id}/tasks`, {
        method: "POST",
        body: JSON.stringify(taskForm),
      });
      showToast("Task created!", "success");
      setShowTaskForm(false);
      setTaskForm({ title: "", description: "", priority: "medium", deadline: "" });
      fetchEvent();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/events/${id}/expenses`, {
        method: "POST",
        body: JSON.stringify({ ...expenseForm, amount: parseFloat(expenseForm.amount) }),
      });
      showToast("Expense added!", "success");
      setShowExpenseForm(false);
      setExpenseForm({ amount: "", description: "", category: "other" });
      fetchEvent();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleJoinEvent = async () => {
    if (!selectedClubToJoin) {
      showToast("Please select a club to join with", "error");
      return;
    }
    setActionLoading(true);
    try {
      await apiFetch(`/api/events/${id}/join`, {
        method: "POST",
        body: JSON.stringify({ clubId: selectedClubToJoin }),
      });
      showToast("Club joined the event!", "success");
      setSelectedClubToJoin("");
      fetchEvent();
    } catch (err) {
      showToast(err.message, "error");
    }
    setActionLoading(false);
  };

  const handleCreateSubEvent = async (e) => {
    e.preventDefault();
    if (!subEventForm.clubId) {
      showToast("Please select a club", "error");
      return;
    }
    setActionLoading(true);
    try {
      const payload = {
        ...subEventForm,
        expectedAttendance: subEventForm.expectedAttendance ? parseInt(subEventForm.expectedAttendance) : null,
        budgetEstimate: subEventForm.budgetEstimate ? parseFloat(subEventForm.budgetEstimate) : 0,
      };

      await apiFetch(`/api/events/${id}/subevents`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      showToast("Sub-event created and submitted for Dean approval!", "success");
      setShowSubEventForm(false);
      setSubEventForm({
        title: "",
        description: "",
        type: "tech",
        objectives: "",
        targetAudience: "",
        expectedAttendance: "",
        venue: "",
        eventDate: "",
        eventEndDate: "",
        budgetEstimate: "",
        clubId: "",
        needsTransport: false,
        needsSecurity: false,
        needsResources: false,
        transportNotes: "",
        securityNotes: "",
        resourceNotes: "",
      });
      fetchEvent(); // Refresh to show new sub-event
    } catch (err) {
      showToast(err.message, "error");
    }
    setActionLoading(false);
  };

  const handleCreateResourceRequest = async (e) => {
    e.preventDefault();
    if (!resourceForm.clubId) {
      showToast("Please select a club", "error");
      return;
    }
    setActionLoading(true);
    try {
      const payload = {
        ...resourceForm,
        amount: resourceForm.amount ? parseFloat(resourceForm.amount) : null,
        quantity: resourceForm.quantity ? parseInt(resourceForm.quantity) : null,
      };

      await apiFetch(`/api/events/${id}/resources`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      showToast("Resource request created!", "success");
      setShowResourceForm(false);
      setResourceForm({
        title: "",
        description: "",
        category: "equipment",
        amount: "",
        quantity: "",
        priority: "medium",
        clubId: "",
      });
      fetchEvent(); // Refresh to show new request
    } catch (err) {
      showToast(err.message, "error");
    }
    setActionLoading(false);
  };

  const toggleDeptNotif = (dept) => {
    setDeptNotifs((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  };

  if (authLoading || loading || !user) {
    return <div className="page-loader"><div className="spinner" /></div>;
  }

  if (!event) {
    return (
      <div style={{ padding: "var(--space-6)", textAlign: "center" }}>
        <h2>Event not found</h2>
        <p>{eventError || "The event you're looking for doesn't exist or you don't have permission to view it."}</p>
        <button className="btn btn-primary" onClick={() => router.push("/events")}>
          Back to Events
        </button>
      </div>
    );
  }

  const isCreator = event.createdById === user?.id;
  const canSubmit = isCreator && event.status === "DRAFT";
  const canApprove = (() => {
    const roleStageMap = {
      faculty_coordinator: "WAITING_FOR_FACULTY",
      dean: "WAITING_FOR_DEAN",
      principal: "WAITING_FOR_PRINCIPAL",
      admin: "WAITING_FOR_ADMIN",
    };
    return roleStageMap[user?.role] === event.status;
  })();

  return (
    <div>
      {ToastComponent}
      <button className="btn btn-ghost btn-sm" onClick={() => router.back()} style={{ marginBottom: "var(--space-4)" }}>
        <ArrowLeft size={16} /> Back
      </button>

      {/* Event Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-6)", flexWrap: "wrap", gap: "var(--space-4)" }}>
        <div>
          <h1 className="page-title">
            {event.eventType === "standard" && "🎪 "}{event.title}
          </h1>
          {event.eventType === "standard" && (
            <p className="page-subtitle" style={{ marginTop: "var(--space-1)", marginBottom: "var(--space-2)" }}>
              Festival Management Dashboard
            </p>
          )}
          <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-2)", flexWrap: "wrap" }}>
            <span className={`badge ${getStatusBadgeClass(event.status)}`}>{getStatusLabel(event.status)}</span>
            <span className="badge badge-draft" style={{ textTransform: "capitalize" }}>{event.type}</span>
            {event.eventType === "standard" && <span className="badge badge-progress">FESTIVAL</span>}
          </div>
        </div>
        {canSubmit && (
          <button className="btn btn-primary" onClick={handleSubmitForApproval} disabled={actionLoading}>
            <Send size={16} /> Submit for Approval
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {["overview", "approvals", "budget", "tasks", ...(event.eventType === "standard" ? ["subevents"] : [])].map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "subevents" ? "Sub-Events" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Festival Statistics for Standard Events */}
      {event.eventType === "standard" && (
        <div>
          {/* Festival Info Alert */}
          {(!event.eventDate || !event.participants?.length) && (
            <div className="card" style={{
              marginBottom: "var(--space-4)",
              border: "1px solid var(--accent-info)",
              background: "var(--accent-info-bg)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-4)" }}>
                <div style={{ fontSize: "24px" }}>🎪</div>
                <div>
                  <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-1)" }}>
                    Festival Setup
                  </h3>
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                    {!event.eventDate && !event.participants?.length
                      ? "Set event dates and invite clubs to join this festival"
                      : !event.eventDate
                      ? "Set the festival dates to complete setup"
                      : "Invite clubs to join this festival"
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="stats-grid" style={{ marginBottom: "var(--space-6)" }}>
            <div className="stat-card">
              <div className="stat-icon primary"><Users size={20} /></div>
              <div className="stat-content">
                <h3>{event.participants?.length || 0}</h3>
                <p>Participating Clubs</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon success"><Calendar size={20} /></div>
              <div className="stat-content">
                <h3>{event.subEvents?.length || 0}</h3>
                <p>Sub-Events</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon warning"><Clock size={20} /></div>
              <div className="stat-content">
                <h3>{event.subEvents?.filter(se => se.status === "WAITING_FOR_DEAN").length || 0}</h3>
                <p>Pending Approvals</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon info"><DollarSign size={20} /></div>
              <div className="stat-content">
                <h3>{formatCurrency(event.budgetEstimate || 0)}</h3>
                <p>Total Budget</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overview Tab */}
      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "var(--space-6)" }}>
          <div>
            <div className="card" style={{ marginBottom: "var(--space-6)" }}>
              <h3 className="card-title" style={{ marginBottom: "var(--space-4)" }}>Description</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", whiteSpace: "pre-wrap" }}>{event.description}</p>

              {event.objectives && (
                <>
                  <h4 style={{ marginTop: "var(--space-5)", marginBottom: "var(--space-2)", fontSize: "var(--text-sm)", fontWeight: 600 }}>Objectives</h4>
                  <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", whiteSpace: "pre-wrap" }}>{event.objectives}</p>
                </>
              )}
            </div>

            {/* Addons */}
            {(event.needsTransport || event.needsSecurity || event.needsResources) && (
              <div className="card">
                <h3 className="card-title" style={{ marginBottom: "var(--space-4)" }}>Execution Requirements</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  {event.needsTransport && (
                    <div style={{ padding: "var(--space-3)", background: "var(--bg-muted)", borderRadius: "var(--radius-md)" }}>
                      <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>Transport Required</span>
                      {event.transportNotes && <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 4 }}>{event.transportNotes}</p>}
                    </div>
                  )}
                  {event.needsSecurity && (
                    <div style={{ padding: "var(--space-3)", background: "var(--bg-muted)", borderRadius: "var(--radius-md)" }}>
                      <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>Security Required</span>
                      {event.securityNotes && <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 4 }}>{event.securityNotes}</p>}
                    </div>
                  )}
                  {event.needsResources && (
                    <div style={{ padding: "var(--space-3)", background: "var(--bg-muted)", borderRadius: "var(--radius-md)" }}>
                      <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>Special Resources</span>
                      {event.resourceNotes && <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 4 }}>{event.resourceNotes}</p>}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="card" style={{ marginBottom: "var(--space-4)" }}>
              <h4 style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "var(--space-3)" }}>
                {event.eventType === "standard" ? "Festival Details" : "Details"}
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", fontSize: "var(--text-sm)" }}>
                <div><span style={{ color: "var(--text-muted)" }}>Created by:</span> {event.createdBy?.name}</div>
                {event.club && <div><span style={{ color: "var(--text-muted)" }}>Club:</span> {event.club.name}</div>}
                <div><span style={{ color: "var(--text-muted)" }}>Budget:</span> {formatCurrency(event.budgetEstimate)}</div>
                {event.venue && <div><span style={{ color: "var(--text-muted)" }}>Venue:</span> {event.venue}</div>}

                {/* Enhanced date display for festivals */}
                {event.eventType === "standard" ? (
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Festival Dates:</span>
                    {event.eventDate ? (
                      <span>
                        {formatDate(event.eventDate)}
                        {event.eventEndDate && event.eventEndDate !== event.eventDate && ` - ${formatDate(event.eventEndDate)}`}
                      </span>
                    ) : (
                      <span style={{ color: "var(--accent-warning)", fontStyle: "italic" }}>Not set yet</span>
                    )}
                  </div>
                ) : (
                  event.eventDate && <div><span style={{ color: "var(--text-muted)" }}>Date:</span> {formatDate(event.eventDate)}</div>
                )}

                {event.targetAudience && <div><span style={{ color: "var(--text-muted)" }}>Audience:</span> {event.targetAudience}</div>}
                {event.expectedAttendance && <div><span style={{ color: "var(--text-muted)" }}>Expected:</span> {event.expectedAttendance} attendees</div>}
              </div>
            </div>

            {/* Sub-Events Statistics for Standard Events */}
            {event.eventType === "standard" && event.subEventStats && (
              <div className="card" style={{ marginBottom: "var(--space-4)" }}>
                <h4 style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "var(--space-3)" }}>
                  📅 Sub-Events Overview
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Total Sub-Events:</span>
                    <span style={{ fontWeight: 600 }}>{event.subEventStats.totalSubEvents}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Resource Requests:</span>
                    <span style={{ fontWeight: 600 }}>{event.subEventStats.totalResourceRequests}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Active Tasks:</span>
                    <span style={{ fontWeight: 600 }}>{event.subEventStats.totalSubEventTasks}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Total Expenses:</span>
                    <span style={{ fontWeight: 600 }}>{event.subEventStats.totalSubEventExpenses}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Participating Clubs & Join Section */}
            {event.eventType === "standard" && (
              <div className="card">
                <div className="card-header">
                  <h4 style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
                    <Users size={16} style={{ display: "inline-block", verticalAlign: "middle", marginRight: 4 }} />
                    Participating Clubs ({event.participants?.length || 0})
                  </h4>
                </div>

                {/* Join Section - only show if user has clubs that haven't joined */}
                {userClubs.length > 0 && (
                  (() => {
                    const joinedClubIds = event.participants?.map(p => p.club.id) || [];
                    const availableClubs = userClubs.filter(c => !joinedClubIds.includes(c.id));

                    if (availableClubs.length > 0) {
                      return (
                        <div style={{
                          padding: "var(--space-4)",
                          background: "var(--accent-primary-light)",
                          borderRadius: "var(--radius-md)",
                          marginBottom: "var(--space-4)"
                        }}>
                          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "var(--space-2)", color: "var(--accent-primary)" }}>
                            <UserPlus size={16} style={{ display: "inline-block", verticalAlign: "middle", marginRight: 4 }} />
                            Join this Standard Event
                          </div>
                          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                            <select
                              className="form-select"
                              value={selectedClubToJoin}
                              onChange={(e) => setSelectedClubToJoin(e.target.value)}
                              style={{ flex: 1 }}
                            >
                              <option value="">Select your club</option>
                              {availableClubs.map((club) => (
                                <option key={club.id} value={club.id}>
                                  {club.name} {club.membershipRole === "head" ? "(Head)" : ""}
                                </option>
                              ))}
                            </select>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={handleJoinEvent}
                              disabled={actionLoading || !selectedClubToJoin}
                            >
                              Join Event
                            </button>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()
                )}

                {/* List of participating clubs */}
                {event.participants?.length === 0 ? (
                  <div style={{
                    textAlign: "center",
                    padding: "var(--space-6)",
                    color: "var(--text-muted)",
                    background: "var(--bg-muted)",
                    borderRadius: "var(--radius-md)"
                  }}>
                    <div style={{ fontSize: "32px", marginBottom: "var(--space-2)" }}>🎪</div>
                    <h4 style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "var(--space-1)" }}>
                      No clubs have joined this festival yet
                    </h4>
                    <p style={{ fontSize: "var(--text-xs)" }}>
                      Share the festival details with clubs to get them to join and create sub-events
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    {event.participants?.map((p) => (
                      <div key={p.id} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-3)",
                        padding: "var(--space-2) var(--space-3)",
                        background: "var(--bg-muted)",
                        borderRadius: "var(--radius-md)",
                        fontSize: "var(--text-sm)"
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "var(--radius-sm)",
                          background: "var(--accent-primary)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "white", fontWeight: 600, fontSize: "12px"
                        }}>
                          {p.club.name.charAt(0)}
                        </div>
                        <span>{p.club.name}</span>
                        {userClubs.some(c => c.id === p.club.id) && (
                          <span className="badge badge-approved" style={{ marginLeft: "auto", fontSize: "10px" }}>
                            Your Club
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approvals Tab */}
      {tab === "approvals" && (
        <div>
          {/* Approval Actions */}
          {canApprove && (
            <div className="approval-actions" style={{ flexDirection: "column" }}>
              <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-3)" }}>
                Your Review
              </h3>
              <div className="form-group">
                <label className="form-label">Comment</label>
                <textarea
                  className="form-textarea"
                  placeholder="Add your review comments..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  style={{ minHeight: 80 }}
                />
              </div>

              {/* Department notification checkboxes (Dean only) */}
              {user?.role === "dean" && (
                <div className="form-group">
                  <label className="form-label">Notify Departments (upon approval)</label>
                  <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
                    {[
                      { value: "transport", label: "🚌 Transport" },
                      { value: "security", label: "🛡️ Security" },
                      { value: "resource", label: "📦 Resources" },
                      { value: "finance", label: "💰 Finance" },
                    ].map((dept) => (
                      <div key={dept.value} className="form-checkbox-group">
                        <input
                          type="checkbox"
                          className="form-checkbox"
                          checked={deptNotifs.includes(dept.value)}
                          onChange={() => toggleDeptNotif(dept.value)}
                        />
                        <label style={{ fontSize: "var(--text-sm)" }}>{dept.label}</label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: "var(--space-3)" }}>
                <button className="btn btn-success" onClick={() => handleApproval("approved")} disabled={actionLoading}>
                  <CheckCircle size={16} /> Approve
                </button>
                <button className="btn btn-danger" onClick={() => handleApproval("rejected")} disabled={actionLoading}>
                  <XCircle size={16} /> Reject
                </button>
              </div>
            </div>
          )}

          {/* Approval Timeline */}
          <div className="card" style={{ marginTop: "var(--space-6)" }}>
            <h3 className="card-title" style={{ marginBottom: "var(--space-5)" }}>Approval Timeline</h3>
            {event.approvalLogs?.length === 0 ? (
              <div className="empty-state">
                <Clock size={48} />
                <h3>No approval actions yet</h3>
              </div>
            ) : (
              <div className="timeline">
                {event.approvalLogs?.map((log) => (
                  <div key={log.id} className="timeline-item">
                    <div className={`timeline-dot ${log.action}`} />
                    <div className="timeline-content">
                      <h4>
                        {log.user?.name} ({log.stage?.replace("_", " ")}) — {log.action}
                      </h4>
                      <p>{formatDateTime(log.createdAt)}</p>
                      {log.comment && <div className="comment">{log.comment}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Budget Tab */}
      {tab === "budget" && (
        <div>
          <div className="stats-grid" style={{ marginBottom: "var(--space-6)" }}>
            <div className="stat-card">
              <div className="stat-icon info"><DollarSign size={22} /></div>
              <div className="stat-content">
                <h3>{formatCurrency(event.budgetEstimate)}</h3>
                <p>Estimated</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon success"><DollarSign size={22} /></div>
              <div className="stat-content">
                <h3>{formatCurrency(event.budgetAllocated)}</h3>
                <p>Allocated</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon danger"><DollarSign size={22} /></div>
              <div className="stat-content">
                <h3>{formatCurrency(event.totalExpenses)}</h3>
                <p>Spent</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon warning"><DollarSign size={22} /></div>
              <div className="stat-content">
                <h3>{formatCurrency(event.budgetRemaining)}</h3>
                <p>Remaining</p>
              </div>
            </div>
          </div>

          {/* Add Expense */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Expenses</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowExpenseForm(!showExpenseForm)}>
                <Plus size={14} /> Add Expense
              </button>
            </div>

            {showExpenseForm && (
              <form onSubmit={handleAddExpense} style={{ marginBottom: "var(--space-4)", padding: "var(--space-4)", background: "var(--bg-muted)", borderRadius: "var(--radius-md)" }}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Amount (₹)</label>
                    <input type="number" className="form-input" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="form-select" value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                      {["venue", "catering", "equipment", "printing", "transport", "security", "other"].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input className="form-input" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} required />
                </div>
                <button type="submit" className="btn btn-primary btn-sm">Save Expense</button>
              </form>
            )}

            {event.expenses?.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>No expenses recorded</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Description</th><th>Category</th><th>Amount</th><th>Added By</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    {event.expenses?.map((exp) => (
                      <tr key={exp.id}>
                        <td>{exp.description}</td>
                        <td><span className="badge badge-draft" style={{ textTransform: "capitalize" }}>{exp.category}</span></td>
                        <td>{formatCurrency(exp.amount)}</td>
                        <td>{exp.addedBy?.name}</td>
                        <td>{formatDate(exp.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Resource Requests */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">📦 Resource Requests</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowResourceForm(!showResourceForm)}>
                <Plus size={14} /> Request Resource
              </button>
            </div>

            {showResourceForm && (
              <form onSubmit={handleCreateResourceRequest} style={{ marginBottom: "var(--space-4)", padding: "var(--space-4)", background: "var(--bg-muted)", borderRadius: "var(--radius-md)" }}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Resource Title *</label>
                    <input
                      className="form-input"
                      placeholder="e.g. Sound System"
                      value={resourceForm.title}
                      onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Club *</label>
                    <select
                      className="form-select"
                      value={resourceForm.clubId}
                      onChange={(e) => setResourceForm({ ...resourceForm, clubId: e.target.value })}
                      required
                    >
                      <option value="">Select club</option>
                      {event.eventType === "standard" ? (
                        event.participants?.map((p) => (
                          <option key={p.clubId} value={p.clubId}>{p.club.name}</option>
                        ))
                      ) : event.club ? (
                        <option value={event.club.id}>{event.club.name}</option>
                      ) : null}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Describe the resource needed..."
                    value={resourceForm.description}
                    onChange={(e) => setResourceForm({ ...resourceForm, description: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      className="form-select"
                      value={resourceForm.category}
                      onChange={(e) => setResourceForm({ ...resourceForm, category: e.target.value })}
                    >
                      <option value="venue">Venue</option>
                      <option value="equipment">Equipment</option>
                      <option value="transport">Transport</option>
                      <option value="catering">Catering</option>
                      <option value="printing">Printing</option>
                      <option value="security">Security</option>
                      <option value="funding">Funding</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select
                      className="form-select"
                      value={resourceForm.priority}
                      onChange={(e) => setResourceForm({ ...resourceForm, priority: e.target.value })}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Quantity</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="e.g. 2"
                      value={resourceForm.quantity}
                      onChange={(e) => setResourceForm({ ...resourceForm, quantity: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amount (₹) - if funding</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="e.g. 5000"
                      value={resourceForm.amount}
                      onChange={(e) => setResourceForm({ ...resourceForm, amount: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={actionLoading}>
                    Create Request
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowResourceForm(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {event.resourceRequests?.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>No resource requests yet</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {event.resourceRequests?.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      padding: "var(--space-4)",
                      background: "var(--bg-muted)",
                      borderRadius: "var(--radius-md)",
                      borderLeft: `3px solid ${
                        req.status === "fulfilled" ? "var(--accent-success)" :
                        req.status === "approved" ? "var(--accent-info)" :
                        req.status === "rejected" ? "var(--accent-danger)" :
                        "var(--accent-warning)"
                      }`
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-2)" }}>
                      <div>
                        <h4 style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "var(--space-1)" }}>
                          {req.title}
                        </h4>
                        <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "var(--space-2)" }}>
                          {req.description}
                        </p>
                      </div>
                      <span className={`badge ${
                        req.status === "fulfilled" ? "badge-approved" :
                        req.status === "approved" ? "badge-progress" :
                        req.status === "rejected" ? "badge-rejected" :
                        "badge-pending"
                      }`}>
                        {req.status}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "var(--space-4)", fontSize: "var(--text-xs)", color: "var(--text-muted)", flexWrap: "wrap" }}>
                      <span>📋 {req.category}</span>
                      <span>🏢 {req.club.name}</span>
                      <span>👤 {req.requestedBy.name}</span>
                      {req.quantity && <span>📦 Qty: {req.quantity}</span>}
                      {req.amount && <span>💰 {formatCurrency(req.amount)}</span>}
                      <span className={`badge ${req.priority === "urgent" ? "badge-rejected" : req.priority === "high" ? "badge-pending" : "badge-draft"}`}>
                        {req.priority} priority
                      </span>
                    </div>

                    {req.reviewComment && (
                      <div style={{ marginTop: "var(--space-2)", padding: "var(--space-2)", background: "var(--bg-surface)", borderRadius: "var(--radius-sm)" }}>
                        <p style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                          <strong>Review:</strong> {req.reviewComment}
                        </p>
                        {req.reviewedBy && (
                          <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "var(--space-1)" }}>
                            — {req.reviewedBy.name}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tasks Tab */}
      {tab === "tasks" && (
        <div>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title"><ListTodo size={20} style={{ display: "inline-block", verticalAlign: "middle", marginRight: 8 }} /> Tasks</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowTaskForm(!showTaskForm)}>
                <Plus size={14} /> Add Task
              </button>
            </div>

            {showTaskForm && (
              <form onSubmit={handleAddTask} style={{ marginBottom: "var(--space-4)", padding: "var(--space-4)", background: "var(--bg-muted)", borderRadius: "var(--radius-md)" }}>
                <div className="form-group">
                  <label className="form-label">Task Title</label>
                  <input className="form-input" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select className="form-select" value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Deadline</label>
                    <input type="datetime-local" className="form-input" value={taskForm.deadline} onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })} />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-sm">Create Task</button>
              </form>
            )}

            {event.tasks?.length === 0 ? (
              <div className="empty-state">
                <ListTodo size={48} />
                <h3>No tasks yet</h3>
                <p>Add tasks to track event execution</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {event.tasks?.map((task) => (
                  <div key={task.id} style={{
                    padding: "var(--space-4)",
                    background: "var(--bg-muted)",
                    borderRadius: "var(--radius-md)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{task.title}</div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: 2 }}>
                        {task.assignee ? `Assigned to ${task.assignee.name}` : "Unassigned"}
                        {task.deadline && ` • Due ${formatDate(task.deadline)}`}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                      <span className={`badge ${task.priority === "urgent" ? "badge-rejected" : task.priority === "high" ? "badge-pending" : "badge-draft"}`}>
                        {task.priority}
                      </span>
                      <span className={`badge ${task.status === "completed" ? "badge-approved" : task.status === "delayed" ? "badge-rejected" : "badge-pending"}`}>
                        {task.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-Events Tab - Festival Management */}
      {tab === "subevents" && event.eventType === "standard" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "var(--space-6)" }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">🎭 Festival Sub-Events Management</h3>
              <div style={{ display: "flex", gap: "var(--space-3)" }}>
                {event.status === "APPROVED" && (
                  <button className="btn btn-primary btn-sm" onClick={() => setShowSubEventForm(true)}>
                    <Plus size={16} /> Create Sub-Event
                  </button>
                )}
              </div>
            </div>

            {showSubEventForm && (
              <div style={{ marginBottom: "var(--space-6)", padding: "var(--space-5)", background: "var(--bg-muted)", borderRadius: "var(--radius-md)" }}>
                <h4 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-4)" }}>Create Sub-Event</h4>
                <form onSubmit={handleCreateSubEvent}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Title *</label>
                      <input
                        className="form-input"
                        placeholder="e.g. Coding Competition"
                        value={subEventForm.title}
                        onChange={(e) => setSubEventForm({ ...subEventForm, title: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Club *</label>
                      <select
                        className="form-select"
                        value={subEventForm.clubId}
                        onChange={(e) => setSubEventForm({ ...subEventForm, clubId: e.target.value })}
                        required
                      >
                        <option value="">Select club</option>
                        {event.participants?.map((p) => (
                          <option key={p.clubId} value={p.clubId}>{p.club.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Description *</label>
                    <textarea
                      className="form-textarea"
                      placeholder="Describe your sub-event..."
                      value={subEventForm.description}
                      onChange={(e) => setSubEventForm({ ...subEventForm, description: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Event Type</label>
                      <select
                        className="form-select"
                        value={subEventForm.type}
                        onChange={(e) => setSubEventForm({ ...subEventForm, type: e.target.value })}
                      >
                        <option value="tech">Technical</option>
                        <option value="cultural">Cultural</option>
                        <option value="sports">Sports</option>
                        <option value="workshop">Workshop</option>
                        <option value="seminar">Seminar</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Venue</label>
                      <input
                        className="form-input"
                        placeholder="e.g. Lab 201"
                        value={subEventForm.venue}
                        onChange={(e) => setSubEventForm({ ...subEventForm, venue: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Start Date</label>
                      <input
                        type="datetime-local"
                        className="form-input"
                        value={subEventForm.eventDate}
                        onChange={(e) => setSubEventForm({ ...subEventForm, eventDate: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">End Date</label>
                      <input
                        type="datetime-local"
                        className="form-input"
                        value={subEventForm.eventEndDate}
                        onChange={(e) => setSubEventForm({ ...subEventForm, eventEndDate: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
                    <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                      Create Sub-Event
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setShowSubEventForm(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {event.subEvents?.length === 0 ? (
              <div className="empty-state">
                <Calendar size={48} />
                <h3>No sub-events yet</h3>
                <p>Create sub-events for clubs within this standard event</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "var(--space-4)" }}>
                {event.subEvents?.map((subEvent) => (
                  <div
                    key={subEvent.id}
                    onClick={() => router.push(`/events/${subEvent.id}`)}
                    style={{
                      padding: "var(--space-4)",
                      background: "var(--bg-surface)",
                      borderRadius: "var(--radius-md)",
                      cursor: "pointer",
                      transition: "all var(--transition-fast)",
                      border: "1px solid var(--border-subtle)",
                      borderLeft: "3px solid var(--accent-primary)"
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = "var(--bg-surface-hover)"}
                    onMouseOut={(e) => e.currentTarget.style.background = "var(--bg-surface)"}
                  >
                    <div style={{ marginBottom: "var(--space-3)" }}>
                      <h4 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-1)" }}>
                        {subEvent.title}
                      </h4>
                      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                        <span className="badge badge-progress" style={{ fontSize: "10px", textTransform: "capitalize" }}>
                          {subEvent.type}
                        </span>
                        <span className="badge badge-approved" style={{ fontSize: "10px" }}>
                          {subEvent.club.name}
                        </span>
                      </div>
                    </div>

                    <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-3)", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {subEvent.description}
                    </p>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                      <span>By {subEvent.createdBy.name}</span>
                      <div style={{ display: "flex", gap: "var(--space-3)" }}>
                        {subEvent._count.resourceRequests > 0 && <span>📦 {subEvent._count.resourceRequests} requests</span>}
                        {subEvent._count.tasks > 0 && <span>✅ {subEvent._count.tasks} tasks</span>}
                        {subEvent._count.expenses > 0 && <span>💰 {subEvent._count.expenses} expenses</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
