"use client";

import { useState, useCallback } from "react";

const API_BASE_URL = "https://tesa-api.crma.dev";
const DEFAULT_BASE = {
  lat: 14.2059,
  lng: 101.2134,
  mgrs: "48QXA123456",
  name: "ฐานปฏิบัติการหลัก",
};

export default function RightSideBar({
  mapStyleKey,
  onMapStyleChange,
  layers,
  onLayerToggle,
  cameraInfo,
  onCameraInfoLoad,
  onClearCamera,
}) {
  const [camId, setCamId] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!camId.trim()) {
        setError("กรุณาระบุรหัสกล้อง");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const headers = {};
        if (token.trim()) {
          headers["x-camera-token"] = token.trim();
        }

        const response = await fetch(
          `${API_BASE_URL}/api/object-detection/info/${encodeURIComponent(camId)}`,
          {
            method: "GET",
            headers,
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            response.status === 404
              ? "ไม่พบข้อมูลกล้องที่ระบุ"
              : response.status === 401 || response.status === 403
                ? "Token ไม่ถูกต้องหรือไม่มีสิทธิ์เข้าถึง"
                : `ไม่สามารถดึงข้อมูลกล้องได้ (${response.status}: ${errorText || response.statusText})`
          );
        }

        const responseData = await response.json();
        
        // Handle new API structure: { success: true, data: {...} }
        const data = responseData.success && responseData.data ? responseData.data : responseData;
        
        onCameraInfoLoad({
          camId: camId,
          id: data.id || camId,
          name: data.name ?? `CAM-${camId}`,
          location: data.location || "",
          lat: data.lat ?? DEFAULT_BASE.lat,
          lng: data.lng ?? DEFAULT_BASE.lng,
          mgrs: data.mgrs ?? DEFAULT_BASE.mgrs,
          timestamp: data.timestamp ?? data.time ?? new Date().toISOString(),
          orientation: data.orientation ?? 0,
          token: data.token || token,
          sort: data.sort,
          Institute: data.Institute,
          ...data,
        });
        setError("");
      } catch (error) {
        console.error("camera info error", error);
        setError(error.message || "เกิดข้อผิดพลาดในการดึงข้อมูล");
      } finally {
        setLoading(false);
      }
    },
    [camId, token, onCameraInfoLoad]
  );

  const handleClear = useCallback(() => {
    if (!showClearConfirm) {
      setShowClearConfirm(true);
      return;
    }

    setCamId("");
    setToken("");
    setError("");
    setShowClearConfirm(false);
    onClearCamera?.();
  }, [showClearConfirm, onClearCamera]);

  return (
    <div className="right-panel">
      {/* Camera Info Form Section */}
      <div className="camera-form-section">
        <form className="camera-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <label htmlFor="cam-id">🎥 Camera ID</label>
            <input
              id="cam-id"
              type="text"
              value={camId}
              onChange={(event) => {
                setCamId(event.target.value);
                setError("");
                setShowClearConfirm(false);
              }}
              placeholder="เช่น cam001, cam002"
              disabled={loading}
            />
          </div>
          <div className="form-row">
            <label htmlFor="cam-token">🔐 Token (ไม่บังคับ)</label>
            <input
              id="cam-token"
              type="text"
              value={token}
              onChange={(event) => {
                setToken(event.target.value);
                setError("");
                setShowClearConfirm(false);
              }}
              placeholder="ระบุ Token ถ้ามี"
              disabled={loading}
            />
          </div>
          {error && <div className="form-error">⚠️ {error}</div>}
          <div className="form-actions">
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? "⏳ กำลังดึงข้อมูล..." : "📡 ดึงข้อมูลกล้อง"}
            </button>
            {(camId || token || cameraInfo) && (
              <button
                type="button"
                className="clear-btn"
                onClick={handleClear}
                disabled={loading}
              >
                {showClearConfirm ? "✅ ยืนยันล้าง" : "🗑️ ล้างค่า"}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Camera Info Display */}
      <div className="base-box">
        <div className="base-box-header">
          <strong>📷 ข้อมูลกล้อง</strong>
        </div>
        {cameraInfo ? (
          <div className="camera-info-details">
            <div className="info-row">
              <span className="info-label">ID:</span>
              <span className="info-value">{cameraInfo.id || cameraInfo.camId || "N/A"}</span>
            </div>
            <div className="info-row">
              <span className="info-label">ชื่อ:</span>
              <span className="info-value">{cameraInfo.name || `CAM-${cameraInfo.camId || "N/A"}`}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Location:</span>
              <span className="info-value">{cameraInfo.location || "N/A"}</span>
            </div>
            <div className="info-row">
              <span className="info-label">ละติจูด:</span>
              <span className="info-value">
                {cameraInfo.lat !== null && cameraInfo.lat !== undefined 
                  ? cameraInfo.lat.toFixed(5) 
                  : "-"}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">ลองจิจูด:</span>
              <span className="info-value">
                {cameraInfo.lng !== null && cameraInfo.lng !== undefined 
                  ? cameraInfo.lng.toFixed(5) 
                  : "-"}
              </span>
            </div>
            {cameraInfo.mgrs && (
              <div className="info-row">
                <span className="info-label">MGRS:</span>
                <span className="info-value">{cameraInfo.mgrs}</span>
              </div>
            )}
            {cameraInfo.orientation !== null && cameraInfo.orientation !== undefined && (
              <div className="info-row">
                <span className="info-label">ทิศทาง:</span>
                <span className="info-value">{cameraInfo.orientation.toFixed(1)}°</span>
              </div>
            )}
          </div>
        ) : (
          <p style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "0.85rem" }}>
            ยังไม่มีการโหลดข้อมูลกล้อง
          </p>
        )}
      </div>

      {/* Layer Control Section */}
      <div className="layer-control-section">
        <div className="map-customizer">
          <h4>🗺️ Layer Control</h4>
          <div style={{ marginBottom: "1.5rem" }}>
            <div
              style={{
                marginBottom: "0.5rem",
                fontSize: "0.75rem",
                color: "rgba(255, 255, 255, 0.7)",
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              Map Style
            </div>
            {Object.entries({
              outdoors: "🌲 Outdoors",
              satellite: "🛰️ Satellite",
              street3d: "🏙️ Street 3D",
            }).map(([key, label]) => (
              <label key={key} className="customizer-option">
                <input
                  type="radio"
                  name="map-style"
                  value={key}
                  checked={mapStyleKey === key}
                  onChange={() => onMapStyleChange(key)}
                />
                {label}
              </label>
            ))}
          </div>

          <div>
            <div
              style={{
                marginBottom: "0.5rem",
                fontSize: "0.75rem",
                color: "rgba(255, 255, 255, 0.7)",
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              Data Layers
            </div>
            {layers.map((layer) => (
              <label key={layer.id} className="customizer-option">
                <input
                  type="checkbox"
                  checked={layer.enabled}
                  onChange={() => onLayerToggle(layer.id)}
                />
                <span style={{ color: layer.color }}>{layer.icon} {layer.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

