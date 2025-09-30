"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import mgrs from "mgrs";
import markerIcon2xUrl from "leaflet/dist/images/marker-icon-2x.png";
import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";

import ActionToolbar from "@/app/components/dashboard/ActionToolbar";
import DashboardHeader from "@/app/components/dashboard/DashboardHeader";
import MapInfoPanel from "@/app/components/dashboard/MapInfoPanel";
import RouteLayerManager from "@/app/components/dashboard/RouteLayerManager";
import MissionControl from "@/app/components/dashboard/MissionControl";
import FlightControlPanel from "@/app/components/dashboard/FlightControlPanel";
import ThreatPanel from "@/app/components/dashboard/ThreatPanel";
import AlertLogPanel from "@/app/components/dashboard/AlertLogPanel";

const markerIconRetina = typeof markerIcon2xUrl === "string" ? markerIcon2xUrl : markerIcon2xUrl.src;
const markerIcon = typeof markerIconUrl === "string" ? markerIconUrl : markerIconUrl.src;
const markerShadow = typeof markerShadowUrl === "string" ? markerShadowUrl : markerShadowUrl.src;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIconRetina,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const BASE_POSITION = { lat: 14.2059, lng: 101.2134 };
const EARTH_RADIUS_METERS = 6371000;

const intruderSeeds = [
  {
    id: "alpha",
    name: "โดรนไม่ทราบฝ่าย Alpha",
    position: { lat: 14.2132, lng: 101.2188 },
  },
  {
    id: "bravo",
    name: "โดรนไม่ทราบฝ่าย Bravo",
    position: { lat: 14.2036, lng: 101.2052 },
  },
  {
    id: "charlie",
    name: "โดรนไม่ทราบฝ่าย Charlie",
    position: { lat: 14.1975, lng: 101.2205 },
  },
];

// ฟังก์ชันแปลงองศาให้เป็นเรเดียนสำหรับสูตรคำนวณ
function toRadians(value) {
  return (value * Math.PI) / 180;
}

