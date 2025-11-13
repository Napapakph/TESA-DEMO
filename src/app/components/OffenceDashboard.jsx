"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export default function OffenceDashboard() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mapboxToken, setMapboxToken] = useState(null);
  const [mapStatus, setMapStatus] = useState("idle");
  const [mapError, setMapError] = useState(null);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

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

