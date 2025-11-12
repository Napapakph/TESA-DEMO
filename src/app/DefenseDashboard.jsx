"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import mgrs from "mgrs";
import "@/app/styles/defense-dashboard.css";

const SOCKET_URL = "http://192.168.1.104:3000";
const BASE_POSITION = { lat: 14.2059, lng: 101.2134 };
const DRONE_ICON_SRC = "/drone.png";

function createLiveIntruderEntry(entry, previous) {
  const prev = previous ?? {};

  const rawLat = typeof entry.lat === "number" ? entry.lat : entry.latitude;
  const rawLng = typeof entry.lng === "number" ? entry.lng : entry.lon ?? entry.longitude;
  const lat = Number.isFinite(rawLat) ? rawLat : null;
  const lng = Number.isFinite(rawLng) ? rawLng : null;
  const position = lat !== null && lng !== null
    ? { lat, lng }
    : prev.position ?? { lat: BASE_POSITION.lat, lng: BASE_POSITION.lng };

  const droneId = entry.id ?? entry.droneId ?? prev.id ?? "unknown";

  let lastSeen = entry.time ?? entry.timestamp ?? prev.lastSeen ?? new Date().toISOString();
  if (typeof lastSeen === "number") {
    lastSeen = new Date(lastSeen * 1000).toISOString();
  }

  return {
    id: String(droneId),
    name: entry.type ?? prev.name ?? `Drone ${droneId}`,
    position,
    velocity: Number.isFinite(entry.velocity)
      ? entry.velocity
      : Number.isFinite(prev.velocity) ? prev.velocity : null,
    direction: Number.isFinite(entry.direction)
      ? entry.direction
      : Number.isFinite(prev.direction) ? prev.direction : 0,
    camId: entry.cam_id ?? entry.cameraId ?? entry.camId ?? prev.camId ?? "",
    frame: entry.frame ?? prev.frame ?? null,
    imgbase64: entry.imgbase64 ?? prev.imgbase64 ?? null,
    lastSeen,
  };
}

function buildLiveIntruders(payload, previous = []) {
  const previousMap = new Map(previous.map((intruder) => [intruder.id, intruder]));

  if (!Array.isArray(payload)) {
    return previous;
  }

  return payload.map((entry) => {
    const entryId = String(entry.id ?? entry.droneId ?? "unknown");
    const prev = previousMap.get(entryId);
    return createLiveIntruderEntry(entry, prev);
  });
}

