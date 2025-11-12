"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import mgrs from "mgrs";
import "@/app/styles/defense-dashboard.css";

mapboxgl.accessToken = "pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw";

const SOCKET_URL = "http://192.168.1.104:3000";
const BASE_POSITION = { lat: 14.2059, lng: 101.2134 };
const DRONE_ICON_SRC = "/drone.png";
const CARD_UPDATE_WINDOW_MS = 5000;
const MAX_DRONE_CARDS = 10;
const MAX_INLINE_IMAGES = 2;
const MAX_STORED_IMAGES = 12;
const CAMERA_COLOR_PALETTE = [
  "#38bdf8",
  "#f97316",
  "#f472b6",
  "#22c55e",
  "#a855f7",
  "#facc15",
  "#fb7185",
  "#818cf8",
];

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

function formatLabel(key) {
  if (!key) return "";
  return key
    .replace(/[_\-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCameraValue(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return value.toString();
    const abs = Math.abs(value);
    const precision = abs >= 100 ? 0 : abs >= 1 ? 3 : 5;
    return value.toFixed(Math.min(precision, 6));
  }
  if (typeof value === "boolean") {
    return value ? "True" : "False";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return "[Object]";
    }
  }
  return String(value);
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

function createDroneMarkerElement(intruder) {
  const heading = Number.isFinite(intruder.direction) ? intruder.direction : 0;
  const imageSource = intruder.imgbase64 || DRONE_ICON_SRC;
  
  const el = document.createElement("div");
  el.className = "drone-marker";
  el.innerHTML = `
    <div class="drone-marker-wrapper" style="transform: rotate(${heading}deg)">
      <img class="drone-marker-image" src="${escapeHtml(imageSource)}" alt="${escapeHtml(intruder.name ?? "drone")}" />
    </div>
  `;
  return el;
}

function toFiniteNumber(value) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function toIsoTimestamp(value) {
  if (typeof value === "number") {
    return new Date(value * (value < 1e12 ? 1000 : 1)).toISOString();
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return new Date().toISOString();
}

function getTimestamp(value) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function appendImage(images, imgSrc, capturedAt) {
  if (!imgSrc) return images;
  const next = [{ src: imgSrc, capturedAt }, ...images.filter((image) => image.src !== imgSrc)];
  return next.slice(0, MAX_STORED_IMAGES);
}

function normalizeDronePayload(entries) {
  const intruderPayload = [];
  const cardEntries = [];

  entries.forEach((item) => {
    const lat = toFiniteNumber(item.lat ?? item.latitude);
    const lon = toFiniteNumber(item.lon ?? item.lng ?? item.longitude);
    if (lat === null || lon === null) return;

    const id = String(item.id ?? item.droneId ?? item.drone_id ?? "unknown");
    const name = item.type ?? item.droneType ?? `Drone ${id}`;
    const camId = item.cam_id ?? item.cameraId ?? item.camId ?? item.cam ?? "Unknown";
    const velocity = toFiniteNumber(item.velocity ?? item.speed ?? item.vel);
    const direction = toFiniteNumber(item.direction ?? item.heading ?? item.bearing);
    const lastSeen = toIsoTimestamp(item.time ?? item.timestamp);
    const imgbase64 = typeof item.imgbase64 === "string" && item.imgbase64.length > 0 ? item.imgbase64 : null;

    intruderPayload.push({
      ...item,
      id,
      type: name,
      lat,
      lon,
      lng: lon,
      cam_id: camId,
      velocity,
      direction,
      time: lastSeen,
      imgbase64,
    });

    cardEntries.push({
      id,
      name,
      camId,
      position: { lat, lng: lon },
      velocity,
      direction,
      lastSeen,
      imgbase64,
    });
  });

  return { intruderPayload, cardEntries };
}

function mergeDroneCards(previousCards, entries, getCameraColor) {
  let nextCards = [...previousCards];

  entries.forEach((entry) => {
    const entryTimestamp = getTimestamp(entry.lastSeen);
    const existingIndex = nextCards.findIndex((card) => card.id === entry.id);

    if (existingIndex >= 0) {
      const existing = nextCards[existingIndex];
      const lastTimestamp = getTimestamp(existing.lastSeen);
      if (entryTimestamp - lastTimestamp <= CARD_UPDATE_WINDOW_MS) {
        const updatedImages = appendImage(existing.images ?? [], entry.imgbase64, entry.lastSeen);
        const updatedCard = {
          ...existing,
          position: entry.position,
          velocity: entry.velocity,
          direction: entry.direction,
          camId: entry.camId,
          cameraColor: getCameraColor(entry.camId),
          lastSeen: entry.lastSeen,
          images: updatedImages,
        };
        nextCards.splice(existingIndex, 1);
        nextCards.unshift(updatedCard);
        return;
      }
    }

    const images = appendImage([], entry.imgbase64, entry.lastSeen);
    const newCard = {
      id: entry.id,
      name: entry.name,
      camId: entry.camId,
      cameraColor: getCameraColor(entry.camId),
      position: entry.position,
      velocity: entry.velocity,
      direction: entry.direction,
      lastSeen: entry.lastSeen,
      images,
    };

    nextCards.unshift(newCard);
  });

  if (nextCards.length > MAX_DRONE_CARDS) {
    nextCards = nextCards.slice(0, MAX_DRONE_CARDS);
  }

  return nextCards;
}

function formatTimestamp(value) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value ?? "—";
  }
  return new Date(parsed).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function DefenseDashboard() {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const intruderMarkersRef = useRef(new Map());
  const cameraInfoAbortRef = useRef(null);
  const cameraColorMapRef = useRef(new Map());
  const cameraColorIndexRef = useRef(0);

  const [socketStatus, setSocketStatus] = useState("connecting");
  const [intruders, setIntruders] = useState([]);
  const [droneCards, setDroneCards] = useState([]);
  const [cameraIdInput, setCameraIdInput] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [cameraToken, setCameraToken] = useState("");
  const [cameraInfoStatus, setCameraInfoStatus] = useState("idle");
  const [cameraInfoError, setCameraInfoError] = useState(null);
  const [cameraInfoDetails, setCameraInfoDetails] = useState(null);
  const [imageViewer, setImageViewer] = useState({ isOpen: false, droneId: null, images: [] });
  const [lastClicked, setLastClicked] = useState(null);
  const [lastClickedMgrs, setLastClickedMgrs] = useState(null);

  const openImageViewer = useCallback((card) => {
    setImageViewer({ isOpen: true, droneId: card.id, images: card.images });
  }, []);

  const closeImageViewer = useCallback(() => {
    setImageViewer({ isOpen: false, droneId: null, images: [] });
  }, []);

  const cameraInfoEntries = useMemo(() => {
    if (!cameraInfoDetails || typeof cameraInfoDetails !== "object") return [];
    const skipKeys = new Set([
      "id",
      "name",
      "location",
      "sort",
      "token",
      "institute",
      "Institute",
      "cam_lat",
      "cam_lon",
      "camLat",
      "camLon",
      "lat",
      "lon",
      "lng",
    ]);
    return Object.entries(cameraInfoDetails).filter(([key]) => !skipKeys.has(key));
  }, [cameraInfoDetails]);

  const getCameraColor = useCallback(
    (camId) => {
      const key = camId || "unknown";
      const map = cameraColorMapRef.current;
      if (map.has(key)) return map.get(key);
      const color = CAMERA_COLOR_PALETTE[cameraColorIndexRef.current % CAMERA_COLOR_PALETTE.length];
      cameraColorIndexRef.current += 1;
      map.set(key, color);
      return color;
    },
    [],
  );

  const cameraLocation = useMemo(() => {
    if (!cameraInfoDetails) return null;
    const lat = toFiniteNumber(
      cameraInfoDetails.cam_lat ?? cameraInfoDetails.camLat ?? cameraInfoDetails.lat,
    );
    const lon = toFiniteNumber(
      cameraInfoDetails.cam_lon ?? cameraInfoDetails.camLon ?? cameraInfoDetails.lon ?? cameraInfoDetails.lng,
    );
    if (lat === null || lon === null) return null;
    let cameraMgrs = null;
    try {
      cameraMgrs = mgrs.forward([lon, lat], 5);
    } catch (error) {
      cameraMgrs = null;
    }
    return { lat, lon, mgrs: cameraMgrs };
  }, [cameraInfoDetails]);

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
      const name = cameraInfoDetails?.name ?? selectedCameraId ?? "";
      const parts = [
        name ? `Camera ${name}` : null,
        `Lat ${cameraLocation.lat.toFixed(5)}`,
        `Lon ${cameraLocation.lon.toFixed(5)}`,
        cameraLocation.mgrs ? `MGRS ${cameraLocation.mgrs}` : "MGRS N/A",
      ];
      return parts.filter(Boolean).join(" • ");
    }
    return "Camera location: Unknown";
  }, [cameraLocation, cameraInfoDetails?.name, selectedCameraId]);

  const fetchCameraInfo = useCallback(async (camId, token) => {
    if (!camId || !token) {
      if (cameraInfoAbortRef.current) {
        cameraInfoAbortRef.current.abort();
        cameraInfoAbortRef.current = null;
      }
      setCameraInfoDetails(null);
      setCameraInfoStatus("idle");
      setCameraInfoError(null);
      return;
    }

    if (cameraInfoAbortRef.current) {
      cameraInfoAbortRef.current.abort();
    }

    const controller = new AbortController();
    cameraInfoAbortRef.current = controller;
    setCameraInfoStatus("loading");
    setCameraInfoError(null);

    try {
      const response = await fetch(`/api/object-detection/info/${encodeURIComponent(camId)}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Request failed with status ${response.status}`);
      }

      const payload = await response.json();
      if (!payload || payload.success !== true || typeof payload.data !== "object" || payload.data === null) {
        throw new Error("Camera API returned an unexpected response");
      }

      const {
        token: rawToken,
        Institute: instituteUpper,
        institute: instituteLower,
        id: responseId,
        name: responseName,
        location: responseLocation,
        sort: responseSort,
        cam_lat: responseCamLat,
        cam_lon: responseCamLon,
        camLat: responseCamLatAlt,
        camLon: responseCamLonAlt,
        lat: responseLat,
        lon: responseLon,
        lng: responseLng,
        ...rest
      } = payload.data;

      const maskedToken = rawToken ? `${rawToken.slice(0, 4)}••••${rawToken.slice(-4)}` : "—";
      const normalized = {
        id: responseId ?? camId,
        name: responseName ?? "Unknown",
        location: responseLocation ?? "Unknown",
        sort: responseSort ?? "—",
        institute: instituteUpper ?? instituteLower ?? "—",
        token: maskedToken,
        cam_lat: responseCamLat ?? responseCamLatAlt ?? responseLat ?? null,
        cam_lon: responseCamLon ?? responseCamLonAlt ?? responseLon ?? responseLng ?? null,
      };

      const cleanedExtras = { ...rest };
      ["cam_lat", "cam_lon", "camLat", "camLon", "lat", "lon", "lng", "Institute", "institute"].forEach((key) => {
        if (key in cleanedExtras) {
          delete cleanedExtras[key];
        }
      });
      Object.keys(normalized).forEach((key) => {
        if (key in cleanedExtras) {
          delete cleanedExtras[key];
        }
      });

      cameraInfoAbortRef.current = null;
      setCameraInfoDetails({ ...normalized, ...cleanedExtras });
      setCameraInfoStatus("success");
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      cameraInfoAbortRef.current = null;
      setCameraInfoDetails(null);
      setCameraInfoStatus("error");
      setCameraInfoError(error.message || "Failed to load camera info");
    }
  }, []);

  useEffect(() => {
    return () => {
      if (cameraInfoAbortRef.current) {
        cameraInfoAbortRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedCameraId || !cameraToken) {
      setCameraInfoDetails(null);
      setCameraInfoStatus("idle");
      setCameraInfoError(null);
      return;
    }
    fetchCameraInfo(selectedCameraId, cameraToken);
  }, [selectedCameraId, cameraToken, fetchCameraInfo]);

  const handleRetryCameraInfo = useCallback(() => {
    if (selectedCameraId && cameraToken) {
      fetchCameraInfo(selectedCameraId, cameraToken);
    }
  }, [selectedCameraId, cameraToken, fetchCameraInfo]);

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

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [BASE_POSITION.lng, BASE_POSITION.lat],
      zoom: 13,
      minZoom: 6,
      maxZoom: 19,
      attributionControl: false,
    });

    map.on("click", (e) => {
      handleMapClick({ latlng: { lat: e.lngLat.lat, lng: e.lngLat.lng } });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      intruderMarkersRef.current.clear();
    };
  }, [handleMapClick]);

  const handleFocusPrimary = useCallback(() => {
    if (!mapRef.current || !primaryFocusPosition) return;
    const currentZoom = mapRef.current.getZoom();
    mapRef.current.flyTo({
      center: [primaryFocusPosition.lng, primaryFocusPosition.lat],
      zoom: Math.max(currentZoom, 14),
      duration: 800,
    });
  }, [primaryFocusPosition]);

  const handleCameraSubmit = useCallback((event) => {
    event.preventDefault();
    const trimmedId = cameraIdInput.trim();
    setSelectedCameraId(trimmedId);
    setCameraToken(tokenInput.trim());
  }, [cameraIdInput, tokenInput]);

  useEffect(() => {
    if (!mapRef.current) return;

    const activeIds = new Set();

    intruders.forEach((intruder) => {
      if (!intruder.position || !Number.isFinite(intruder.position.lat) || !Number.isFinite(intruder.position.lng)) {
        return;
      }

      activeIds.add(intruder.id);
      const existing = intruderMarkersRef.current.get(intruder.id);

      if (!existing) {
        const el = createDroneMarkerElement(intruder);
        
        const marker = new mapboxgl.Marker({
          element: el,
          anchor: "center",
        })
          .setLngLat([intruder.position.lng, intruder.position.lat])
          .addTo(mapRef.current);

        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          className: "drone-popup",
          offset: 25,
        }).setHTML(renderDronePopupContent(intruder));

        el.addEventListener("mouseenter", () => {
          marker.setPopup(popup);
          marker.togglePopup();
        });

        el.addEventListener("mouseleave", () => {
          marker.togglePopup();
        });

        intruderMarkersRef.current.set(intruder.id, { marker, element: el, popup });
      } else {
        existing.marker.setLngLat([intruder.position.lng, intruder.position.lat]);
        
        const heading = Number.isFinite(intruder.direction) ? intruder.direction : 0;
        const wrapper = existing.element.querySelector(".drone-marker-wrapper");
        if (wrapper) {
          wrapper.style.transform = `rotate(${heading}deg)`;
        }
        
        const img = existing.element.querySelector(".drone-marker-image");
        if (img && intruder.imgbase64) {
          img.src = intruder.imgbase64;
        }

        existing.popup.setHTML(renderDronePopupContent(intruder));
      }
    });

    intruderMarkersRef.current.forEach((markerData, id) => {
      if (!activeIds.has(id)) {
        markerData.element.removeEventListener("mouseenter", () => {});
        markerData.element.removeEventListener("mouseleave", () => {});
        markerData.marker.remove();
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

      const { intruderPayload, cardEntries } = normalizeDronePayload(dataArray);
      if (intruderPayload.length === 0) {
        return;
      }

      setIntruders((previous) => buildLiveIntruders(intruderPayload, previous));
      setDroneCards((previous) => mergeDroneCards(previous, cardEntries, getCameraColor));
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
  }, [getCameraColor]);

  return (
    <div className="defense-dashboard-root">
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
          <button
            type="button"
            className="toolbar-button"
            onClick={() => console.log("History requested")}
          >
            History
          </button>
        </div>
      </header>

      <div ref={mapContainerRef} className="map-layer" />

      <aside className="sidebar-overlay">
        <h2>Drone Status</h2>
        <div className="drone-list">
          {droneCards.length === 0 ? (
            <div className="empty-state">Awaiting drone telemetry…</div>
          ) : (
            droneCards.map((card) => {
              const inlineImages = card.images.slice(0, MAX_INLINE_IMAGES);
              const hasOverflowImages = card.images.length > MAX_INLINE_IMAGES;
              const showInlineImages = inlineImages.length > 0 && !hasOverflowImages;

              return (
                <article
                  className={`drone-card${hasOverflowImages ? " drone-card--compact" : ""}`}
                  key={`${card.id}-${card.lastSeen}`}
                >
                  <div className="drone-card-header">
                    <div className="drone-card-title">{card.name}</div>
                    <span
                      className="camera-badge"
                      style={{ backgroundColor: card.cameraColor }}
                      title={`Camera ${card.camId || "Unknown"}`}
                    >
                      {card.camId || "Unknown"}
                    </span>
                  </div>

                  <div className="drone-card-meta-grid">
                    <div>
                      <span className="meta-label">ID</span>
                      <span className="meta-value">{card.id}</span>
                    </div>
                    <div>
                      <span className="meta-label">Lat</span>
                      <span className="meta-value">
                        {card.position && Number.isFinite(card.position.lat)
                          ? card.position.lat.toFixed(5)
                          : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="meta-label">Lon</span>
                      <span className="meta-value">
                        {card.position && Number.isFinite(card.position.lng)
                          ? card.position.lng.toFixed(5)
                          : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="meta-label">Velocity</span>
                      <span className="meta-value">{formatVelocity(card.velocity)}</span>
                    </div>
                    <div>
                      <span className="meta-label">Direction</span>
                      <span className="meta-value">{formatDirection(card.direction)}</span>
                    </div>
                    <div>
                      <span className="meta-label">Last Seen</span>
                      <span className="meta-value">{formatTimestamp(card.lastSeen)}</span>
                    </div>
                  </div>

                  {showInlineImages && (
                    <div className="drone-card-gallery">
                      {inlineImages.map((image, index) => (
                        <div className="drone-thumb" key={`${card.id}-img-${index}`}>
                          <img src={image.src} alt={`${card.name} snapshot ${index + 1}`} />
                          <span className="drone-thumb-time">{formatTimestamp(image.capturedAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {hasOverflowImages && (
                    <div className="drone-card-actions">
                      <span>{card.images.length} images captured</span>
                      <button
                        type="button"
                        className="view-more-button"
                        onClick={() => openImageViewer(card)}
                      >
                        View more
                      </button>
                    </div>
                  )}
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
          <div className="camera-overview">
            {selectedCameraId ? (
              <>
                <div>Camera ID: {cameraInfoDetails?.id ?? selectedCameraId}</div>
                <div>Name: {cameraInfoDetails?.name ?? "Unknown"}</div>
                <div>Location: {cameraInfoDetails?.location ?? "Unknown"}</div>
                <div>Institute: {cameraInfoDetails?.institute ?? cameraInfoDetails?.Institute ?? "—"}</div>
                <div>Sort Order: {cameraInfoDetails?.sort ?? "—"}</div>
                <div>Token: {cameraInfoDetails?.token ?? (cameraToken ? "••••••" : "Not set")}</div>
              </>
            ) : (
              <div className="camera-status camera-idle">No camera selected</div>
            )}
          </div>

 
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

      {imageViewer.isOpen && (
        <div className="image-viewer-backdrop" role="dialog" aria-modal="true">
          <div className="image-viewer-modal">
            <div className="image-viewer-header">
              <h3>Drone {imageViewer.droneId} Images</h3>
              <button
                type="button"
                className="image-viewer-close"
                onClick={closeImageViewer}
              >
                Close
              </button>
            </div>
            <div className="image-viewer-grid">
              {imageViewer.images.map((image, index) => (
                <figure className="image-viewer-item" key={`${imageViewer.droneId}-viewer-${index}`}>
                  <img src={image.src} alt={`Drone ${imageViewer.droneId} frame ${index + 1}`} />
                  <figcaption>{formatTimestamp(image.capturedAt)}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
