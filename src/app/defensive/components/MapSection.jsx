"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN =
  "pk.eyJ1IjoiY2hhdGNoYWxlcm0iLCJhIjoiY21nZnpiYzU3MGRzdTJrczlkd3RxamN4YyJ9.k288gnCNLdLgczawiB79gQ";
mapboxgl.accessToken = MAPBOX_TOKEN;

const MAP_STYLES = {
  outdoors: "mapbox://styles/mapbox/outdoors-v12",
  satellite: "mapbox://styles/mapbox/satellite-v9",
  street3d: "mapbox://styles/mapbox/light-v11",
};

// Custom MapBox Navigation Control
class UrbanCockpitNavigationControl {
  onAdd(map) {
    this._map = map;
    this._container = document.createElement("div");
    this._container.className = "urban-cockpit-nav-control";
    
    const zoomIn = this._createButton("+", () => map.zoomIn());
    const zoomOut = this._createButton("−", () => map.zoomOut());
    
    this._container.appendChild(zoomIn);
    this._container.appendChild(zoomOut);
    
    return this._container;
  }
  
  _createButton(html, fn) {
    const button = document.createElement("button");
    button.className = "urban-cockpit-nav-btn";
    button.innerHTML = html;
    button.type = "button";
    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this._map && typeof fn === "function") {
        fn();
      }
    });
    return button;
  }
  
  onRemove() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  }
}

