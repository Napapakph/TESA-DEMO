/**
 * Box Layout Example Component
 * Demonstrates various box sizes, loading states, and content types
 */
"use client";

import { useState } from "react";
import DashboardBox from "@/app/components/DashboardBox";
import BoxSkeleton from "@/app/components/BoxSkeleton";
import "@/app/styles/box-layout.css";

export default function BoxLayoutExample() {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="box-grid">
      {/* Example 1: Status Summary (2x1) */}
      <DashboardBox title="System Status" spanClass="span-2x1">
        <div className="data-grid">
          <div className="data-item">
            <div className="data-label">CPU Usage</div>
            <div className="data-value highlight">45%</div>
          </div>
          <div className="data-item">
            <div className="data-label">Memory</div>
            <div className="data-value">2.1 GB</div>
          </div>
          <div className="data-item">
            <div className="data-label">Temperature</div>
            <div className="data-value warning">68°C</div>
          </div>
          <div className="data-item">
            <div className="data-label">Battery</div>
            <div className="data-value danger">15%</div>
          </div>
        </div>
      </DashboardBox>

      {/* Example 2: Connection Status (1x1) */}
      <DashboardBox title="Connection" spanClass="span-1x1">
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="status-dot online" />
            <span>Socket.IO</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="status-dot online" />
            <span>GPS</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="status-dot offline" />
            <span>Telemetry</span>
          </div>
        </div>
      </DashboardBox>

      {/* Example 3: Quick Stats (1x1) */}
      <DashboardBox title="Detected" spanClass="span-1x1" badge={7}>
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div style={{ fontSize: "48px", fontWeight: "700", color: "#38bdf8" }}>
            7
          </div>
          <div style={{ fontSize: "14px", color: "rgba(148, 163, 184, 0.8)", marginTop: "8px" }}>
            Active Targets
          </div>
        </div>
      </DashboardBox>

      {/* Example 4: Map/Chart Placeholder (4x3) */}
      <DashboardBox title="Tactical Map" spanClass="span-4x3" noPadding className="map-box">
        <div className="fill-parent" style={{
          background: "linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "32px",
          color: "rgba(148, 163, 184, 0.5)"
        }}>
          🗺️ Map Component Here
        </div>
      </DashboardBox>

      {/* Example 5: List with Loading State (2x2) */}
      <DashboardBox title="Threat List" spanClass="span-2x2" badge={3}>
        {isLoading ? (
          <BoxSkeleton lines={6} />
        ) : (
          <div className="box-list">
            <div className="box-list-item active">
              <div style={{ fontWeight: "600", marginBottom: "4px" }}>Drone #1 - DJI Phantom</div>
              <div style={{ fontSize: "12px", color: "rgba(148, 163, 184, 0.7)" }}>
                Distance: 1.2 km • Speed: 8.5 m/s
              </div>
            </div>
            <div className="box-list-item">
              <div style={{ fontWeight: "600", marginBottom: "4px" }}>Drone #2 - Autel EVO</div>
              <div style={{ fontSize: "12px", color: "rgba(148, 163, 184, 0.7)" }}>
                Distance: 2.8 km • Speed: 12.3 m/s
              </div>
            </div>
            <div className="box-list-item">
              <div style={{ fontWeight: "600", marginBottom: "4px" }}>Drone #3 - Unknown</div>
              <div style={{ fontSize: "12px", color: "rgba(148, 163, 184, 0.7)" }}>
                Distance: 0.5 km • Speed: 5.2 m/s
              </div>
            </div>
          </div>
        )}
        <button
          onClick={() => setIsLoading(!isLoading)}
          style={{
            marginTop: "12px",
            padding: "8px 16px",
            background: "#38bdf8",
            color: "#0f172a",
            borderRadius: "6px",
            fontWeight: "600",
            fontSize: "13px"
          }}
        >
          Toggle Loading
        </button>
      </DashboardBox>

      {/* Example 6: Alert Log (2x2) */}
      <DashboardBox title="Recent Alerts" spanClass="span-2x2" badge={5}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
          {[
            { time: "14:32:15", msg: "New drone detected", type: "danger" },
            { time: "14:30:42", msg: "Perimeter breach", type: "warning" },
            { time: "14:28:10", msg: "GPS signal weak", type: "warning" },
            { time: "14:25:33", msg: "System online", type: "online" },
            { time: "14:20:00", msg: "Scan initiated", type: "online" },
          ].map((alert, i) => (
            <div key={i} style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 12px",
              background: "rgba(30, 41, 59, 0.4)",
              borderRadius: "6px",
              borderLeft: `3px solid ${
                alert.type === "danger" ? "#ef4444" :
                alert.type === "warning" ? "#fb923c" : "#22c55e"
              }`
            }}>
              <span style={{ fontFamily: "monospace", color: "rgba(148, 163, 184, 0.7)" }}>
                {alert.time}
              </span>
              <span style={{ flex: 1 }}>{alert.msg}</span>
            </div>
          ))}
        </div>
      </DashboardBox>

      {/* Example 7: Empty State (2x1) */}
      <DashboardBox title="Waypoints" spanClass="span-2x1">
        <div className="box-empty">
          <div className="box-empty-icon">📍</div>
          <div>No waypoints set</div>
          <button style={{
            marginTop: "12px",
            padding: "6px 12px",
            background: "rgba(56, 189, 248, 0.2)",
            color: "#38bdf8",
            borderRadius: "4px",
            fontSize: "12px",
            border: "1px solid rgba(56, 189, 248, 0.3)"
          }}>
            Add Waypoint
          </button>
        </div>
      </DashboardBox>

      {/* Example 8: Controls (2x1) */}
      <DashboardBox title="Mission Control" spanClass="span-2x1">
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <label style={{ fontSize: "13px" }}>
            <div style={{ marginBottom: "6px", color: "rgba(148, 163, 184, 0.8)" }}>
              Target Coordinates
            </div>
            <input
              type="text"
              placeholder="14.2059, 101.2134"
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "rgba(30, 41, 59, 0.6)",
                border: "1px solid rgba(148, 163, 184, 0.3)",
                borderRadius: "6px",
                color: "#e2e8f0",
                fontSize: "14px"
              }}
            />
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            <button style={{
              flex: 1,
              padding: "10px",
              background: "#38bdf8",
              color: "#0f172a",
              borderRadius: "6px",
              fontWeight: "600",
              fontSize: "14px"
            }}>
              Deploy
            </button>
            <button style={{
              flex: 1,
              padding: "10px",
              background: "rgba(239, 68, 68, 0.2)",
              color: "#ef4444",
              borderRadius: "6px",
              fontWeight: "600",
              fontSize: "14px",
              border: "1px solid rgba(239, 68, 68, 0.3)"
            }}>
              Abort
            </button>
          </div>
        </div>
      </DashboardBox>

      {/* Example 9: 1x2 Tall Box */}
      <DashboardBox title="Sensor Data" spanClass="span-1x2">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {["Altitude", "Speed", "Heading", "Battery", "Signal"].map((sensor, i) => (
            <div key={i}>
              <div style={{
                fontSize: "11px",
                color: "rgba(148, 163, 184, 0.7)",
                marginBottom: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
                {sensor}
              </div>
              <div style={{
                height: "6px",
                background: "rgba(30, 41, 59, 0.6)",
                borderRadius: "3px",
                overflow: "hidden"
              }}>
                <div style={{
                  height: "100%",
                  width: `${Math.random() * 100}%`,
                  background: "linear-gradient(90deg, #38bdf8, #0ea5e9)",
                  borderRadius: "3px"
                }} />
              </div>
            </div>
          ))}
        </div>
      </DashboardBox>

      {/* Example 10: 3x2 Wide Box */}
      <DashboardBox title="Timeline" spanClass="span-3x2">
        <div style={{
          display: "flex",
          gap: "16px",
          overflowX: "auto",
          padding: "12px 0"
        }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{
              minWidth: "120px",
              padding: "16px",
              background: "rgba(30, 41, 59, 0.4)",
              borderRadius: "8px",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "24px", marginBottom: "8px" }}>
                {["🎯", "🚁", "📡", "⚠️", "✅", "🔍", "📊", "🛡️"][i]}
              </div>
              <div style={{ fontSize: "12px", color: "rgba(148, 163, 184, 0.7)" }}>
                Event #{i + 1}
              </div>
              <div style={{ fontSize: "11px", marginTop: "4px", fontFamily: "monospace" }}>
                14:{20 + i}:00
              </div>
            </div>
          ))}
        </div>
      </DashboardBox>
    </div>
  );
}

/**
 * Usage:
 * 
 * Import this component in your page:
 * 
 * import BoxLayoutExample from "@/app/components/examples/BoxLayoutExample";
 * 
 * export default function ExamplePage() {
 *   return <BoxLayoutExample />;
 * }
 * 
 * Or integrate individual boxes into your own layout.
 */

