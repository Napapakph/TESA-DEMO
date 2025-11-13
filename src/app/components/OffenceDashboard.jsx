"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import mgrs from "mgrs";

const BASE_POSITION = { lat: 14.2059, lng: 101.2134 };
const ROUTE_SOURCE_ID = "offence-target-route";
const ROUTE_LAYER_ID = "offence-target-route-line";
const MAX_ALERT_ENTRIES = 12;

function createInitialAlertLog(position) {
  const now = Date.now();
  const toIso = (offsetMinutes) => new Date(now - offsetMinutes * 60 * 1000).toISOString();

  return [
    {
      id: "alert-003",
      timestamp: toIso(1),
      status: "Signal Hold",
      message: "Signal strength stabilized after minor interference.",
      position,
    },
    {
      id: "alert-002",
      timestamp: toIso(3),
      status: "Active",
      message: "Drone resumed patrol at current waypoint.",
      position,
    },
    {
      id: "alert-001",
      timestamp: toIso(7),
      status: "Launch",
      message: "Drone deployed from forward base.",
      position,
    },
  ];
}

function haversineDistanceMeters(origin, target) {
  if (!origin || !target) return 0;
  const toRadians = (value) => (value * Math.PI) / 180;
  const R = 6371e3;
  const φ1 = toRadians(origin.lat);
  const φ2 = toRadians(target.lat);
  const Δφ = toRadians(target.lat - origin.lat);
  const Δλ = toRadians(target.lng - origin.lng);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function formatLogTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value ?? "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function toLocaleNumber(value) {
  return Number.isFinite(value) ? value.toLocaleString() : "—";
}

