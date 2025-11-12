"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN =
  "pk.eyJ1IjoiY2hhdGNoYWxlcm0iLCJhIjoiY21nZnpiYzU3MGRzdTJrczlkd3RxamN4YyJ9.k288gnCNLdLgczawiB79gQ";
mapboxgl.accessToken = MAPBOX_TOKEN;

const WEBSOCKET_URL = "ws://10.110.54.44:3000/";

const MAP_STYLES = {
  outdoors: "mapbox://styles/mapbox/outdoors-v12",
  satellite: "mapbox://styles/mapbox/satellite-v9",
  street3d: "mapbox://styles/mapbox/light-v11",
};

const DEFAULT_BASE = {
  lat: 14.2059,
  lng: 101.2134,
  mgrs: "48QXA123456",
  name: "ฐานปฏิบัติการหลัก",
};

/**
 * แสดง toolbar ด้านบนพร้อมข้อความสั้นและพิกัดฐาน
 */
function DefenseToolbar({ baseInfo, onFocusBase, cameraOrientation, wsStatus, wsError }) {
  return (
    <div style={toolbarStyle}>
      <div>
        <p style={toolbarTitleStyle}>แดชบอร์ดป้องกันพื้นที่ • ประเทศน้ำเงิน</p>
        <p style={toolbarSubtitleStyle}>ตรวจสอบสถานะโดรนและภัยคุกคามรอบฐาน</p>
        <div style={toolbarDetailsStyle}>
          <div>ละติจูด: {baseInfo.lat.toFixed(5)}</div>
          <div>ลองจิจูด: {baseInfo.lng.toFixed(5)}</div>
          <div>MGRS: {baseInfo.mgrs}</div>
        </div>
      </div>
      <div style={toolbarActionsStyle}>
        <button type="button" style={toolbarButtonStyle} onClick={onFocusBase}>
          โฟกัสฐานทัพ
        </button>
        <button type="button" style={toolbarButtonStyle}>
          History
        </button>
        <div style={compassStyle}>
          <div style={{ ...compassArrowStyle, transform: `rotate(${cameraOrientation}deg)` }} />
          <span>ทิศกล้อง</span>
        </div>

      </div>
    </div>
  );
}

/**
 * ฟอร์มรับข้อมูลกล้อง และดึงพิกัดจาก API เพื่อกำหนดฐาน
 */