function escapeHtml(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function formatVelocity(value) {
  if (!Number.isFinite(value)) return "N/A";
  return `${value.toFixed(2)} m/s`;
}

function formatDirection(value) {
  if (!Number.isFinite(value)) return "N/A";
  return `${value.toFixed(1)}°`;
}

function renderDronePopupContent(intruder) {
  const imageSource = intruder.imgbase64 || DRONE_ICON_SRC;
  const safeName = escapeHtml(intruder.name ?? intruder.id ?? "Unknown Drone");
  const safeId = escapeHtml(intruder.id ?? "-");

  return `
    <div class="drone-popup-card">
      <div class="drone-popup-media">
        <img src="${escapeHtml(imageSource)}" alt="${safeName}">
      </div>
      <div class="drone-popup-body">
        <div class="drone-popup-title">${safeName}</div>
        <div class="drone-popup-meta">ID: ${safeId}</div>
        <div class="drone-popup-meta">Velocity: ${escapeHtml(formatVelocity(intruder.velocity))}</div>
        <div class="drone-popup-meta">Direction: ${escapeHtml(formatDirection(intruder.direction))}</div>
      </div>
    </div>
  `;
}

function createIntruderIcon(intruder) {
  const heading = Number.isFinite(intruder.direction) ? intruder.direction : 0;
  const imageSource = intruder.imgbase64 || DRONE_ICON_SRC;
  const safeSource = escapeHtml(imageSource);
  return L.divIcon({
    className: "drone-marker",
    html: `
      <div class="drone-marker-wrapper" style="transform: rotate(${heading}deg)">
        <img class="drone-marker-image" src="${safeSource}" alt="${escapeHtml(intruder.name ?? "drone")}" />
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}

export default function DefenseDashboard() {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const intruderLayerRef = useRef(null);
  const intruderMarkersRef = useRef(new Map());

  const [socketStatus, setSocketStatus] = useState("connecting");
  const [intruders, setIntruders] = useState([]);
  const [cameraInfo, setCameraInfo] = useState([]);
  const [cameraIdInput, setCameraIdInput] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [cameraToken, setCameraToken] = useState("");
  const [lastClicked, setLastClicked] = useState(null);
  const [lastClickedMgrs, setLastClickedMgrs] = useState(null);

  const activeCamera = useMemo(() => {
    if (!selectedCameraId) return null;
    return cameraInfo.find((cam) => cam.cam_id === selectedCameraId) ?? null;
  }, [cameraInfo, selectedCameraId]);

  const cameraLocation = useMemo(() => {
    if (!activeCamera) return null;
    const { cam_lat, cam_lon } = activeCamera;
    if (!Number.isFinite(cam_lat) || !Number.isFinite(cam_lon)) return null;
    let cameraMgrs = null;
    try {
      cameraMgrs = mgrs.forward([cam_lon, cam_lat], 5);
    } catch (error) {
      cameraMgrs = null;
    }
    return { lat: cam_lat, lon: cam_lon, mgrs: cameraMgrs };
  }, [activeCamera]);

  const primaryFocusPosition = useMemo(() => {
    if (intruders.length > 0) {
      return intruders[0].position;
    }
    if (cameraLocation) {
      return { lat: cameraLocation.lat, lng: cameraLocation.lon };
    }
    return BASE_POSITION;
  }, [intruders, cameraLocation]);

  const subtitleText = useMemo(() => {
    if (cameraLocation) {
      const parts = [
        `Camera ${selectedCameraId || activeCamera?.cam_id || ""}`.trim(),
        `Lat ${cameraLocation.lat.toFixed(5)}`,
        `Lon ${cameraLocation.lon.toFixed(5)}`,
        cameraLocation.mgrs ? `MGRS ${cameraLocation.mgrs}` : "MGRS N/A",
      ];
      return parts.filter(Boolean).join(" • ");
    }
    return "Camera location: Unknown";
  }, [cameraLocation, selectedCameraId, activeCamera]);

  const handleMapClick = useCallback((event) => {
    const coords = { lat: event.latlng.lat, lng: event.latlng.lng };
    setLastClicked(coords);
    try {
      setLastClickedMgrs(mgrs.forward([coords.lng, coords.lat], 5));
    } catch (error) {
      setLastClickedMgrs(null);
    }
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [BASE_POSITION.lat, BASE_POSITION.lng],
      zoom: 13,
      minZoom: 6,
      maxZoom: 19,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    intruderLayerRef.current = L.layerGroup().addTo(map);
    map.on("click", handleMapClick);
    mapRef.current = map;

    return () => {
      map.off("click", handleMapClick);
      map.remove();
      mapRef.current = null;
      intruderLayerRef.current = null;
      intruderMarkersRef.current.clear();
    };
  }, [handleMapClick]);

  const handleFocusPrimary = useCallback(() => {
    if (!mapRef.current || !primaryFocusPosition) return;
    const currentZoom = mapRef.current.getZoom();
    mapRef.current.flyTo([primaryFocusPosition.lat, primaryFocusPosition.lng], Math.max(currentZoom, 14), {
      duration: 0.8,
    });
  }, [primaryFocusPosition]);

  const handleCameraSubmit = useCallback((event) => {
    event.preventDefault();
    const trimmedId = cameraIdInput.trim();
    setSelectedCameraId(trimmedId);
    setCameraToken(tokenInput.trim());
  }, [cameraIdInput, tokenInput]);

  useEffect(() => {
    if (!selectedCameraId && cameraInfo.length > 0) {
      const defaultId = cameraInfo[0]?.cam_id ?? "";
      setSelectedCameraId(defaultId);
      if (!cameraIdInput) {
        setCameraIdInput(defaultId);
      }
    }
  }, [cameraInfo, selectedCameraId, cameraIdInput]);

  useEffect(() => {
    if (!mapRef.current || !intruderLayerRef.current) return;

    const activeIds = new Set();

    intruders.forEach((intruder) => {
      if (!intruder.position || !Number.isFinite(intruder.position.lat) || !Number.isFinite(intruder.position.lng)) {
        return;
      }

      activeIds.add(intruder.id);
      const existing = intruderMarkersRef.current.get(intruder.id);

      if (!existing) {
        const marker = L.marker(intruder.position, {
          icon: createIntruderIcon(intruder),
          bubblingMouseEvents: false,
        }).addTo(intruderLayerRef.current);

        marker.bindPopup(renderDronePopupContent(intruder), {
          closeButton: false,
          autoPan: false,
          className: "drone-popup",
        });

        marker.on("mouseover", () => {
          marker.openPopup();
        });
        marker.on("mouseout", () => {
          marker.closePopup();
        });

        intruderMarkersRef.current.set(intruder.id, marker);
      } else {
        existing.setLatLng(intruder.position);
        existing.setIcon(createIntruderIcon(intruder));
        const popup = existing.getPopup();
        if (popup) {
          popup.setContent(renderDronePopupContent(intruder));
        }
      }
    });

    intruderMarkersRef.current.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        marker.off("mouseover");
        marker.off("mouseout");
        intruderLayerRef.current.removeLayer(marker);
        intruderMarkersRef.current.delete(id);
      }
    });
  }, [intruders]);

  useEffect(() => {
    setSocketStatus("connecting");
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    const handleDroneData = (payload) => {
      const nextCameraInfo = Array.isArray(payload?.cam_info) ? payload.cam_info : null;
      if (nextCameraInfo) {
        setCameraInfo(nextCameraInfo);
      }

      let dataArray = null;
      if (Array.isArray(payload)) {
        dataArray = payload;
      } else if (payload && typeof payload === "object") {
        if (Array.isArray(payload.object)) {
          dataArray = payload.object;
        } else if (Array.isArray(payload.objects)) {
          dataArray = payload.objects;
        } else if (Array.isArray(payload.drones)) {
          dataArray = payload.drones;
        }
      }

      if (!Array.isArray(dataArray) || dataArray.length === 0) {
        return;
      }

      setIntruders((previous) => buildLiveIntruders(dataArray, previous));
    };

    socket.on("connect", () => {
      setSocketStatus("connected");
    });

    socket.on("disconnect", () => {
      setSocketStatus("disconnected");
    });

    socket.on("connect_error", () => {
      setSocketStatus("disconnected");
    });

    socket.on("drone_update", handleDroneData);
    socket.on("drones", handleDroneData);
    socket.on("drone-data", handleDroneData);
    socket.on("data", handleDroneData);
    socket.on("message", handleDroneData);

    return () => {
      socket.off("drone_update", handleDroneData);
      socket.off("drones", handleDroneData);
      socket.off("drone-data", handleDroneData);
      socket.off("data", handleDroneData);
      socket.off("message", handleDroneData);
      socket.disconnect();
    };
  }, []);

  return (
    <div className="defense-dashboard-root">
      <div ref={mapContainerRef} className="map-layer" />

      <header className="toolbar-overlay">
        <div className="toolbar-text">
          <h1>Defense Dashboard</h1>
          <p>{subtitleText}</p>
        </div>
        <div className="toolbar-controls">
          <span className={`socket-status socket-${socketStatus}`}>{socketStatus}</span>
          <button type="button" className="toolbar-button" onClick={handleFocusPrimary}>
            Focus Drone
          </button>
          <button type="button" className="toolbar-button" onClick={() => console.log("History requested")}
          >
            History
          </button>
        </div>
      </header>

      <aside className="sidebar-overlay">
        <h2>Drone Status</h2>
        <div className="drone-list">
          {intruders.length === 0 ? (
            <div className="empty-state">Awaiting drone telemetry…</div>
          ) : (
            intruders.map((intruder) => {
              const hasImage = Boolean(intruder.imgbase64);
              return (
                <article className="drone-card" key={intruder.id}>
                  <div className="drone-card-media">
                    {hasImage ? (
                      <img src={intruder.imgbase64} alt={intruder.name} />
                    ) : (
                      <div className="drone-card-placeholder">No Image</div>
                    )}
                  </div>
                  <div className="drone-card-body">
                    <div className="drone-card-title">{intruder.name}</div>
                    <div className="drone-card-meta">ID: {intruder.id}</div>
                    <div className="drone-card-meta">Velocity: {formatVelocity(intruder.velocity)}</div>
                    <div className="drone-card-meta">Direction: {formatDirection(intruder.direction)}</div>
                    <div className="drone-card-meta">Camera: {intruder.camId || "Unknown"}</div>
                    <div className="drone-card-meta">Last seen: {intruder.lastSeen}</div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </aside>

      <section className="camera-overlay">
        <form className="camera-form" onSubmit={handleCameraSubmit}>
          <h3>Camera Credentials</h3>
          <label>
            Camera ID
            <input
              type="text"
              value={cameraIdInput}
              onChange={(event) => setCameraIdInput(event.target.value)}
              placeholder="cam001"
            />
          </label>
          <label>
            Token
            <input
              type="password"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              placeholder="••••••"
            />
          </label>
          <button type="submit" className="toolbar-button">
            Save
          </button>
        </form>
        <div className="camera-details">
          {activeCamera ? (
            <>
              <div>Selected: {activeCamera.cam_id}</div>
              <div>Battery: {Number.isFinite(activeCamera.cam_bat) ? `${activeCamera.cam_bat}%` : "Unknown"}</div>
              <div>
                Location: {cameraLocation ? `${cameraLocation.lat.toFixed(5)}, ${cameraLocation.lon.toFixed(5)}` : "Unknown"}
              </div>
              <div>MGRS: {cameraLocation?.mgrs ?? "N/A"}</div>
              <div>Token: {cameraToken ? "••••••" : "Not set"}</div>
            </>
          ) : (
            <div>No camera selected</div>
          )}
        </div>
      </section>

      <div className="coords-overlay">
        <h3>Map Coordinates</h3>
        {lastClicked ? (
          <ul>
            <li>Lat: {lastClicked.lat.toFixed(5)}</li>
            <li>Lon: {lastClicked.lng.toFixed(5)}</li>
            <li>MGRS: {lastClickedMgrs ?? "N/A"}</li>
          </ul>
        ) : (
          <p>Click anywhere on the map to capture coordinates.</p>
        )}
      </div>
    </div>
  );
}
