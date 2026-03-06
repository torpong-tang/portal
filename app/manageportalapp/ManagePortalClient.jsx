"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const tabs = ["Dashboard", "Manage Application", "Log"];

export default function ManagePortalClient({ email }) {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [dashboard, setDashboard] = useState(null);
  const [logs, setLogs] = useState(null);
  const [busyRunApp, setBusyRunApp] = useState(null);
  const [busyCardApp, setBusyCardApp] = useState(null);
  const [busyTypeApp, setBusyTypeApp] = useState(null);
  const [toast, setToast] = useState({ message: "", type: "success" });
  const autoStartRef = useRef(false);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast({ message: "", type: "success" }), 2500);
  };

  const ensureDesiredRunning = async (apps) => {
    const shouldStart = (apps || []).filter((app) => app.desiredState === "RUN" && !app.running);
    if (!shouldStart.length || autoStartRef.current) return;

    autoStartRef.current = true;
    try {
      await Promise.all(
        shouldStart.map((app) =>
          fetch("/api/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: app.name }),
          })
        )
      );
    } finally {
      autoStartRef.current = false;
    }
  };

  const loadDashboard = async () => {
    const res = await fetch("/api/admin/dashboard", { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setDashboard(data);
    ensureDesiredRunning(data.apps);
  };

  const loadLogs = async () => {
    const res = await fetch("/api/admin/logs", { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    setLogs(data);
  };

  // Always poll dashboard
  useEffect(() => {
    loadDashboard();
    const id = setInterval(loadDashboard, 8000);
    return () => clearInterval(id);
  }, []);

  // Only poll logs when Log tab is active
  useEffect(() => {
    if (activeTab !== "Log") return;
    loadLogs();
    const id = setInterval(loadLogs, 8000);
    return () => clearInterval(id);
  }, [activeTab]);

  const setRunState = async (app, desiredState) => {
    if (app.desiredState === desiredState) return;
    setBusyRunApp(app.name);
    const res = await fetch(`/api/admin/apps/${app.name}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ desiredState }),
    });
    setBusyRunApp(null);
    showToast(
      res.ok ? `Updated ${app.name} to ${desiredState}` : `Failed to update ${app.name}`,
      res.ok ? "success" : "error"
    );
    loadDashboard();
    loadLogs();
  };

  const setCardVisibility = async (app, showCard) => {
    if (app.showCard === showCard) return;
    setBusyCardApp(app.name);
    const res = await fetch(`/api/admin/apps/${app.name}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ showCard }),
    });
    setBusyCardApp(null);
    showToast(
      res.ok ? `${app.name} card ${showCard ? "shown" : "hidden"}` : `Failed to update ${app.name}`,
      res.ok ? "success" : "error"
    );
    loadDashboard();
  };

  const setAppType = async (app, group) => {
    if (app.group === group) return;
    setBusyTypeApp(app.name);
    const res = await fetch(`/api/admin/apps/${app.name}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ group }),
    });
    setBusyTypeApp(null);
    showToast(
      res.ok ? `${app.name} type set to ${group}` : `Failed to update ${app.name}`,
      res.ok ? "success" : "error"
    );
    loadDashboard();
  };

  const clearLogs = async () => {
    const res = await fetch("/api/admin/logs", { method: "DELETE", credentials: "include" });
    showToast(res.ok ? "Logs cleared" : "Failed to clear logs", res.ok ? "success" : "error");
    loadLogs();
  };

  const resetDefaults = async () => {
    const res = await fetch("/api/admin/reset-state", { method: "POST", credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      showToast(`Reset success: ${data.count} applications`, "success");
    } else {
      showToast("Reset failed", "error");
    }
    loadDashboard();
    loadLogs();
  };

  const runtimeRows = useMemo(() => {
    if (!logs?.runtime) return [];
    return Object.entries(logs.runtime).map(([name, info]) => ({ name, ...info }));
  }, [logs]);

  const getRuntimeText = (app) => {
    if (app.desiredState === "RUN" && app.running) return "Running";
    if (app.desiredState === "STOP" && !app.running) return "Stopped";
    if (app.desiredState === "RUN" && !app.running) return "RUN selected, not running yet";
    return "STOP selected, still running";
  };

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <h1>manageportalapp</h1>
        <div className="admin-header-right">
          <span>{email}</span>
          <button
            className="admin-logout"
            onClick={async () => {
              await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
              window.close();
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <nav className="admin-nav">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`admin-tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      <main className="admin-main">
        {activeTab === "Dashboard" && dashboard && (
          <section>
            <div className="admin-stats-grid">
              <StatCard label="Total Apps" value={dashboard.totalApps} />
              <StatCard label="Running Apps" value={dashboard.runningApps} />
              <StatCard label="Visible Cards" value={dashboard.visibleApps} />
              <StatCard label="Total Open Count" value={dashboard.totalOpenCount} />
            </div>

            <h3>Application Usage</h3>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Application</th>
                  <th>Open Count</th>
                  <th>Last Opened</th>
                  <th>Runtime</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.apps.map((app) => (
                  <tr key={app.name}>
                    <td>{app.name}</td>
                    <td>{app.openCount}</td>
                    <td>{app.lastOpenedAt ? new Date(app.lastOpenedAt).toLocaleString() : "-"}</td>
                    <td>{getRuntimeText(app)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {activeTab === "Manage Application" && dashboard && (
          <section>
            <div className="admin-section-head">
              <h3>Manage Application</h3>
              <button className="admin-secondary-btn" onClick={resetDefaults}>
                Initialize Default App State
              </button>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Application</th>
                  <th>Run / Stop</th>
                  <th>Show Card</th>
                  <th>Type</th>
                  <th>Runtime</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.apps.map((app) => (
                  <tr key={app.name}>
                    <td>{app.name}</td>
                    <td>
                      <div className="state-control">
                        <span className={`state-label ${app.desiredState === "STOP" ? "active" : ""}`}>STOP</span>
                        <label className="state-switch" aria-label={`${app.name} run state`}>
                          <input
                            type="checkbox"
                            checked={app.desiredState === "RUN"}
                            disabled={busyRunApp === app.name}
                            onChange={(event) => setRunState(app, event.target.checked ? "RUN" : "STOP")}
                          />
                          <span className="state-slider" />
                        </label>
                        <span className={`state-label ${app.desiredState === "RUN" ? "active" : ""}`}>RUN</span>
                      </div>
                    </td>
                    <td>
                      <div className="state-control">
                        <span className={`state-label ${!app.showCard ? "active" : ""}`}>NOT SHOW</span>
                        <label className="state-switch" aria-label={`${app.name} card visibility`}>
                          <input
                            type="checkbox"
                            checked={app.showCard}
                            disabled={busyCardApp === app.name}
                            onChange={(event) => setCardVisibility(app, event.target.checked)}
                          />
                          <span className="state-slider" />
                        </label>
                        <span className={`state-label ${app.showCard ? "active" : ""}`}>SHOW</span>
                      </div>
                    </td>
                    <td>
                      <div className="state-control">
                        <span className={`state-label type-label ${app.group === "specific" ? "active" : ""}`}>บริการเฉพาะ</span>
                        <label className="state-switch" aria-label={`${app.name} app type`}>
                          <input
                            type="checkbox"
                            checked={app.group === "general"}
                            disabled={busyTypeApp === app.name}
                            onChange={(event) => setAppType(app, event.target.checked ? "general" : "specific")}
                          />
                          <span className="state-slider" />
                        </label>
                        <span className={`state-label type-label ${app.group === "general" ? "active" : ""}`}>บริการทั่วไป</span>
                      </div>
                    </td>
                    <td>{getRuntimeText(app)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {activeTab === "Log" && logs && (
          <section>
            <div className="admin-section-head">
              <h3>Runtime + Action Logs</h3>
              <button className="admin-logout" onClick={clearLogs}>Clear Log</button>
            </div>

            <div className="log-grid">
              {runtimeRows.map((app) => (
                <div key={app.name} className="log-card">
                  <h4>{app.name}</h4>
                  <p>{app.message}</p>
                  <div className="log-list">
                    {(app.logs || []).slice(-20).map((line, idx) => (
                      <div key={`${app.name}-${idx}`}>{line}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <h4 style={{ marginTop: 20 }}>Audit Log</h4>
            <div className="log-list audit-log">
              {logs.actionLogs.map((item) => (
                <div key={item.id}>
                  [{new Date(item.createdAt).toLocaleString()}] {item.action} {item.appName || "-"} - {item.message}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {toast.message && <div className={`admin-toast ${toast.type === "error" ? "error" : "success"}`}>{toast.message}</div>}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="admin-stat-card">
      <div>{label}</div>
      <strong>{value}</strong>
    </div>
  );
}