export default function OffenceDashboard() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mapboxToken, setMapboxToken] = useState(null);
  const [mapStatus, setMapStatus] = useState("idle");
  const [mapError, setMapError] = useState(null);
  const [clickedPosition, setClickedPosition] = useState(null);
  const [targetInputs, setTargetInputs] = useState({
    latitude: "",
    longitude: "",
    mgrs: "",
  });
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitError, setSubmitError] = useState(null);
  const [droneStatus, setDroneStatus] = useState(() => ({
    id: "OFF-01",
    status: "Active",
    signal: "Nominal",
    position: BASE_POSITION,
    lastHeartbeat: new Date().toISOString(),
  }));
  const [alertLog, setAlertLog] = useState(() => createInitialAlertLog(BASE_POSITION));
  const [lastSentPayload, setLastSentPayload] = useState(null);

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const targetMarkerRef = useRef(null);
  const currentDroneMarkerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchToken() {
      setMapStatus("loading-token");
      setMapError(null);
      try {
        const response = await fetch("/api/mapbox/token");
        if (!response.ok) {
          throw new Error(`Failed to fetch token: ${response.status}`);
        }
        const data = await response.json();
        const token =
          data?.token ??
          process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ??
          null;
        if (!token) {
          throw new Error("Mapbox access token is not configured.");
        }
        if (isMounted) {
          setMapboxToken(token);
          setMapStatus("token-ready");
        }
      } catch (error) {
        if (!isMounted) return;
        setMapError(error instanceof Error ? error.message : "Unexpected error while loading Mapbox token.");
        setMapStatus("token-error");
      }
    }
    fetchToken();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!mapboxToken || !mapContainerRef.current || mapRef.current) {
      return;
    }

    mapboxgl.accessToken = mapboxToken;
    const mapInstance = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [101.2134, 14.2059],
      zoom: 12,
      attributionControl: false,
    });

    setMapStatus("initializing");

    const handleLoad = () => {
      setMapStatus("ready");
    };

    const handleError = (event) => {
       const message =
        event?.error?.message ??
        event?.target?.statusText ??
        event?.error?.statusText ??
        event?.error?.statusCode ? `Mapbox error ${event.error.statusCode}` : "Mapbox reported an unexpected error.";
      setMapError(message);
      setMapStatus("error");
    };

    mapInstance.once("load", handleLoad);
    mapInstance.on("error", handleError);

    mapRef.current = mapInstance;

    return () => {
      mapInstance.off("load", handleLoad);
      mapInstance.off("error", handleError);
      mapInstance.remove();
      mapRef.current = null;
    };
  }, [mapboxToken]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.resize();
  }, [isExpanded]);

  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const formatCoordinate = useCallback((value) => {
    if (value === "" || value === null || Number.isNaN(value)) return "";
    const num = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(num)) return "";
    return num.toFixed(6);
  }, []);

  const formattedPosition = useMemo(() => {
    if (!clickedPosition) return null;
    const { lat, lng } = clickedPosition;
    let mgrsString = "";
    try {
      mgrsString = mgrs.forward([lng, lat], 5);
    } catch (error) {
      mgrsString = "";
    }
    return {
      latitude: formatCoordinate(lat),
      longitude: formatCoordinate(lng),
      mgrs: mgrsString,
    };
  }, [clickedPosition, formatCoordinate]);

  useEffect(() => {
    if (!mapRef.current) return;

    const handleMapClick = (event) => {
      const lat = event.lngLat.lat;
      const lng = event.lngLat.lng;
      setClickedPosition({ lat, lng });
      setTargetInputs({
        latitude: formatCoordinate(lat),
        longitude: formatCoordinate(lng),
        mgrs: (() => {
          try {
            return mgrs.forward([lng, lat], 5);
          } catch (error) {
            return "";
          }
        })(),
      });
    };

    mapRef.current.on("click", handleMapClick);

    return () => {
      mapRef.current?.off("click", handleMapClick);
    };
  }, [formatCoordinate]);

  useEffect(() => {
    if (!mapRef.current || !clickedPosition) return;

    if (!targetMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "offence-target-marker";
      el.innerHTML = '<img src="/target.png" alt="Target marker" />';
      targetMarkerRef.current = new mapboxgl.Marker({
        element: el,
        rotationAlignment: "map",
      })
        .setLngLat([clickedPosition.lng, clickedPosition.lat])
        .addTo(mapRef.current);
    } else {
      targetMarkerRef.current.setLngLat([clickedPosition.lng, clickedPosition.lat]);
    }

    mapRef.current.easeTo({
      center: [clickedPosition.lng, clickedPosition.lat],
      duration: 600,
      zoom: Math.max(mapRef.current.getZoom(), 14),
    });
  }, [clickedPosition]);

  const handleInputChange = useCallback((event) => {
    const { name, value } = event.target;
    setTargetInputs((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const handleTargetSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      setSubmitStatus("submitting");
      setSubmitError(null);

      const { latitude, longitude, mgrs: mgrsInput } = targetInputs;
      let lat = Number(latitude);
      let lng = Number(longitude);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        if (mgrsInput) {
          try {
            const [mgrsLng, mgrsLat] = mgrs.toPoint(mgrsInput);
            lat = mgrsLat;
            lng = mgrsLng;
          } catch (error) {
            setSubmitStatus("error");
            setSubmitError("Invalid MGRS coordinate provided.");
            return;
          }
        } else {
          setSubmitStatus("error");
          setSubmitError("Latitude and longitude must be valid numbers.");
          return;
        }
      }

      setClickedPosition({ lat, lng });
      setTargetInputs({
        latitude: formatCoordinate(lat),
        longitude: formatCoordinate(lng),
        mgrs: (() => {
          try {
            return mgrs.forward([lng, lat], 5);
          } catch (error) {
            return mgrsInput ?? "";
          }
        })(),
      });

      await new Promise((resolve) => setTimeout(resolve, 600));

      setSubmitStatus("success");
    },
    [formatCoordinate, targetInputs]
  );

  const handleClearTarget = useCallback(() => {
    setClickedPosition(null);
    setTargetInputs({
      latitude: "",
      longitude: "",
      mgrs: "",
    });
    setSubmitStatus("idle");
    setSubmitError(null);
    if (targetMarkerRef.current) {
      targetMarkerRef.current.remove();
      targetMarkerRef.current = null;
    }
  }, []);

  const showTargetSummary = Boolean(formattedPosition);

  return (
    <aside
      className={`offence-overlay${
        isExpanded ? " offence-overlay--expanded" : " offence-overlay--collapsed"
      }`}
    >
      <header className="offence-overlay__header">
        <span className="offence-overlay__title">Offence Dashboard</span>
        <button
          type="button"
          className="offence-overlay__toggle"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          {isExpanded ? "Collapse" : "Expand"}
        </button>
      </header>
      <div className="offence-overlay__body">
        <div className={`offence-overlay__map${mapStatus !== "ready" ? " loading" : ""}`} ref={mapContainerRef}>
          {mapStatus !== "ready" && (
            <span className="offence-overlay__map-placeholder">
              {mapStatus === "token-error" || mapStatus === "error"
                ? mapError ?? "Map failed to load."
                : "Map loading…"}
            </span>
          )}
        </div>
        <div className="offence-overlay__panel">
          <div className="offence-overlay__panel-section">
            <h3 className="offence-overlay__panel-title">Current Target</h3>
            {showTargetSummary ? (
              <dl className="offence-overlay__summary">
                <div className="offence-overlay__summary-row">
                  <dt>Latitude</dt>
                  <dd>{formattedPosition.latitude}</dd>
                </div>
                <div className="offence-overlay__summary-row">
                  <dt>Longitude</dt>
                  <dd>{formattedPosition.longitude}</dd>
                </div>
                <div className="offence-overlay__summary-row">
                  <dt>MGRS</dt>
                  <dd>{formattedPosition.mgrs || "—"}</dd>
                </div>
              </dl>
            ) : (
              <p className="offence-overlay__summary-placeholder">
                Click on the map to select a target position.
              </p>
            )}
          </div>

          <form className="offence-overlay__panel-section offence-overlay__form" onSubmit={handleTargetSubmit}>
            <h3 className="offence-overlay__panel-title">Set Target</h3>
            <div className="offence-overlay__form-grid">
              <label className="offence-overlay__field">
                <span>Latitude</span>
                <input
                  type="text"
                  name="latitude"
                  value={targetInputs.latitude}
                  onChange={handleInputChange}
                  placeholder="e.g. 14.205900"
                />
              </label>
              <label className="offence-overlay__field">
                <span>Longitude</span>
                <input
                  type="text"
                  name="longitude"
                  value={targetInputs.longitude}
                  onChange={handleInputChange}
                  placeholder="e.g. 101.213400"
                />
              </label>
              <label className="offence-overlay__field offence-overlay__field--wide">
                <span>MGRS</span>
                <input
                  type="text"
                  name="mgrs"
                  value={targetInputs.mgrs}
                  onChange={handleInputChange}
                  placeholder="e.g. 48P XS 12345 67890"
                />
              </label>
            </div>
            <div className="offence-overlay__form-actions">
              <button
                type="submit"
                className="offence-overlay__submit"
                disabled={submitStatus === "submitting"}
              >
                {submitStatus === "submitting" ? "Sending…" : "Send Target"}
              </button>
              <button
                type="button"
                className="offence-overlay__clear"
                onClick={handleClearTarget}
                disabled={submitStatus === "submitting"}
              >
                Clear
              </button>
            </div>
            {submitStatus === "success" && (
              <p className="offence-overlay__form-status success">
                Target sent (mock).
              </p>
            )}
            {submitStatus === "error" && (
              <p className="offence-overlay__form-status error">
                {submitError ?? "Failed to send target."}
              </p>
            )}
          </form>
        </div>
        <div className="offence-overlay__status">
          {mapStatus === "loading-token" && <span>Loading Mapbox token…</span>}
          {mapStatus === "initializing" && <span>Preparing map…</span>}
          {mapStatus === "ready" && <span>Map ready.</span>}
          {mapStatus === "token-error" && <span className="error">{mapError}</span>}
          {mapStatus === "error" && <span className="error">{mapError ?? "Map failed to load."}</span>}
        </div>
      </div>
    </aside>
  );
}

