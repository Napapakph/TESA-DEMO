"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import mgrs from "mgrs";
import "@/app/styles/defense-dashboard.css";

mapboxgl.accessToken = "pk.eyJ1IjoiY2hhdGNoYWxlcm0iLCJhIjoiY21nZnpiYzU3MGRzdTJrczlkd3RxamN4YyJ9.k288gnCNLdLgczawiB79gQ";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://13.229.79.193:3000/";
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

const HISTORY_SORT_OPTIONS = [
  { value: "latest", label: "Latest" },
  { value: "camera", label: "Camera ID" },
  { value: "type", label: "Drone Type" },
];

const HISTORY_ORDER_OPTIONS = [
  { value: "asc", label: "Ascending" },
  { value: "desc", label: "Descending" },
];

const HISTORY_LOG_SORT_OPTIONS = [
  { value: "timestamp", label: "Timestamp" },
  { value: "velocity", label: "Velocity" },
  { value: "direction", label: "Direction" },
];

const HISTORY_DEFAULT_FILTERS = Object.freeze({
  type: "all",
  side: "def",
  sort: "latest",
  order: "asc",
  page: 1,
  limit: 10,
});

const HISTORY_LOGS_DEFAULTS = Object.freeze({
  sort: "timestamp",
  order: "asc",
  limit: 10,
});

function normalizeHistoryEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const rawId =
    entry.id ??
    entry._id ??
    entry.droneId ??
    entry.drone_id ??
    entry.drone_id ??
    entry.uuid ??
    null;
  if (!rawId) {
    return null;
  }
  const id = String(rawId);
  const type = entry.type ?? entry.droneType ?? entry.model ?? "Unknown";
  const side = entry.side ?? entry.affiliation ?? entry.role ?? "Unknown";
  const camera = entry.cameraId ?? entry.camera_id ?? entry.camId ?? entry.cam_id ?? "Unknown";
  const timestamp =
    entry.timestamp ??
    entry.time ??
    entry.detectedAt ??
    entry.createdAt ??
    entry.updatedAt ??
    null;

  return {
    id,
    type,
    side,
    camera,
    timestamp,
    raw: entry,
  };
}

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
  const imageSource = DRONE_ICON_SRC;
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
  const imageSource = DRONE_ICON_SRC;
  
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

function formatDateTime(value) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value ?? "—";
  }
  return new Date(parsed).toLocaleString();
}