export default function MapSection({
  mapStyleKey,
  layers,
  cameraInfo,
  drones,
  onMapReady,
  onCameraFocus,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const droneMarkersRef = useRef(new Map());
  const cameraMarkerRef = useRef(null);
  const cameraOrientationLineRef = useRef(null);
  const savedCameraStateRef = useRef(null);
  const isStyleChangingRef = useRef(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLES[mapStyleKey] || MAP_STYLES.outdoors,
      center: [101.2134, 14.2059],
      zoom: 13,
      pitch: 45,
      bearing: 0,
      antialias: true,
    });

    map.addControl(new UrbanCockpitNavigationControl(), "top-right");

    // Save camera state before style change
    const handleStyleData = () => {
      if (isStyleChangingRef.current && savedCameraStateRef.current) {
        const { center, zoom, bearing, pitch } = savedCameraStateRef.current;
        map.jumpTo({
          center,
          zoom,
          bearing,
          pitch,
        });
        isStyleChangingRef.current = false;
      }
    };

    map.on("styledata", handleStyleData);
    map.on("style.load", handleStyleData);

    mapRef.current = map;
    onMapReady?.(map);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // Only run once on mount

  // Handle style change - preserve camera position
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Only save state if map is loaded
    if (map.isStyleLoaded()) {
      savedCameraStateRef.current = {
        center: map.getCenter().toArray(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      };
      isStyleChangingRef.current = true;
    }

    map.setStyle(MAP_STYLES[mapStyleKey]);
  }, [mapStyleKey]);

  // Handle camera focus - only when trigger changes
  useEffect(() => {
    if (!onCameraFocus || onCameraFocus === 0 || !cameraInfo) return;
    const map = mapRef.current;
    if (!map) return;

    // Wait for style to load if needed
    const waitForStyle = () => {
      if (!map.isStyleLoaded()) {
        map.once("style.load", waitForStyle);
        return;
      }

      const { lat, lng } = cameraInfo;
      map.flyTo({
        center: [lng, lat],
        zoom: 14,
        essential: true,
      });

      // Save this position as locked
      savedCameraStateRef.current = {
        center: [lng, lat],
        zoom: 14,
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      };
    };

    waitForStyle();
  }, [onCameraFocus, cameraInfo]); // Include cameraInfo for lat/lng

  // Sync drone markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      console.log("[MapSection] Map not ready yet");
      return;
    }

    // Wait for map to be fully loaded
    if (!map.isStyleLoaded()) {
      console.log("[MapSection] Map style not loaded yet, waiting...");
      map.once("style.load", () => {
        console.log("[MapSection] Map style loaded, processing drones");
        processDrones();
      });
      return;
    }

    processDrones();

    function processDrones() {
      const dronesLayer = layers.find((l) => l.id === "drones" && l.enabled);
      if (!dronesLayer) {
        console.log("[MapSection] Drones layer is disabled, removing all markers");
        // Remove all markers if layer is disabled
        droneMarkersRef.current.forEach((value) => {
          value.marker.remove();
          value.popup.remove();
        });
        droneMarkersRef.current.clear();
        return;
      }

      console.log(`[MapSection] Processing ${drones.length} drones`);
      const liveIds = new Set();

      // Get drone icon based on type
      const getDroneIcon = (type) => {
        const icons = {
          DJIAir: "🚁",
          AutelEvo: "🛸",
          DJIMavic: "✈️",
          ParrotAnafi: "🎯",
        };
        return icons[type] || "🚁";
      };

      drones.forEach((drone) => {
        // Validate drone data
        if (!drone || typeof drone.lat !== "number" || typeof drone.lng !== "number") {
          console.warn("[MapSection] Invalid drone data:", drone);
          return;
        }

        const key = String(drone.droneId || `drone-${Math.random()}`);
        liveIds.add(key);
        const existing = droneMarkersRef.current.get(key);
        const lngLat = [drone.lng, drone.lat];

        const popupContent = `
          <div style="font-size:0.85rem; color: #1e293b; font-family: 'Rajdhani', sans-serif;">
            <strong>🚁 Drone ${key} - ${drone.type || "Unknown"}</strong><br/>
            พิกัด: ${drone.lat.toFixed(5)}, ${drone.lng.toFixed(5)}<br/>
            ความเร็ว: ${drone.velocity?.toFixed(2) ?? "0.00"} m/s<br/>
            ทิศทาง: ${drone.direction?.toFixed(1) ?? "0.0"}°<br/>
            กล้อง: ${drone.cam_id || "N/A"}<br/>
            เวลา: ${drone.time ? new Date(drone.time).toLocaleTimeString("th-TH") : "N/A"}
          </div>`;

        if (existing) {
          // Update existing marker
          existing.marker.setLngLat(lngLat);
          existing.popup.setLngLat(lngLat).setHTML(popupContent);
          // Update rotation if direction changed
          if (existing.markerElement && drone.direction !== undefined) {
            existing.markerElement.style.transform = `rotate(${drone.direction}deg)`;
          }
        } else {
          // Create new marker
          const markerEl = document.createElement("div");
          markerEl.className = "drone-marker-icon";
          markerEl.style.width = "40px";
          markerEl.style.height = "40px";
          markerEl.style.fontSize = "28px";
          markerEl.style.display = "flex";
          markerEl.style.alignItems = "center";
          markerEl.style.justifyContent = "center";
          markerEl.style.transform = `rotate(${drone.direction ?? 0}deg)`;
          markerEl.style.transition = "transform 0.3s ease";
          markerEl.style.filter = "drop-shadow(0 0 8px rgba(255, 51, 51, 0.9)) drop-shadow(0 0 15px rgba(255, 51, 51, 0.5))";
          markerEl.style.cursor = "pointer";
          markerEl.style.userSelect = "none";
          markerEl.textContent = getDroneIcon(drone.type);

          const marker = new mapboxgl.Marker({ element: markerEl })
            .setLngLat(lngLat)
            .addTo(map);
          
          const popup = new mapboxgl.Popup({ 
            offset: 25,
            closeButton: true,
            closeOnClick: false
          }).setHTML(popupContent);
          
          marker.setPopup(popup);
          droneMarkersRef.current.set(key, { marker, popup, markerElement: markerEl });
          
          console.log(`[MapSection] Created marker for drone ${key} at [${drone.lat}, ${drone.lng}]`);
        }
      });

      // Remove old markers that are no longer in the drones array
      droneMarkersRef.current.forEach((value, key) => {
        if (!liveIds.has(key)) {
          console.log(`[MapSection] Removing marker for drone ${key}`);
          value.marker.remove();
          value.popup.remove();
          droneMarkersRef.current.delete(key);
        }
      });

      console.log(`[MapSection] Total active markers: ${droneMarkersRef.current.size}`);
    }
  }, [drones, layers]);

  // Update camera marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cameraInfo) return;

    if (!layers.find((l) => l.id === "cameras" && l.enabled)) {
      // Remove camera marker if layer is disabled
      if (cameraMarkerRef.current) {
        cameraMarkerRef.current.marker.remove();
        if (cameraMarkerRef.current.popup) {
          cameraMarkerRef.current.popup.remove();
        }
        cameraMarkerRef.current = null;
      }
      return;
    }

    const { lat, lng, name, camId, orientation } = cameraInfo;
    const lngLat = [lng, lat];

    // Remove old camera marker if exists
    if (cameraMarkerRef.current) {
      cameraMarkerRef.current.marker.remove();
      if (cameraMarkerRef.current.popup) {
        cameraMarkerRef.current.popup.remove();
      }
    }

    // Create camera marker
    const markerEl = document.createElement("div");
    markerEl.style.width = "24px";
    markerEl.style.height = "24px";
    markerEl.style.background = "rgba(0, 102, 255, 0.9)";
    markerEl.style.borderRadius = "50%";
    markerEl.style.border = "2px solid #0066ff";
    markerEl.style.boxShadow = "0 0 20px rgba(0, 102, 255, 0.8), 0 0 40px rgba(0, 102, 255, 0.4)";
    markerEl.style.cursor = "pointer";

    const popupContent = `
      <div style="font-size:0.85rem; color: #1e293b;">
        <strong>📷 ${name || `Camera ${camId}`}</strong><br/>
        ID: ${camId}<br/>
        พิกัด: ${lat.toFixed(5)}, ${lng.toFixed(5)}<br/>
        ทิศทาง: ${orientation?.toFixed(1) ?? 0}°<br/>
        เวลา: ${cameraInfo.timestamp ? new Date(cameraInfo.timestamp).toLocaleString('th-TH') : '-'}
      </div>`;

    const marker = new mapboxgl.Marker({ element: markerEl })
      .setLngLat(lngLat)
      .addTo(map);
    const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(popupContent);
    marker.setPopup(popup);

    cameraMarkerRef.current = { marker, popup };

    // Add orientation line if orientation is available
    if (orientation !== null && orientation !== undefined) {
      // Remove old line if exists
      if (cameraOrientationLineRef.current) {
        if (map.getSource("camera-orientation")) {
          map.removeLayer("camera-orientation-line");
          map.removeSource("camera-orientation");
        }
      }

      // Calculate endpoint for orientation line (500m in the direction)
      const distance = 0.005;
      const rad = (orientation * Math.PI) / 180;
      const endLng = lng + distance * Math.sin(rad);
      const endLat = lat + distance * Math.cos(rad);

      // Add line source and layer
      map.addSource("camera-orientation", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [lngLat, [endLng, endLat]],
          },
        },
      });

      map.addLayer({
        id: "camera-orientation-line",
        type: "line",
        source: "camera-orientation",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#ffd700",
          "line-width": 3,
          "line-opacity": 0.9,
        },
      });

      cameraOrientationLineRef.current = true;
    }

    return () => {
      if (cameraMarkerRef.current) {
        cameraMarkerRef.current.marker.remove();
        if (cameraMarkerRef.current.popup) {
          cameraMarkerRef.current.popup.remove();
        }
        cameraMarkerRef.current = null;
      }
      if (cameraOrientationLineRef.current && map.getSource("camera-orientation")) {
        map.removeLayer("camera-orientation-line");
        map.removeSource("camera-orientation");
        cameraOrientationLineRef.current = null;
      }
    };
  }, [cameraInfo, layers]);

  return (
    <div className="map-column">
      <div ref={mapContainerRef} className="map-container" />
    </div>
  );
}