function CameraInfoForm({ onLoadCameraInfo }) {
  const [camId, setCamId] = useState("");
  const [token, setToken] = useState("");

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!camId) return;
      try {
        const response = await fetch(`/api/object-detection/info/${camId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!response.ok) {
          throw new Error("ไม่สามารถดึงข้อมูลกล้องได้");
        }
        const data = await response.json();
        onLoadCameraInfo({
          camId,
          name: data.name ?? `CAM-${camId}`,
          lat: data.lat ?? DEFAULT_BASE.lat,
          lng: data.lng ?? DEFAULT_BASE.lng,
          mgrs: data.mgrs ?? DEFAULT_BASE.mgrs,
          timestamp: data.time ?? new Date().toISOString(),
          orientation: data.orientation ?? 0,
        });
      } catch (error) {
        console.error("camera info error", error);
      }
    },
    [camId, token, onLoadCameraInfo],
  );

  return (
    <form style={formStyle} onSubmit={handleSubmit}>
      <div style={formRowStyle}>
        <label>Camera ID</label>
        <input
          type="text"
          value={camId}
          onChange={(event) => setCamId(event.target.value)}
          style={inputStyle}
          placeholder="ระบุรหัสกล้อง"
        />
      </div>
      <div style={formRowStyle}>
        <label>Token</label>
        <input
          type="text"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          style={inputStyle}
          placeholder="ระบุ Token (ถ้ามี)"
        />
      </div>
      <button type="submit" style={submitStyle}>
        ดึงข้อมูลกล้อง
      </button>
    </form>
  );
}

/**
 * แสดงการ์ดรายการโดรนแบบเรียลไทม์
 */
function LiveDronePanel({ drones }) {
  return (
    <div style={leftPanelStyle}>
      <h3>ภาพเรียลไทม์จากโดรน (Pi Node)</h3>
      {drones.length === 0 ? (
        <p>ยังไม่มีข้อมูลโดรน</p>
      ) : (
        <div style={droneListStyle}>
          {drones.map((drone) => (
            <div key={drone.droneId} style={droneCardStyle}>
              <strong>ID: {drone.droneId}</strong>
              <p>
                พิกัด: {drone.lat.toFixed(5)}, {drone.lng.toFixed(5)}
              </p>
              <p>ล่าสุด: {new Date(drone.time).toLocaleTimeString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * ให้ผู้ใช้เลือกไตล์แผนที่แบบต่าง ๆ
 */
function MapStyleCustomizer({ styleKey, onChange }) {
  return (
    <div style={customizerStyle}>
      <h4>ตั้งค่าแผนที่</h4>
      {Object.entries({
        outdoors: "Outdoors",
        satellite: "Satellite",
        street3d: "Light 3D",
      }).map(([key, label]) => (
        <label key={key} style={customizerOptionStyle}>
          <input
            type="radio"
            name="map-style"
            value={key}
            checked={styleKey === key}
            onChange={() => onChange(key)}
          />
          {label}
        </label>
      ))}
    </div>
  );
}

/***** สไตล์ inline เพื่อจัด Layout *****/
const toolbarStyle = {
  padding: "1rem 2rem",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "1.5rem",
  background: "rgba(3,7,18,0.9)",
};
const toolbarTitleStyle = { margin: 0, fontSize: "1.1rem", fontWeight: 600 };
const toolbarSubtitleStyle = { margin: "0.25rem 0 0", fontSize: "0.9rem" };
const toolbarDetailsStyle = {
  display: "flex",
  gap: "1rem",
  fontSize: "0.85rem",
  color: "#cbd5f5",
};
const toolbarActionsStyle = { display: "flex", alignItems: "center", gap: "0.75rem" };
const toolbarButtonStyle = {
  padding: "0.55rem 1rem",
  borderRadius: "0.45rem",
  border: "none",
  background: "#2563eb",
  color: "#fff",
  cursor: "pointer",
};
const compassStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  fontSize: "0.75rem",
};
const compassArrowStyle = {
  width: "20px",
  height: "20px",
  borderLeft: "2px solid #facc15",
  borderTop: "2px solid #facc15",
  transformOrigin: "center",
  marginBottom: "0.2rem",
  transition: "transform 0.3s ease",
};
const formStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "0.65rem",
  padding: "1rem",
  background: "rgba(8,17,46,0.85)",
  borderRadius: "0.75rem",
};
const formRowStyle = { display: "flex", flexDirection: "column", gap: "0.35rem" };
const inputStyle = {
  padding: "0.55rem",
  borderRadius: "0.35rem",
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(15,23,42,0.9)",
  color: "#fff",
};
const submitStyle = {
  marginTop: "0.35rem",
  padding: "0.55rem",
  borderRadius: "0.35rem",
  border: "none",
  background: "#0ea5e9",
  color: "#fff",
  cursor: "pointer",
};
const leftPanelStyle = {
  minWidth: "240px",
  maxWidth: "280px",
  background: "rgba(3,7,18,0.8)",
  padding: "1rem",
  borderRadius: "0.75rem",
  color: "#e2e8f0",
  fontSize: "0.9rem",
};
const droneListStyle = { display: "flex", flexDirection: "column", gap: "0.75rem" };
const droneCardStyle = {
  padding: "0.65rem",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "0.55rem",
  background: "rgba(15,23,42,0.65)",
};
const customizerStyle = {
  marginTop: "1rem",
  padding: "1rem",
  background: "rgba(3,7,18,0.8)",
  borderRadius: "0.75rem",
  minWidth: "180px",
};
const customizerOptionStyle = { display: "block", fontSize: "0.85rem", margin: "0.3rem 0" };
const iconBaseStyle = {
  marginTop: "0.75rem",
  padding: "0.75rem",
  background: "rgba(14,165,233,0.08)",
  borderRadius: "0.5rem",
  border: "1px dashed rgba(14,165,233,0.6)",
  fontSize: "0.85rem",
};

/**
 * คอมโพเนนต์หลักที่ประกอบแผนที่ พาเนลข้าง ๆ และ WebSocket
 */
export default function DefensiveDashboard() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const droneMarkersRef = useRef(new Map());
  const [mapStyleKey, setMapStyleKey] = useState("outdoors");
  const [baseInfo, setBaseInfo] = useState(DEFAULT_BASE);
  const [cameraInfo, setCameraInfo] = useState(null);
  const [drones, setDrones] = useState([]);

  const mapStyle = useMemo(() => MAP_STYLES[mapStyleKey], [mapStyleKey]);

  const handleFocusBase = useCallback(() => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: [baseInfo.lng, baseInfo.lat],
      zoom: 14,
      essential: true,
    });
  }, [baseInfo]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLES[mapStyleKey],
      center: [DEFAULT_BASE.lng, DEFAULT_BASE.lat],
      zoom: 13,
      pitch: 45,
      bearing: 0,
      antialias: true,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapStyleKey]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(mapStyle);
  }, [mapStyle]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.WebSocket !== "function") return undefined;

    const socket = new WebSocket(WEBSOCKET_URL);

    const handleMessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!Array.isArray(payload)) return;
      setDrones(payload);
    };

    socket.addEventListener("message", handleMessage);

    return () => {
      socket.removeEventListener("message", handleMessage);
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const liveIds = new Set();

    drones.forEach((drone) => {
      const key = String(drone.droneId);
      liveIds.add(key);
      const existing = droneMarkersRef.current.get(key);
      const lngLat = [drone.lng, drone.lat];
      const popupContent = `
        <div style="font-size:0.85rem;">
          <strong>Drone ${key}</strong><br/>
          พิกัด: ${drone.lat.toFixed(5)}, ${drone.lng.toFixed(5)}<br/>
          เวลา: ${new Date(drone.time).toLocaleTimeString()}
        </div>`;

      if (existing) {
        existing.marker.setLngLat(lngLat);
        existing.popup.setLngLat(lngLat).setHTML(popupContent);
      } else {
        const markerEl = document.createElement("div");
        markerEl.style.width = "18px";
        markerEl.style.height = "18px";
        markerEl.style.background = "rgba(239,68,68,0.9)";
        markerEl.style.borderRadius = "50%";
        markerEl.style.boxShadow = "0 0 10px rgba(239,68,68,0.7)";

        const marker = new mapboxgl.Marker({ element: markerEl })
          .setLngLat(lngLat)
          .addTo(map);
        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(popupContent);
        marker.setPopup(popup);
        droneMarkersRef.current.set(key, { marker, popup });
      }
    });

    droneMarkersRef.current.forEach((value, key) => {
      if (!liveIds.has(key)) {
        value.marker.remove();
        value.popup.remove();
        droneMarkersRef.current.delete(key);
      }
    });
  }, [drones]);

  const cameraOrientation = cameraInfo?.orientation ?? 0;

  const handleCameraInfo = useCallback(
    ({ lat, lng, mgrs, name, timestamp, camId, orientation }) => {
      setBaseInfo({ lat, lng, mgrs, name });
      setCameraInfo({ camId, name, timestamp });
      setDrones((prev) => [...prev]); // could trigger rerender to recalc boxes
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 14 });
    },
    [],
  );

  return (
    <div style={rootStyle}>
      <DefenseToolbar
        baseInfo={baseInfo}
        onFocusBase={handleFocusBase}
        cameraOrientation={cameraOrientation}
      />
      <div style={contentStyle}>
        <LiveDronePanel drones={drones} />
        <div style={mapColumnStyle}>
          <div ref={mapContainerRef} style={mapContainerStyle} />
        </div>
        <div style={rightPanelStyle}>
          <CameraInfoForm onLoadCameraInfo={handleCameraInfo} />
          <div style={iconBaseStyle}>
            <strong>Icon ฐานทัพ</strong>
            <p>Camera: {cameraInfo?.name ?? "ยังไม่ระบุ"}</p>
            <p>พิกัด: {baseInfo.lat.toFixed(5)}, {baseInfo.lng.toFixed(5)}</p>
            <p>
              เวลา:{" "}
              {cameraInfo?.timestamp
                ? new Date(cameraInfo.timestamp).toLocaleTimeString()
                : "-"}
            </p>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: "1rem", paddingTop: "1rem" }}>
            <MapStyleCustomizer styleKey={mapStyleKey} onChange={setMapStyleKey} />
          </div>
        </div>
      </div>
    </div>
  );
}

const rootStyle = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  background: "#020617",
  color: "#f8fafc",
};
const contentStyle = {
  flex: 1,
  display: "grid",
  gridTemplateColumns: "minmax(240px, 300px) minmax(420px, 1fr) minmax(240px, 300px)",
  gap: "1rem",
  padding: "1.5rem",
};
const mapColumnStyle = {
  borderRadius: "1rem",
  overflow: "hidden",
  background: "rgba(2,6,23,0.85)",
  minHeight: "60vh",
  display: "flex",
};
const mapContainerStyle = {
  flex: 1,
};
const rightPanelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};