export default function DefenseDashboard() {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const intruderMarkersRef = useRef(new Map());
  const cameraInfoAbortRef = useRef(null);
  const cameraColorMapRef = useRef(new Map());
  const cameraColorIndexRef = useRef(0);
  const selectedHistoryDroneRef = useRef(null);

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
  const [pinnedImageViewer, setPinnedImageViewer] = useState(false);
  const [expandedImage, setExpandedImage] = useState(null);
  const [focusedDroneId, setFocusedDroneId] = useState(null);
  const [mapboxToken, setMapboxToken] = useState(null);
  const [mapTokenStatus, setMapTokenStatus] = useState("idle");
  const [mapboxTokenError, setMapboxTokenError] = useState(null);
  const [mapTokenReloadKey, setMapTokenReloadKey] = useState(0);
  const [mapStatus, setMapStatus] = useState("idle");
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [cameraExpanded, setCameraExpanded] = useState(true);
  const [selectedDroneForDetail, setSelectedDroneForDetail] = useState(null);
  const [latestDroneExpanded, setLatestDroneExpanded] = useState(true);
  const [lastClicked, setLastClicked] = useState(null);
  const [lastClickedMgrs, setLastClickedMgrs] = useState(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyFilters, setHistoryFilters] = useState(() => ({ ...HISTORY_DEFAULT_FILTERS }));
  const [historyStatus, setHistoryStatus] = useState("idle");
  const [historyError, setHistoryError] = useState(null);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [selectedHistoryDrone, setSelectedHistoryDrone] = useState(null);
  const [historyDetails, setHistoryDetails] = useState(null);
  const [historyDetailsStatus, setHistoryDetailsStatus] = useState("idle");
  const [historyDetailsError, setHistoryDetailsError] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLogsStatus, setHistoryLogsStatus] = useState("idle");
  const [historyLogsError, setHistoryLogsError] = useState(null);
  const [historyLogsFilters, setHistoryLogsFilters] = useState(() => ({ ...HISTORY_LOGS_DEFAULTS }));
  const [historyDetailsReloadKey, setHistoryDetailsReloadKey] = useState(0);
  const [historyLogsReloadKey, setHistoryLogsReloadKey] = useState(0);

  const displayedHistoryEntries = useMemo(
    () => historyEntries.slice(0, Math.max(1, historyFilters.limit)),
    [historyEntries, historyFilters.limit],
  );

  const openImageViewer = useCallback((card) => {
    setImageViewer({ isOpen: true, droneId: card.id, images: card.images });
  }, []);

  const closeImageViewer = useCallback(() => {
    setImageViewer({ isOpen: false, droneId: null, images: [] });
    setPinnedImageViewer(false);
  }, []);

  const togglePinnedViewer = useCallback(() => {
    setPinnedImageViewer((prev) => !prev);
  }, []);

  const expandImage = useCallback((imageSrc) => {
    setExpandedImage(imageSrc);
  }, []);

  const closeExpandedImage = useCallback(() => {
    setExpandedImage(null);
  }, []);

  const reloadMapboxToken = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      intruderMarkersRef.current.clear();
    }
    setMapboxToken(null);
    setMapboxTokenError(null);
    setMapStatus("idle");
    setMapTokenStatus("idle");
    setMapTokenReloadKey((key) => key + 1);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarExpanded((prev) => !prev);
  }, []);

  const toggleCamera = useCallback(() => {
    setCameraExpanded((prev) => !prev);
  }, []);

  const closeSelectedDetail = useCallback(() => {
    setSelectedDroneForDetail(null);
  }, []);

  const openHistory = useCallback(() => {
    setIsHistoryOpen(true);
    setHistoryStatus("loading");
  }, []);

  const closeHistory = useCallback(() => {
    setIsHistoryOpen(false);
    setHistoryStatus("idle");
    setHistoryError(null);
    setSelectedHistoryDrone(null);
    setHistoryDetails(null);
    setHistoryDetailsStatus("idle");
    setHistoryDetailsError(null);
    setHistoryLogs([]);
    setHistoryLogsStatus("idle");
    setHistoryLogsError(null);
    setHistoryLogsFilters(() => ({ ...HISTORY_LOGS_DEFAULTS }));
    setHistoryDetailsReloadKey(0);
    setHistoryLogsReloadKey(0);
  }, []);

  const updateHistoryFilters = useCallback((patch) => {
    setHistoryFilters((prev) => {
      const next = { ...prev, ...patch };
      const requiresReset = Object.keys(patch).some((key) =>
        ["type", "side", "sort", "order", "limit"].includes(key),
      );
      if (requiresReset) {
        next.page = 1;
      }
      if (next.limit < 1) {
        next.limit = 1;
      } else if (next.limit > 10) {
        next.limit = 10;
      }
      if (next.page < 1) {
        next.page = 1;
      }
      return next;
    });
  }, []);

  const goToHistoryPage = useCallback((pageDelta) => {
    setHistoryFilters((prev) => {
      const nextPage = Math.max(1, prev.page + pageDelta);
      return { ...prev, page: nextPage };
    });
  }, []);

  const updateHistoryLogsFilters = useCallback((patch) => {
    setHistoryLogsFilters((prev) => {
      const next = { ...prev, ...patch };
      if (next.limit < 1) {
        next.limit = 1;
      }
      return next;
    });
  }, []);

  const handleHistoryItemClick = useCallback((entry) => {
    if (!entry) return;
    const isSame = selectedHistoryDroneRef.current?.id === entry.id;
    setSelectedHistoryDrone(entry);
    if (!isSame) {
      setHistoryLogsFilters(() => ({ ...HISTORY_LOGS_DEFAULTS }));
    }
    setHistoryDetailsReloadKey((prev) => prev + 1);
    setHistoryLogsReloadKey((prev) => prev + 1);
  }, []);

  const retryHistoryFetch = useCallback(() => {
    setHistoryFilters((prev) => ({ ...prev }));
  }, []);

  const retryHistoryDetails = useCallback(() => {
    if (selectedHistoryDroneRef.current) {
      setHistoryDetailsReloadKey((prev) => prev + 1);
    }
  }, []);

  const retryHistoryLogs = useCallback(() => {
    if (selectedHistoryDroneRef.current) {
      setHistoryLogsReloadKey((prev) => prev + 1);
    }
  }, []);

  useEffect(() => {
    selectedHistoryDroneRef.current = selectedHistoryDrone;
  }, [selectedHistoryDrone]);

  useEffect(() => {
    if (!isHistoryOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeHistory();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isHistoryOpen, closeHistory]);

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
    return "Camera location: " + (cameraInfoDetails?.location ?? "Unknown");
  }, [cameraInfoDetails?.location ?? "Unknown"]);

 

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
      const response = await fetch(`https://tesa-api.crma.dev/api/object-detection/info/${selectedCameraId}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-camera-token": cameraToken,
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
    let isMounted = true;

    async function loadToken() {
      setMapTokenStatus("loading");
      try {
        const response = await fetch("/api/mapbox/token");
        const raw = await response.text();
        let payload = {};

        if (raw) {
          try {
            payload = JSON.parse(raw);
          } catch {
            payload = {};
          }
        }

        if (!response.ok) {
          const message =
            (payload && typeof payload === "object" && payload.error) ||
            `Request failed with status ${response.status}`;
          throw new Error(message);
        }

        const token =
          payload && typeof payload.token === "string"
            ? payload.token.trim()
            : "";

        if (!token) {
          throw new Error("Token missing from Mapbox token response.");
        }

        if (!isMounted) {
          return;
        }

        setMapboxToken(token);
        setMapboxTokenError(null);
        setMapTokenStatus("ready");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const fallback = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
        if (fallback) {
          console.warn(
            "Falling back to NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN due to Mapbox token API error:",
            error
          );
          setMapboxToken(fallback);
          setMapboxTokenError(null);
          setMapTokenStatus("ready");
          return;
        }

        console.error("Failed to retrieve Mapbox token:", error);
        setMapboxToken(null);
        setMapboxTokenError(
          error?.message ?? "Failed to retrieve Mapbox access token."
        );
        setMapTokenStatus("error");
      }
    }

    loadToken();

    return () => {
      isMounted = false;
    };
  }, [mapTokenReloadKey]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !mapboxToken) {
      return;
    }

    try {
      mapboxgl.accessToken = mapboxToken;
    } catch (error) {
      console.error("Failed to set Mapbox access token:", error);
      setMapboxTokenError(
        error?.message ?? "Failed to apply Mapbox access token."
      );
      setMapStatus("error");
      return;
    }

    let mapInstance;

    try {
      mapInstance = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [BASE_POSITION.lng, BASE_POSITION.lat],
        zoom: 13,
        minZoom: 6,
        maxZoom: 19,
        attributionControl: false,
      });
    } catch (error) {
      console.error("Failed to initialize Mapbox map:", error);
      setMapboxTokenError(
        error?.message ??
          "Failed to initialize Mapbox map. Confirm the access token."
      );
      setMapStatus("error");
      return;
    }

    const handleClick = (e) => {
      handleMapClick({ latlng: { lat: e.lngLat.lat, lng: e.lngLat.lng } });
    };

    const handleLoad = () => {
      setMapStatus("ready");
    };

    const handleError = (event) => {
      const status =
        event?.error?.status ??
        event?.error?.statusCode ??
        event?.error?.statusText;
      const message =
        status === 401 || status === 403
          ? "Mapbox denied the request. Verify MAPBOX_ACCESS_TOKEN permissions."
          : event?.error?.message ??
            "Mapbox reported an unexpected error while loading the map.";

      setMapboxTokenError(message);
      setMapStatus((prev) => (prev === "ready" ? prev : "error"));
      console.error("Mapbox map error:", event?.error ?? event);
    };

    mapInstance.on("click", handleClick);
    mapInstance.once("load", handleLoad);
    mapInstance.on("error", handleError);

    mapRef.current = mapInstance;
    setMapStatus("initializing");

    return () => {
      mapInstance.off("click", handleClick);
      mapInstance.off("error", handleError);
      mapInstance.remove();
      mapRef.current = null;
      intruderMarkersRef.current.clear();
    };
  }, [handleMapClick, mapboxToken]);

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
    if (!isHistoryOpen) return;
    let ignore = false;
    const controller = new AbortController();

    const fetchHistory = async () => {
      setHistoryStatus("loading");
      setHistoryError(null);
      try {
        const params = new URLSearchParams();
        if (historyFilters.type && historyFilters.type !== "all") {
          params.append("type", historyFilters.type);
        }
        params.append("side", historyFilters.side ?? "def");
        if (historyFilters.sort) {
          params.append("sort", historyFilters.sort);
        }
        if (historyFilters.order) {
          params.append("order", historyFilters.order);
        }
        params.append("page", String(historyFilters.page));
        params.append("limit", String(historyFilters.limit));
        console.log("params", params.toString());

        const response = await fetch(`${SOCKET_URL}api/drones?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || `Failed to load history (${response.status})`);
        }

        const payload = await response.json();
        if (ignore) return;

        const rawItems = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
        const normalized = rawItems.map(normalizeHistoryEntry).filter(Boolean);

        setHistoryEntries(normalized);
        setHistoryTotal(typeof payload?.total === "number" ? payload.total : normalized.length);
        setHistoryStatus("success");

        if (normalized.length === 0) {
          setSelectedHistoryDrone(null);
          setHistoryDetails(null);
          setHistoryLogs([]);
        } else {
          const current = selectedHistoryDroneRef.current;
          const existing = current ? normalized.find((entry) => entry.id === current.id) : null;
          if (existing) {
            setSelectedHistoryDrone(existing);
          } else {
            handleHistoryItemClick(normalized[0]);
          }
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setHistoryEntries([]);
        setHistoryTotal(0);
        setHistoryStatus("error");
        setHistoryError(error.message || "Failed to load history");
        console.error("Failed to load history:", error);
      }
    };

    fetchHistory();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [isHistoryOpen, historyFilters, handleHistoryItemClick]);

  useEffect(() => {
    if (!isHistoryOpen || !selectedHistoryDrone) {
      if (!selectedHistoryDrone) {
        setHistoryDetails(null);
        setHistoryDetailsStatus("idle");
        setHistoryDetailsError(null);
      }
      return;
    }

    let ignore = false;
    const controller = new AbortController();

    const fetchDetails = async () => {
      setHistoryDetailsStatus("loading");
      setHistoryDetailsError(null);
      try {
        const response = await fetch(`${SOCKET_URL}/api/drones/${encodeURIComponent(selectedHistoryDrone.id)}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || `Failed to load drone details (${response.status})`);
        }
        const payload = await response.json();
        if (ignore) return;
        const data =
          (payload && typeof payload === "object" && payload !== null && payload.data) ?? payload ?? null;
        setHistoryDetails(data);
        setHistoryDetailsStatus("success");
      } catch (error) {
        if (controller.signal.aborted) return;
        setHistoryDetails(null);
        setHistoryDetailsStatus("error");
        setHistoryDetailsError(error.message || "Failed to load drone details");
      }
    };

    fetchDetails();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [isHistoryOpen, selectedHistoryDrone, historyDetailsReloadKey]);

  useEffect(() => {
    if (!isHistoryOpen || !selectedHistoryDrone) {
      if (!selectedHistoryDrone) {
        setHistoryLogs([]);
      }
      setHistoryLogsStatus("idle");
      setHistoryLogsError(null);
      return;
    }

    let ignore = false;
    const controller = new AbortController();

    const fetchLogs = async () => {
      setHistoryLogsStatus("loading");
      setHistoryLogsError(null);
      try {
        const params = new URLSearchParams();
        if (historyLogsFilters.sort) {
          params.append("sort", historyLogsFilters.sort);
        }
        if (historyLogsFilters.order) {
          params.append("order", historyLogsFilters.order);
        }
        params.append("limit", String(historyLogsFilters.limit));

        const response = await fetch(
          `${SOCKET_URL}api/drones/${encodeURIComponent(selectedHistoryDrone.id)}/logs?${params.toString()}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || `Failed to load drone logs (${response.status})`);
        }
        const payload = await response.json();
        if (ignore) return;
        const entries = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
        setHistoryLogs(entries);
        setHistoryLogsStatus("success");
      } catch (error) {
        if (controller.signal.aborted) return;
        setHistoryLogs([]);
        setHistoryLogsStatus("error");
        setHistoryLogsError(error.message || "Failed to load drone logs");
      }
    };

    fetchLogs();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [isHistoryOpen, selectedHistoryDrone, historyLogsFilters, historyLogsReloadKey]);

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
      setDroneCards((previous) => {
        const updated = mergeDroneCards(previous, cardEntries, getCameraColor);
        if (updated.length > 0 && updated[0].id !== focusedDroneId) {
          setFocusedDroneId(updated[0].id);
        }
        return updated;
      });
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
            onClick={openHistory}
            disabled={isHistoryOpen}
          >
            History
          </button>
        </div>
      </header>

      <div className="dashboard-body">
        <aside className={`sidebar-panel${sidebarExpanded ? "" : " collapsed"}`} onClick={(e) => e.stopPropagation()}>
          <div className="sidebar-header">
            <h2>Drone Status</h2>
            <div className="sidebar-controls" >
              <button
                type="button"
                className="expand-collapse-button"
                onClick={toggleSidebar}
                title={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
              >
                {sidebarExpanded ? "◀" : "▶"}
              </button>
            </div>
          </div>
          <div className="drone-list">
            {droneCards.length === 0 ? (
              <div className="empty-state">Awaiting drone telemetry…</div>
            ) : (
              droneCards.map((card, index) => {
                const isLatest = index === 0;
                const cardId = isLatest ? "new-drone" : undefined;

                return (
                  <article
                    id={cardId}
                    className="drone-card-compact"
                    key={`${card.id}-${card.lastSeen}`}
                    onClick={() => setSelectedDroneForDetail(card)}
                  >
                    <div className="compact-field">
                      <span className="compact-label">ID</span>
                      <span className="compact-value">{card.id}</span>
                    </div>
                    <div className="compact-field">
                      <span className="compact-label">Lat</span>
                      <span className="compact-value">
                        {card.position && Number.isFinite(card.position.lat)
                          ? card.position.lat.toFixed(5)
                          : "—"}
                      </span>
                    </div>
                    <div className="compact-field">
                      <span className="compact-label">Lon</span>
                      <span className="compact-value">
                        {card.position && Number.isFinite(card.position.lng)
                          ? card.position.lng.toFixed(5)
                          : "—"}
                      </span>
                    </div>
                    <div className="compact-field">
                      <span className="compact-label">Time</span>
                      <span className="compact-value">{formatTimestamp(card.lastSeen)}</span>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {droneCards.length > 0 && (
            <div className="detail-panel">
              <div className={`detail-column${latestDroneExpanded ? "" : " collapsed"}`} id="latest-drone-detail">
                <div className="detail-column-header">
                  {latestDroneExpanded ? (
                    <>
                      <h3>Latest Drone</h3>
                      <span className="detail-badge latest">New</span>
                      <button
                        type="button"
                        className="detail-collapse-button"
                        onClick={() => setLatestDroneExpanded(false)}
                        title="Collapse"
                      >
                        ▼
                      </button>
                    </>
                  ) : (
                    <>
                      {droneCards[0] && droneCards[0].images.length > 0 && (
                        <img
                          className="collapsed-thumbnail"
                          src={droneCards[0].images[0].src}
                          alt="Latest drone"
                        />
                      )}
                      <span className="collapsed-id">ID: {droneCards[0]?.id}</span>
                      <button
                        type="button"
                        className="detail-expand-button"
                        onClick={() => setLatestDroneExpanded(true)}
                        title="Expand"
                      >
                        ▲
                      </button>
                    </>
                  )}
                </div>
                <div className="detail-content">
                  {droneCards[0] && (
                    <>
                      <div className="detail-info-row">
                        <span className="detail-label">Name</span>
                        <span className="detail-value">{droneCards[0].name}</span>
                      </div>
                      <div className="detail-info-row">
                        <span className="detail-label">ID</span>
                        <span className="detail-value">{droneCards[0].id}</span>
                      </div>
                      <div className="detail-info-row">
                        <span className="detail-label">Camera</span>
                        <span
                          className="camera-badge"
                          style={{ backgroundColor: droneCards[0].cameraColor }}
                        >
                          {droneCards[0].camId || "Unknown"}
                        </span>
                      </div>
                      <div className="detail-info-row">
                        <span className="detail-label">Latitude</span>
                        <span className="detail-value">
                          {droneCards[0].position && Number.isFinite(droneCards[0].position.lat)
                            ? droneCards[0].position.lat.toFixed(6)
                            : "—"}
                        </span>
                      </div>
                      <div className="detail-info-row">
                        <span className="detail-label">Longitude</span>
                        <span className="detail-value">
                          {droneCards[0].position && Number.isFinite(droneCards[0].position.lng)
                            ? droneCards[0].position.lng.toFixed(6)
                            : "—"}
                        </span>
                      </div>
                      <div className="detail-info-row">
                        <span className="detail-label">Velocity</span>
                        <span className="detail-value">{formatVelocity(droneCards[0].velocity)}</span>
                      </div>
                      <div className="detail-info-row">
                        <span className="detail-label">Direction</span>
                        <span className="detail-value">{formatDirection(droneCards[0].direction)}</span>
                      </div>
                      <div className="detail-info-row">
                        <span className="detail-label">Last Seen</span>
                        <span className="detail-value">{formatTimestamp(droneCards[0].lastSeen)}</span>
                      </div>
                      {droneCards[0].images.length > 0 && (
                        <div className="detail-image-gallery">
                          <h4>Images ({droneCards[0].images.length})</h4>
                          <div className="detail-image-grid">
                            {droneCards[0].images.map((image, idx) => (
                              <div
                                className="detail-image-item"
                                key={`latest-img-${idx}`}
                                onClick={() => expandImage(image.src)}
                              >
                                <img src={image.src} alt={`Latest drone ${idx + 1}`} />
                                <span className="detail-image-time">{formatTimestamp(image.capturedAt)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {selectedDroneForDetail && (
                <div className="detail-column" id="selected-drone-detail">
                  <div className="detail-column-header">
                    <h3>Selected Drone</h3>
                    <button
                      type="button"
                      className="detail-close-button"
                      onClick={closeSelectedDetail}
                      title="Close"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="detail-content">
                    <div className="detail-info-row">
                      <span className="detail-label">Name</span>
                      <span className="detail-value">{selectedDroneForDetail.name}</span>
                    </div>
                    <div className="detail-info-row">
                      <span className="detail-label">ID</span>
                      <span className="detail-value">{selectedDroneForDetail.id}</span>
                    </div>
                    <div className="detail-info-row">
                      <span className="detail-label">Camera</span>
                      <span
                        className="camera-badge"
                        style={{ backgroundColor: selectedDroneForDetail.cameraColor }}
                      >
                        {selectedDroneForDetail.camId || "Unknown"}
                      </span>
                    </div>
                    <div className="detail-info-row">
                      <span className="detail-label">Latitude</span>
                      <span className="detail-value">
                        {selectedDroneForDetail.position && Number.isFinite(selectedDroneForDetail.position.lat)
                          ? selectedDroneForDetail.position.lat.toFixed(6)
                          : "—"}
                      </span>
                    </div>
                    <div className="detail-info-row">
                      <span className="detail-label">Longitude</span>
                      <span className="detail-value">
                        {selectedDroneForDetail.position && Number.isFinite(selectedDroneForDetail.position.lng)
                          ? selectedDroneForDetail.position.lng.toFixed(6)
                          : "—"}
                      </span>
                    </div>
                    <div className="detail-info-row">
                      <span className="detail-label">Velocity</span>
                      <span className="detail-value">{formatVelocity(selectedDroneForDetail.velocity)}</span>
                    </div>
                    <div className="detail-info-row">
                      <span className="detail-label">Direction</span>
                      <span className="detail-value">{formatDirection(selectedDroneForDetail.direction)}</span>
                    </div>
                    <div className="detail-info-row">
                      <span className="detail-label">Last Seen</span>
                      <span className="detail-value">{formatTimestamp(selectedDroneForDetail.lastSeen)}</span>
                    </div>
                    {selectedDroneForDetail.images.length > 0 && (
                      <div className="detail-image-gallery">
                        <h4>Images ({selectedDroneForDetail.images.length})</h4>
                        <div className="detail-image-grid">
                          {selectedDroneForDetail.images.map((image, idx) => (
                            <div
                              className="detail-image-item"
                              key={`selected-img-${idx}`}
                              onClick={() => expandImage(image.src)}
                            >
                              <img src={image.src} alt={`Selected drone ${idx + 1}`} />
                              <span className="detail-image-time">{formatTimestamp(image.capturedAt)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>

        <main className="map-wrapper">
          <div ref={mapContainerRef} className="map-layer" />
          {mapTokenStatus === "loading" && (
            <div className="map-status-message info"></div>
          )}
          {mapStatus === "initializing" && !mapboxTokenError && (
            <div className="map-status-message info"></div>
          )}
          {mapboxTokenError && (
            <div className="map-status-message error">
              <p>ไม่สามารถโหลดแผนที่: {mapboxTokenError}</p>
              <button type="button" onClick={reloadMapboxToken}>
                ลองอีกครั้ง
              </button>
            </div>
          )}

          <section className={`camera-overlay${cameraExpanded ? "" : " collapsed"}`}>
            <div className="camera-overlay-header">
              <h3>Camera Credentials</h3>
              <button
                type="button"
                className="expand-collapse-button-camera"
                onClick={toggleCamera}
                title={cameraExpanded ? "Collapse camera panel" : "Expand camera panel"}
                aria-expanded={cameraExpanded}
              >
                {cameraExpanded ? "◀" : "▶"}
              </button>
            </div>

            {cameraExpanded && (
              <div className="camera-overlay-body">
                <form className="camera-form" onSubmit={handleCameraSubmit}>
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

                  <div className="camera-fetch-result">
                    {cameraInfoStatus === "loading" ? (
                      <div className="camera-status camera-loading">กำลังโหลดข้อมูลกล้อง…</div>
                    ) : cameraInfoStatus === "error" ? (
                      <div className="camera-status camera-error">
                        {cameraInfoError || "ไม่สามารถโหลดข้อมูลกล้องได้"}
                        <button type="button" className="camera-retry-button" onClick={handleRetryCameraInfo}>
                          ลองใหม่
                        </button>
                      </div>
                    ) : cameraInfoStatus === "success" && cameraInfoEntries.length > 0 ? (
                      <div className="camera-info-grid">
                        {cameraInfoEntries.map(([key, value]) => (
                          <div className="camera-info-row" key={key}>
                            <span className="camera-info-key">{formatLabel(key)}</span>
                            <span className="camera-info-value">{formatCameraValue(value)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="camera-status camera-idle">
                        {selectedCameraId && cameraToken
                          ? "ไม่มีข้อมูลเพิ่มเติมจากกล้อง"
                          : "กรอก Camera ID และ Token จากนั้นกด Save เพื่อโหลดข้อมูล"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
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
        </main>
      </div>

      {isHistoryOpen && (
        <div className="history-backdrop" role="dialog" aria-modal="true" onClick={closeHistory}>
          <div className="history-modal" onClick={(event) => event.stopPropagation()}>
            <header className="history-header">
              <h2>Drone History</h2>
              <button type="button" className="history-close-button" onClick={closeHistory} title="Close history">
                ✕
              </button>
            </header>

            <section className="history-filters">
              <div className="history-filters-row">
                <label className="history-filter">
                  <span>Type</span>
                  <input
                    type="text"
                    value={historyFilters.type === "all" ? "" : historyFilters.type}
                    placeholder="Any type"
                    onChange={(event) =>
                      updateHistoryFilters({ type: event.target.value.trim() || "all" })
                    }
                  />
                </label>
                <label className="history-filter">
                  <span>Side</span>
                  <select
                    value={historyFilters.side}
                    onChange={(event) => updateHistoryFilters({ side: event.target.value })}
                  >
                    <option value="def">Defensive</option>
                    <option value="off">Offensive</option>
                    <option value="">All</option>
                  </select>
                </label>
                <label className="history-filter">
                  <span>Sort</span>
                  <select
                    value={historyFilters.sort}
                    onChange={(event) => updateHistoryFilters({ sort: event.target.value })}
                  >
                    {HISTORY_SORT_OPTIONS.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="history-filter">
                  <span>Order</span>
                  <select
                    value={historyFilters.order}
                    onChange={(event) => updateHistoryFilters({ order: event.target.value })}
                  >
                    {HISTORY_ORDER_OPTIONS.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="history-filter">
                  <span>Limit</span>
                  <input
                    type="number"
                    min="1"
                    value={historyFilters.limit}
                    onChange={(event) => {
                      const value = Number.parseInt(event.target.value, 10);
                      updateHistoryFilters({ limit: Number.isNaN(value) ? 1 : value });
                    }}
                  />
                </label>
              </div>
            </section>

            <div className="history-layout">
              <section className="history-detail-section history-summary-section">
                <div className="history-detail-header">
                  <h3>Detail</h3>               
                  <div className="history-summary-grid">
                  <article className="history-summary-card">
                    <span className="history-summary-label">Total Drones of Detected is <span className="history-summary-value">
                      {historyTotal.toLocaleString()}
                    </span> <span className="history-summary-footnote">
                      Showing {displayedHistoryEntries.length} of {historyTotal.toLocaleString()}
                    </span></span>
        
                  </article>
                </div>
                  <div className="history-pagination">
                    <button
                      type="button"
                      onClick={() => goToHistoryPage(-1)}
                      disabled={historyFilters.page <= 1 || historyStatus === "loading"}
                    >
                      ◀
                    </button>
                    <span>Page {historyFilters.page}</span>
                    <button
                      type="button"
                      onClick={() => goToHistoryPage(1)}
                      disabled={
                        historyStatus === "loading" ||
                        displayedHistoryEntries.length < historyFilters.limit ||
                        historyFilters.page * historyFilters.limit >= historyTotal
                      }
                    >
                      ▶
                    </button>
                  </div>
                </div>

 

                <div className="history-table-wrapper">
                  {historyStatus === "loading" ? (
                    <div className="history-loading">Loading history…</div>
                  ) : historyStatus === "error" ? (
                    <div className="history-error">
                      <span>{historyStatus || "Failed to load history data."}</span>
                      <button type="button" onClick={retryHistoryFetch}>
                        Retry
                      </button>
                    </div>
                  ) : displayedHistoryEntries.length === 0 ? (
                    <div className="history-empty">No history data on this page.</div>
                  ) : (
                    <div className="history-table-scroll">
                      <table className="history-table">
                        <thead>
                          <tr>
                            <th>ID Unique Drone</th>
                            <th>ID Drone</th>
                            <th>type</th>
                            <th>Timestamp</th>
                            <th>side</th>
                            <th>ID Camera</th>
                            <th>image</th>
                            <th>preview</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedHistoryEntries.map((entry) => {
                            const raw = entry.raw ?? {};
                            const dbId = raw._id ?? raw.id ?? entry.id;
                            const droneId = raw.drone_id ?? raw.droneId ?? entry.id;
                            const type = raw.type ?? entry.type ?? "—";
                            const firstSeenValue =
                              raw.first_seen ??
                              raw.firstSeen ??
                              entry.timestamp ??
                              raw.timestamp ??
                              entry.lastSeen ??
                              null;
                            const firstSeen = firstSeenValue ? formatDateTime(firstSeenValue) : "—";
                            const side = (raw.side ?? entry.side ?? "—") || "—";
                            const firstCam =
                              raw.first_cam_id ??
                              raw.firstCamId ??
                              raw.camera_id ??
                              raw.cameraId ??
                              entry.camera ??
                              "—";
                            const imagePath =
                              typeof raw.image_path === "string" && raw.image_path.trim().length > 0
                                ? raw.image_path.trim()
                                : typeof raw.imagePath === "string" && raw.imagePath.trim().length > 0
                                ? raw.imagePath.trim()
                                : null;
                            const previewSrc =
                              typeof raw.image_preview === "string" && raw.image_preview.trim().length > 0
                                ? raw.image_preview.trim()
                                : typeof raw.image_base64 === "string" && raw.image_base64.trim().length > 0
                                ? raw.image_base64.trim()
                                : imagePath;
                            const isSelected = selectedHistoryDrone?.id === entry.id;

                            return (
                              <tr
                                key={entry.id}
                                className={`history-table-row${isSelected ? " history-table-row--selected" : ""}`}
                                onClick={() => handleHistoryItemClick(entry)}
                              >
                                <td title={String(dbId)}>{String(dbId)}</td>
                                <td title={String(droneId)}>{String(droneId)}</td>
                                <td>{type}</td>
                                <td>{firstSeen}</td>
                                <td className={`history-table-side history-table-side--${side.toLowerCase()}`}>
                                  {side}
                                </td>
                                <td title={firstCam}>{firstCam}</td>
                                <td>
                                  {previewSrc ? (
                                    <button
                                      type="button"
                                      className="history-table-button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        expandImage(previewSrc);
                                      }}
                                    >
                                      View more
                                    </button>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td>
                                  {previewSrc ? (
                                    <img
                                      src={previewSrc}
                                      alt={`Drone ${droneId}`}
                                      className="history-table-image"
                                    />
                                  ) : (
                                    "—"
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>

              {/* <section className="history-detail-section history-selected-section">
                <div className="history-detail-header">
                  <h3>Selected Drone</h3>
                  {historyDetailsStatus === "error" && (
                    <button type="button" onClick={retryHistoryDetails}>
                      Retryy
                    </button>
                  )}
                </div>
                {selectedHistoryDrone ? (
                  historyDetailsStatus === "loading" ? (
                    <div className="history-loading">Loading drone details…</div>
                  ) : historyDetailsStatus === "error" ? (
                    <div className="history-error">
                      {historyDetailsError || "Failed to load drone details."}
                    </div>
                  ) : historyDetails ? (
                    <div className="history-detail-grid">
                      {Object.entries(historyDetails).map(([key, value]) => (
                        <div className="history-detail-row" key={key}>
                          <span className="history-detail-key">{formatLabel(key)}</span>
                          <span className="history-detail-value">{formatCameraValue(value)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="history-empty">No details available for this drone.</div>
                  )
                ) : (
                  <div className="history-empty">Select a drone to view its details.</div>
                )}
              </section> */}

              <section className="history-detail-section history-logs-section">
                <div className="history-detail-header">
                  <h3>Logs</h3>
                  <div className="history-logs-filters">
                    <select
                      value={historyLogsFilters.sort}
                      onChange={(event) =>
                        updateHistoryLogsFilters({ sort: event.target.value })
                      }
                    >
                      {HISTORY_LOG_SORT_OPTIONS.map((option) => (
                        <option value={option.value} key={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={historyLogsFilters.order}
                      onChange={(event) =>
                        updateHistoryLogsFilters({ order: event.target.value })
                      }
                    >
                      {HISTORY_ORDER_OPTIONS.map((option) => (
                        <option value={option.value} key={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={historyLogsFilters.limit}
                      onChange={(event) => {
                        const value = Number.parseInt(event.target.value, 10);
                        updateHistoryLogsFilters({
                          limit: Number.isNaN(value) ? 1 : value,
                        });
                      }}
                    />
                    <button type="button" onClick={retryHistoryLogs}>
                      Refresh
                    </button>
                  </div>
                </div>

                {selectedHistoryDrone ? (
                  historyLogsStatus === "loading" ? (
                    <div className="history-loading">Loading drone logs…</div>
                  ) : historyLogsStatus === "error" ? (
                    <div className="history-error">
                      <span>{historyLogsError || "Failed to load drone logs."}</span>
                      <button type="button" onClick={retryHistoryLogs}>
                        Retry
                      </button>
                    </div>
                  ) : historyLogs.length === 0 ? (
                    <div className="history-log-placeholder">
                      Frame log data will appear here once available.
                    </div>
                  ) : (
                    <div className="history-log-scroll">
                    <ul className="history-log-list">
                      {historyLogs.map((log, index) => (
                        <li className="history-log-item" key={log.id ?? index}>
                          <span className="history-log-time">
                            {log.timestamp ? formatDateTime(log.timestamp) : `Log ${index + 1}`}
                          </span>
                          <span className="history-log-meta">
                            Velocity: {formatVelocity(log.velocity)}
                          </span>
                          <span className="history-log-meta">
                            Direction: {formatDirection(log.direction)}
                          </span>
                          <span className="history-log-meta">
                            Altitude: {log.altitude ?? "—"}
                          </span>
                        </li>
                      ))}
                    </ul>
                    </div>
                  )
                ) : (
                  <div className="history-log-placeholder">Select a drone to view its logs.</div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}

      {imageViewer.isOpen && (
        <div className="image-viewer-backdrop" role="dialog" aria-modal="true">
          <div className="image-viewer-modal">
            <div className="image-viewer-header">
              <h3>Drone {imageViewer.droneId} Images</h3>
              <div className="image-viewer-controls">
                <button
                  type="button"
                  className={`pin-button${pinnedImageViewer ? " pinned" : ""}`}
                  onClick={togglePinnedViewer}
                  title={pinnedImageViewer ? "Unpin viewer" : "Pin viewer"}
                >
                  {pinnedImageViewer ? "📍" : "📌"}
                </button>
                <button
                  type="button"
                  className="image-viewer-close"
                  onClick={closeImageViewer}
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="image-viewer-grid">
              {imageViewer.images.map((image, index) => (
                <figure
                  className="image-viewer-item"
                  key={`${imageViewer.droneId}-viewer-${index}`}
                  onClick={() => expandImage(image.src)}
                >
                  <img src={image.src} alt={`Drone ${imageViewer.droneId} frame ${index + 1}`} />
                  <figcaption>{formatTimestamp(image.capturedAt)}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      )}

      {expandedImage && (
        <div
          className="expanded-image-overlay"
          onClick={closeExpandedImage}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="expanded-image-close"
            onClick={closeExpandedImage}
          >
            ✕
          </button>
          <img src={expandedImage} alt="Expanded view" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