// ฟังก์ชันคำนวณระยะทางระหว่างสองพิกัดด้วยสูตร Haversine
function haversineDistance(origin, destination) {
  const dLat = toRadians(destination.lat - origin.lat);
  const dLng = toRadians(destination.lng - origin.lng);
  const lat1 = toRadians(origin.lat);
  const lat2 = toRadians(destination.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

// ฟังก์ชันคำนวณทิศทาง (bearing) ระหว่างสองพิกัด
function bearingBetween(origin, destination) {
  const lat1 = toRadians(origin.lat);
  const lat2 = toRadians(destination.lat);
  const dLng = toRadians(destination.lng - origin.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

// ฟังก์ชันจัดรูปแบบระยะทางให้อ่านง่าย
function formatDistance(value) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} กม.`;
  }
  return `${value.toFixed(0)} เมตร`;
}

// ฟังก์ชันแปลงองศาให้เป็นข้อความทิศ
function headingToText(heading) {
  const directions = [
    "เหนือ",
    "ตะวันออกเฉียงเหนือ",
    "ตะวันออก",
    "ตะวันออกเฉียงใต้",
    "ใต้",
    "ตะวันตกเฉียงใต้",
    "ตะวันตก",
    "ตะวันตกเฉียงเหนือ",
  ];
  const index = Math.round(heading / 45) % directions.length;
  return directions[index];
}

// ฟังก์ชันเลือกระยะห่างของเส้นกริดตามระดับซูม
function chooseGridStep(zoom) {
  if (zoom >= 16) return 200;
  if (zoom >= 14) return 500;
  if (zoom >= 12) return 1000;
  if (zoom >= 10) return 2000;
  return 5000;
}

// ฟังก์ชันเลือกความละเอียดของ MGRS ให้เหมาะกับระยะกริด
function mgrsAccuracyForStep(step) {
  if (step >= 5000) return 1;
  if (step >= 2000) return 2;
  if (step >= 1000) return 3;
  if (step >= 500) return 4;
  return 5;
}

// คอมโพเนนต์หลักของแดชบอร์ดฝ่ายตั้งรับ
export default function DefenseDashboard() {
  // ตัวชี้ถึง map และองค์ประกอบในแผนที่
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const droneMarkerRef = useRef(null);
  const detectionCircleRef = useRef(null);
  const baseDetectionCircleRef = useRef(null);
  const gridLayerRef = useRef(null);
  const intruderLayerRef = useRef(null);
  const intruderMarkersRef = useRef(new Map());
  const baseMarkerRef = useRef(null);
  const basePositionRef = useRef(BASE_POSITION);
  const animationRef = useRef(null);
  const latestDroneRef = useRef(null);
  const baseIntrudersRef = useRef(new Set());
  const routeManagerRef = useRef(null);

  // สถานะหลักของโดรนและระบบ
  const [drone, setDrone] = useState({
    position: BASE_POSITION,
    altitude: 120,
    heading: 35,
    speed: 18,
  });
  const [basePosition, setBasePosition] = useState(BASE_POSITION);
  const [detectionRadius, setDetectionRadius] = useState(600);
  const [baseDetectionRadius, setBaseDetectionRadius] = useState(800);
  const [targetInput, setTargetInput] = useState({
    lat: "",
    lng: "",
    mgrsZone: "",
    mgrsGrid: "",
    mgrsCoord: "",
  });
  const [targetPosition, setTargetPosition] = useState(null);
  const [lastClicked, setLastClicked] = useState(null);
  const [intruders, setIntruders] = useState(() =>
    intruderSeeds.map((seed) => ({
      ...seed,
      distance: null,
      distanceToBase: null,
      isInside: false,
      isNearBase: false,
      mgrs: null,
    })),
  );
  const [alertLog, setAlertLog] = useState([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [scanMode, setScanMode] = useState("manual");
  const [isMapReady, setIsMapReady] = useState(false);

  const baseMgrs = useMemo(
    () => mgrs.forward([basePosition.lng, basePosition.lat], 5),
    [basePosition],
  );

  // ดึงสถานะเริ่มต้นจาก API จำลอง
  useEffect(() => {
    let cancelled = false;
    const loadSnapshot = async () => {
      try {
        const response = await fetch("/api/drone");
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;
        setDrone((prev) => ({
          ...prev,
          position: data.position || prev.position,
          altitude: data.altitude ?? prev.altitude,
          heading: data.heading ?? prev.heading,
        }));
        setDetectionRadius(data.detectionRadius ?? detectionRadius);
      } catch (error) {
        // ไม่ต้องทำอะไรหากเรียก API จำลองล้มเหลว
      }
    };

    loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, []);

  // เก็บสถานะโดรนล่าสุดไว้ใช้งานใน animation
  useEffect(() => {
    latestDroneRef.current = drone;
  }, [drone]);

  useEffect(() => {
    basePositionRef.current = basePosition;
  }, [basePosition]);
  useEffect(() => {
    if (!baseMarkerRef.current) return;
    baseMarkerRef.current.setLatLng(basePosition);
  }, [basePosition]);

  const deriveMgrsFields = useCallback((lat, lng) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { zone: "", grid: "", coord: "" };
    }

    try {
      const value = mgrs.forward([lng, lat], 5);
      return {
        zone: value.slice(0, 3),
        grid: value.slice(3, 5),
        coord: value.slice(5),
      };
    } catch (error) {
      return { zone: "", grid: "", coord: "" };
    }
  }, []);

  const setTargetFromLatLng = useCallback((latValue, lngValue) => {
    setTargetInput((prev) => {
      const latNumber = Number(latValue);
      const lngNumber = Number(lngValue);
      const isLatValid = Number.isFinite(latNumber);
      const isLngValid = Number.isFinite(lngNumber);

      const latString = isLatValid ? latNumber.toFixed(5) : "";
      const lngString = isLngValid ? lngNumber.toFixed(5) : "";
      const mgrsFields = isLatValid && isLngValid
        ? deriveMgrsFields(latNumber, lngNumber)
        : { zone: "", grid: "", coord: "" };

      return {
        ...prev,
        lat: latString,
        lng: lngString,
        mgrsZone: mgrsFields.zone,
        mgrsGrid: mgrsFields.grid,
        mgrsCoord: mgrsFields.coord,
      };
    });
  }, [deriveMgrsFields]);

  // ตั้งค่าพื้นฐานของแผนที่ Leaflet ครั้งแรก
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [BASE_POSITION.lat, BASE_POSITION.lng],
      zoom: 13,
      minZoom: 7,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    const baseMarker = L.marker(basePositionRef.current, { draggable: true }).addTo(map);
    baseMarkerRef.current = baseMarker;
    baseMarker.bindTooltip("Main Base", { permanent: true, direction: "top", offset: [0, -12] });

    const baseCircle = L.circle(basePositionRef.current, {
      radius: baseDetectionRadius,
      color: "#facc15",
      fillColor: "#facc15",
      fillOpacity: 0.08,
      weight: 1.5,
      dashArray: "8 6",
    }).addTo(map);
    baseDetectionCircleRef.current = baseCircle;

    const handleBaseDragEnd = (event) => {
      const { lat, lng } = event.target.getLatLng();
      const confirmed = window.confirm("Confirm moving the main base?");
      if (!confirmed) {
        baseMarker.setLatLng(basePositionRef.current);
        return;
      }
      setBasePosition({ lat, lng });
    };

    baseMarker.on("dragend", handleBaseDragEnd);

    const droneIcon = L.divIcon({
      className: "drone-icon",
      html: '<div class="drone-icon-wrapper"><div class="drone-icon-body"></div><div class="drone-icon-tail"></div></div>',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    const marker = L.marker(BASE_POSITION, { icon: droneIcon }).addTo(map);
    droneMarkerRef.current = marker;

    const circle = L.circle(BASE_POSITION, {
      radius: detectionRadius,
      color: "#38bdf8",
      fillColor: "#38bdf8",
      fillOpacity: 0.12,
      weight: 1,
    }).addTo(map);
    detectionCircleRef.current = circle;

    gridLayerRef.current = L.layerGroup().addTo(map);
    intruderLayerRef.current = L.layerGroup().addTo(map);

    intruderSeeds.forEach((intruder) => {
      const intruderMarker = L.circleMarker(intruder.position, {
        radius: 6,
        color: "#f97316",
        weight: 2,
        fillOpacity: 0.85,
      })
        .bindTooltip(intruder.name, { direction: "top", offset: [0, -6] })
        .addTo(intruderLayerRef.current);
      intruderMarkersRef.current.set(intruder.id, intruderMarker);
    });

    const compassControl = L.control({ position: "topright" });

    // ฟังก์ชันจัดการคลิกบนแผนที่เพื่อบันทึกพิกัดล่าสุด
    const handleMapClick = (event) => {
      const clickedPosition = { lat: event.latlng.lat, lng: event.latlng.lng };
      setLastClicked(clickedPosition);
      setTargetFromLatLng(clickedPosition.lat, clickedPosition.lng);
    };

    compassControl.onAdd = function onAdd() {
      const div = L.DomUtil.create("div", "compass-control");
      div.innerHTML =
        '<div class="compass"><span class="north">N</span><span class="east">E</span><span class="south">S</span><span class="west">W</span></div>';
      return div;
    };
    compassControl.addTo(map);

    L.control.scale({ position: "bottomleft" }).addTo(map);

    // ฟังก์ชันวาดกริด MGRS บนแผนที่ตามมุมมองปัจจุบัน
    const updateGrid = () => {
      if (!gridLayerRef.current) return;
      gridLayerRef.current.clearLayers();

      const bounds = map.getBounds();
      const zoom = map.getZoom();
      const stepMeters = chooseGridStep(zoom);
      const gridAccuracy = mgrsAccuracyForStep(stepMeters);
      const centerLatRad = toRadians(map.getCenter().lat);
      const latStep = stepMeters / 111320;
      const cosLat = Math.max(Math.cos(centerLatRad), 0.2);
      const lngStep = stepMeters / (111320 * cosLat);

      const south = Math.floor(bounds.getSouth() / latStep) * latStep;
      const north = Math.ceil(bounds.getNorth() / latStep) * latStep;
      const west = Math.floor(bounds.getWest() / lngStep) * lngStep;
      const east = Math.ceil(bounds.getEast() / lngStep) * lngStep;

      for (let lat = south; lat <= north; lat += latStep) {
        const line = L.polyline(
          [
            [lat, bounds.getWest()],
            [lat, bounds.getEast()],
          ],
          {
            color: "rgba(148, 163, 184, 0.4)",
            weight: 1,
            interactive: false,
          },
        );
        gridLayerRef.current.addLayer(line);

        const label = mgrs.forward([bounds.getWest(), lat], gridAccuracy);
        const labelMarker = L.marker([lat, bounds.getWest()], {
          icon: L.divIcon({
            className: "grid-label grid-label-lat",
            html: label,
            iconSize: [0, 0],
          }),
          interactive: false,
        });
        gridLayerRef.current.addLayer(labelMarker);
      }

      for (let lng = west; lng <= east; lng += lngStep) {
        const line = L.polyline(
          [
            [bounds.getSouth(), lng],
            [bounds.getNorth(), lng],
          ],
          {
            color: "rgba(148, 163, 184, 0.4)",
            weight: 1,
            interactive: false,
          },
        );
        gridLayerRef.current.addLayer(line);

        const label = mgrs.forward([lng, bounds.getNorth()], gridAccuracy);
        const labelMarker = L.marker([bounds.getNorth(), lng], {
          icon: L.divIcon({
            className: "grid-label grid-label-lng",
            html: label,
            iconSize: [0, 0],
          }),
          interactive: false,
        });
        gridLayerRef.current.addLayer(labelMarker);
      }
    };

    map.on("moveend", updateGrid);
    map.on("zoomend", updateGrid);
    map.on("click", handleMapClick);
    updateGrid();

    mapRef.current = map;
    setIsMapReady(true);

    return () => {
      map.off("moveend", updateGrid);
      map.off("zoomend", updateGrid);
      map.off("click", handleMapClick);
      baseMarker.off("dragend", handleBaseDragEnd);
      baseMarkerRef.current = null;
      setIsMapReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, [setTargetFromLatLng]);

  // ซิงก์ตำแหน่งและหัวโดรนกับ marker ในแผนที่
  useEffect(() => {
    if (!droneMarkerRef.current) return;
    droneMarkerRef.current.setLatLng(drone.position);
    const wrapper = droneMarkerRef.current
      .getElement()
      ?.querySelector(".drone-icon-wrapper");
    if (wrapper) {
      wrapper.style.transform = `rotate(${drone.heading}deg)`;
    }
  }, [drone.position, drone.heading]);

  // ปรับรัศมีตรวจจับให้ตรงกับค่าที่ตั้ง
  useEffect(() => {
    if (detectionCircleRef.current) {
      detectionCircleRef.current.setLatLng(drone.position);
      detectionCircleRef.current.setRadius(detectionRadius);
    }
  }, [drone.position, detectionRadius]);

  // ปรับสีและข้อความของเครื่องหมายโดรนไม่ทราบฝ่ายเมื่อสแกน
  useEffect(() => {
    intruders.forEach((intruder) => {
      const marker = intruderMarkersRef.current.get(intruder.id);
      if (!marker) return;
      marker.setStyle({
        color: intruder.isInside ? "#ef4444" : "#f97316",
        fillColor: intruder.isInside ? "#ef4444" : "#fb923c",
      });
      if (intruder.distance != null) {
        marker.setTooltipContent(
          `${intruder.name} • ${formatDistance(intruder.distance)}`,
        );
      }
    });
  }, [intruders]);

  // จัดการ animation การเคลื่อนที่แบบจำลองของโดรน
  useEffect(() => {
    if (!mapRef.current || !targetPosition) return;

    setIsNavigating(true);

    const startPosition = latestDroneRef.current?.position || BASE_POSITION;
    const currentSpeed = Math.max(latestDroneRef.current?.speed || drone.speed, 5);
    const duration = Math.max(
      2000,
      (haversineDistance(startPosition, targetPosition) / (currentSpeed * 0.277)) * 1000,
    );
    const startTime = performance.now();

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const animate = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const lat =
        startPosition.lat + (targetPosition.lat - startPosition.lat) * progress;
      const lng =
        startPosition.lng + (targetPosition.lng - startPosition.lng) * progress;

      setDrone((prev) => ({
        ...prev,
        position: { lat, lng },
      }));

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        routeManagerRef.current?.clearRoute();
        setTargetPosition(null);
        setIsNavigating(false);
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [targetPosition, drone.speed, routeManagerRef]);

  const droneMgrs = useMemo(
    () => mgrs.forward([drone.position.lng, drone.position.lat], 5),
    [drone.position],
  );

  const lastClickedMgrs = useMemo(
    () => (lastClicked ? mgrs.forward([lastClicked.lng, lastClicked.lat], 5) : null),
    [lastClicked],
  );

  useEffect(() => {
    if (baseDetectionCircleRef.current) {
      baseDetectionCircleRef.current.setLatLng(basePosition);
      baseDetectionCircleRef.current.setRadius(baseDetectionRadius);
    }
  }, [basePosition, baseDetectionRadius]);

  const distanceFromBase = useMemo(
    () => haversineDistance(basePosition, drone.position),
    [basePosition, drone.position],
  );

  // จัดการการเปลี่ยนค่าของฟอร์มเป้าหมายใหม่
  const handleTargetChange = useCallback((field, value) => {
    if (field === "lat" || field === "lng") {
      setTargetInput((prev) => {
        const next = { ...prev, [field]: value };
        const latNumber = Number.parseFloat(next.lat);
        const lngNumber = Number.parseFloat(next.lng);
        const { zone, grid, coord } = deriveMgrsFields(latNumber, lngNumber);
        return {
          ...next,
          mgrsZone: zone,
          mgrsGrid: grid,
          mgrsCoord: coord,
        };
      });
      return;
    }

    setTargetInput((prev) => ({ ...prev, [field]: value }));
  }, [deriveMgrsFields]);

  // ส่งคำสั่งให้โดรนไปยังพิกัดใหม่
  const handleCommand = useCallback(async (event) => {
    event.preventDefault();

    let lat = Number.parseFloat(targetInput.lat);
    let lng = Number.parseFloat(targetInput.lng);

    const zonePart = targetInput.mgrsZone.trim().toUpperCase();
    const gridPart = targetInput.mgrsGrid.trim().toUpperCase();
    const coordPart = targetInput.mgrsCoord.trim().replace(/\s+/g, "");

    const hasMgrsInput = zonePart !== "" || gridPart !== "" || coordPart !== "";

    if (hasMgrsInput) {
      if (!zonePart || !gridPart || !coordPart) {
        window.alert("Please complete all MGRS fields (zone, grid, coordinate) before sending the command.");
        return;
      }

      if (!/^\d{1,2}[C-HJ-NP-X]$/.test(zonePart)) {
        window.alert("The MGRS zone should be 1-2 digits followed by a zone letter (e.g., 48Q).");
        return;
      }

      if (!/^[A-Z]{2}$/.test(gridPart)) {
        window.alert("The MGRS 100km grid should be two letters (e.g., WD).");
        return;
      }

      if (!/^\d{2,10}$/.test(coordPart) || coordPart.length % 2 !== 0) {
        window.alert("The MGRS coordinate should be an even number of digits (2 to 10).");
        return;
      }

      const mgrsString = `${zonePart}${gridPart}${coordPart}`;

      try {
        const [convertedLng, convertedLat] = mgrs.toPoint(mgrsString);
        if (!Number.isFinite(convertedLat) || !Number.isFinite(convertedLng)) {
          throw new Error("Invalid MGRS conversion");
        }
        lat = convertedLat;
        lng = convertedLng;
      } catch (error) {
        window.alert("Unable to convert the MGRS value to coordinates. Please double-check the input.");
        return;
      }
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      window.alert("Please enter valid coordinates before sending the command.");
      return;
    }

    const nextLatLng = { lat, lng };

    const startForRoute = latestDroneRef.current?.position ?? BASE_POSITION;
    routeManagerRef.current?.drawRoute(startForRoute, nextLatLng);

    setDrone((prev) => ({
      ...prev,
      heading: bearingBetween(prev.position, nextLatLng),
    }));
    setTargetPosition(nextLatLng);

    try {
      await fetch("/api/drone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: nextLatLng }),
      });
    } catch (error) {
      // หากบันทึกไป backend ล้มเหลว ให้เงียบไว้เพื่อไม่ให้รบกวนการใช้งาน
    }

    setTargetFromLatLng(lat, lng);
  }, [targetInput, routeManagerRef, setTargetFromLatLng]);

  const handleClearTarget = useCallback(() => {
    setTargetInput({
      lat: "",
      lng: "",
      mgrsZone: "",
      mgrsGrid: "",
      mgrsCoord: "",
    });
    setTargetPosition(null);
    setLastClicked(null);
    routeManagerRef.current?.clearRoute();
  }, [routeManagerRef]);

  // คำนวณการสแกนภัยคุกคามรอบพื้นที่
  const handleScanIntruders = useCallback(() => {
    const newlyEnteredBase = [];

    setIntruders((prev) => {
      const nextBaseSet = new Set();

      const updated = prev.map((intruder) => {
        const distance = haversineDistance(drone.position, intruder.position);
        const distanceToBase = haversineDistance(basePosition, intruder.position);
        const isInside = distance <= detectionRadius;
        const isNearBase = distanceToBase <= baseDetectionRadius;

        let intruderMgrs = intruder.mgrs;
        if (!intruderMgrs) {
          try {
            intruderMgrs = mgrs.forward([intruder.position.lng, intruder.position.lat], 5);
          } catch (error) {
            intruderMgrs = null;
          }
        }

        if (isNearBase) {
          nextBaseSet.add(intruder.id);
          if (!baseIntrudersRef.current.has(intruder.id)) {
            newlyEnteredBase.push({
              id: intruder.id,
              name: intruder.name,
              position: intruder.position,
              mgrs: intruderMgrs,
              distanceToDrone: distance,
              distanceToBase,
            });
          }
        }

        return {
          ...intruder,
          distance,
          distanceToBase,
          isInside,
          isNearBase,
          mgrs: intruderMgrs,
        };
      });

      baseIntrudersRef.current = nextBaseSet;
      return updated;
    });

    if (newlyEnteredBase.length > 0) {
      const timestamp = new Date().toLocaleTimeString();
      setAlertLog((prev) => [
        {
          timestamp,
          drone: {
            position: basePosition,
            mgrs: baseMgrs,
            label: "Base",
          },
          detected: newlyEnteredBase,
        },
        ...prev.slice(0, 4),
      ]);
      window.alert("Base alert: hostile drones detected within the base perimeter.");
    }
  }, [drone.position, basePosition, detectionRadius, baseDetectionRadius, baseMgrs]);

  useEffect(() => {
    baseIntrudersRef.current = new Set();
    handleScanIntruders();
  }, [basePosition, baseDetectionRadius, handleScanIntruders]);

  useEffect(() => {
    if (scanMode !== "auto") return;

    const intervalId = setInterval(() => {
      handleScanIntruders();
    }, 1000);

    handleScanIntruders();

    return () => {
      clearInterval(intervalId);
    };
  }, [scanMode, handleScanIntruders]);

  // เก็บบันทึกการแจ้งเตือนโดรนไม่ทราบฝ่ายที่เข้ามาใกล้
  const handleRaiseAlert = useCallback(async () => {
    const detected = intruders.filter((intruder) => intruder.isInside);
    if (detected.length === 0) {
      window.alert("No hostile drones detected within the radius.");
      return;
    }

    const timestamp = new Date().toLocaleTimeString();
    const detailedDetected = detected.map((intruder) => {
      let intruderMgrs = null;
      try {
        intruderMgrs = mgrs.forward([intruder.position.lng, intruder.position.lat], 5);
      } catch (error) {
        intruderMgrs = null;
      }

      return {
        id: intruder.id,
        name: intruder.name,
        position: intruder.position,
        mgrs: intruderMgrs,
        distanceToDrone:
          intruder.distance ?? haversineDistance(drone.position, intruder.position),
        distanceToBase:
          intruder.distanceToBase ?? haversineDistance(basePosition, intruder.position),
      };
    });

    const droneMgrsSnapshot = (() => {
      try {
        return mgrs.forward([drone.position.lng, drone.position.lat], 5);
      } catch (error) {
        return null;
      }
    })();

    const entry = {
      timestamp,
      drone: {
        position: drone.position,
        mgrs: droneMgrsSnapshot,
        label: "Drone",
      },
      detected: detailedDetected,
    };
    setAlertLog((prev) => [entry, ...prev.slice(0, 4)]);

    try {
      await fetch("/api/drone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert: entry }),
      });
    } catch (error) {
      // Ignore failures when logging alerts to the mock API
    }
  }, [intruders, drone.position, basePosition]);

  // หยุดการเคลื่อนที่ของโดรนตามคำร้องขอ
  const handleStopRequest = useCallback(() => {
    if (!isNavigating && !animationRef.current) {
      window.alert("Autonomous navigation is not active.");
      return;
    }

    const confirmStop = window.confirm(
      "ยืนยันการหยุดโดรนไว้ ณ ตำแหน่งปัจจุบันหรือไม่?",
    );

    if (!confirmStop) {
      window.alert("Continuing the current route.");
      return;
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    routeManagerRef.current?.clearRoute();
    setTargetPosition(null);
    setIsNavigating(false);
  }, [isNavigating, routeManagerRef]);

  // โฟกัสแผนที่กลับมาที่โดรนทันที
  const handleFocusOnDrone = useCallback(() => {
    if (!mapRef.current) return;
    mapRef.current.flyTo([drone.position.lat, drone.position.lng], Math.max(mapRef.current.getZoom(), 15), {
      duration: 0.8,
    });
  }, [drone.position]);

  return (
    <div className="dashboard">
      <section className="map-section">
        <DashboardHeader baseMgrs={baseMgrs} />
        <MapInfoPanel
          drone={drone}
          droneMgrs={droneMgrs}
          distanceFromBase={formatDistance(distanceFromBase)}
          headingText={headingToText(drone.heading)}
          lastClicked={lastClicked}
          lastClickedMgrs={lastClickedMgrs}
          onFillTarget={() => {
            if (!lastClicked) return;
            setTargetFromLatLng(lastClicked.lat, lastClicked.lng);
          }}
        />
        <RouteLayerManager
          ref={routeManagerRef}
          mapRef={mapRef}
          isMapReady={isMapReady}
          dronePosition={drone.position}
        />
          <ActionToolbar
            onFocus={handleFocusOnDrone}
            onStop={handleStopRequest}
            isNavigating={isNavigating}
          />
        <div ref={mapContainerRef} className="map-container" />
      </section>
      <section className="control-section">
        <MissionControl
          targetInput={targetInput}
          onChange={handleTargetChange}
          onSubmit={handleCommand}
          onClear={handleClearTarget}
        />
        <FlightControlPanel
          drone={drone}
          onAltitudeChange={(value) =>
            setDrone((prev) => ({ ...prev, altitude: Number(value) }))
          }
          onHeadingChange={(value) =>
            setDrone((prev) => ({ ...prev, heading: Number(value) }))
          }
          onSpeedChange={(value) =>
            setDrone((prev) => ({ ...prev, speed: Number(value) }))
          }
          detectionRadius={detectionRadius}
          onRadiusChange={(value) => setDetectionRadius(Number(value))}
          baseDetectionRadius={baseDetectionRadius}
          onBaseRadiusChange={(value) => setBaseDetectionRadius(Number(value))}
        />
        <ThreatPanel
          intruders={intruders}
          scanMode={scanMode}
          onScanModeChange={setScanMode}
          onScan={handleScanIntruders}
          onAlert={handleRaiseAlert}
          formatDistance={formatDistance}
        />
        <AlertLogPanel alertLog={alertLog} formatDistance={formatDistance} />
      </section>
    </div>
  );
}
