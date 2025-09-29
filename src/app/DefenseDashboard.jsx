"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import mgrs from "mgrs";

import ActionToolbar from "@/app/components/dashboard/ActionToolbar";
import DashboardHeader from "@/app/components/dashboard/DashboardHeader";
import MapInfoPanel from "@/app/components/dashboard/MapInfoPanel";
import MissionControl from "@/app/components/dashboard/MissionControl";
import FlightControlPanel from "@/app/components/dashboard/FlightControlPanel";
import ThreatPanel from "@/app/components/dashboard/ThreatPanel";
import AlertLogPanel from "@/app/components/dashboard/AlertLogPanel";

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
  const gridLayerRef = useRef(null);
  const intruderLayerRef = useRef(null);
  const intruderMarkersRef = useRef(new Map());
  const baseMarkerRef = useRef(null);
  const basePositionRef = useRef(BASE_POSITION);
  const animationRef = useRef(null);
  const latestDroneRef = useRef(null);

  // สถานะหลักของโดรนและระบบ
  const [drone, setDrone] = useState({
    position: BASE_POSITION,
    altitude: 120,
    heading: 35,
    speed: 18,
  });
  const [basePosition, setBasePosition] = useState(BASE_POSITION);
  const [detectionRadius, setDetectionRadius] = useState(600);
  const [targetInput, setTargetInput] = useState({ lat: "", lng: "" });
  const [targetPosition, setTargetPosition] = useState(null);
  const [lastClicked, setLastClicked] = useState(null);
  const [intruders, setIntruders] = useState(() =>
    intruderSeeds.map((seed) => ({
      ...seed,
      distance: null,
      isInside: false,
    })),
  );
  const [alertLog, setAlertLog] = useState([]);
  const [isNavigating, setIsNavigating] = useState(false);

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

    return () => {
      map.off("moveend", updateGrid);
      map.off("zoomend", updateGrid);
      map.off("click", handleMapClick);
      baseMarker.off("dragend", handleBaseDragEnd);
      baseMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

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
  }, [targetPosition, drone.speed]);

  const droneMgrs = useMemo(
    () => mgrs.forward([drone.position.lng, drone.position.lat], 5),
    [drone.position],
  );

  const lastClickedMgrs = useMemo(
    () => (lastClicked ? mgrs.forward([lastClicked.lng, lastClicked.lat], 5) : null),
    [lastClicked],
  );

  const distanceFromBase = useMemo(
    () => haversineDistance(basePosition, drone.position),
    [basePosition, drone.position],
  );

  // จัดการการเปลี่ยนค่าของฟอร์มเป้าหมายใหม่
  const handleTargetChange = useCallback((field, value) => {
    setTargetInput((prev) => ({ ...prev, [field]: value }));
  }, []);

  // ส่งคำสั่งให้โดรนไปยังพิกัดใหม่
  const handleCommand = useCallback(async (event) => {
    event.preventDefault();
    const lat = parseFloat(targetInput.lat);
    const lng = parseFloat(targetInput.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      window.alert("กรุณากรอกพิกัดให้ถูกต้องก่อนส่งคำสั่ง");
      return;
    }
    setDrone((prev) => ({
      ...prev,
      heading: bearingBetween(prev.position, { lat, lng }),
    }));
    setTargetPosition({ lat, lng });

    try {
      await fetch("/api/drone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: { lat, lng } }),
      });
    } catch (error) {
      // หากบันทึกไป backend ล้มเหลว ให้เงียบไว้เพื่อไม่ให้รบกวนการใช้งาน
    }
  }, [targetInput]);

  // คำนวณการสแกนภัยคุกคามรอบพื้นที่
  const handleScanIntruders = useCallback(() => {
    setIntruders((prev) =>
      prev.map((intruder) => {
        const distance = haversineDistance(drone.position, intruder.position);
        return {
          ...intruder,
          distance,
          isInside: distance <= detectionRadius,
        };
      }),
    );
  }, [drone.position, detectionRadius]);

  // เก็บบันทึกการแจ้งเตือนโดรนไม่ทราบฝ่ายที่เข้ามาใกล้
  const handleRaiseAlert = useCallback(async () => {
    const detected = intruders.filter((intruder) => intruder.isInside);
    if (detected.length === 0) {
      window.alert("ยังไม่มีโดรนไม่ทราบฝ่ายอยู่ในรัศมี");
      return;
    }
    const timestamp = new Date().toLocaleTimeString();
    const entry = { timestamp, detected };
    setAlertLog((prev) => [entry, ...prev.slice(0, 4)]);

    try {
      await fetch("/api/drone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert: entry }),
      });
    } catch (error) {
      // หากบันทึกการแจ้งเตือนล้มเหลวให้ผู้ใช้ดำเนินต่อไปได้ตามปกติ
    }
  }, [intruders]);

  // หยุดการเคลื่อนที่ของโดรนตามคำร้องขอ
  const handleStopRequest = useCallback(() => {
    if (!isNavigating && !animationRef.current) {
      window.alert("โดรนไม่ได้อยู่ระหว่างการเดินทางอัตโนมัติ");
      return;
    }

    const confirmStop = window.confirm(
      "ยืนยันการหยุดโดรนไว้ ณ ตำแหน่งปัจจุบันหรือไม่?",
    );

    if (!confirmStop) {
      window.alert("โดรนจะเดินหน้าต่อไปตามแผน");
      return;
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setTargetPosition(null);
    setIsNavigating(false);
  }, [isNavigating]);

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
        <ActionToolbar
          onFocus={handleFocusOnDrone}
          onStop={handleStopRequest}
          isNavigating={isNavigating}
        />
        <div ref={mapContainerRef} className="map-container" />
        <MapInfoPanel
          drone={drone}
          droneMgrs={droneMgrs}
          distanceFromBase={formatDistance(distanceFromBase)}
          headingText={headingToText(drone.heading)}
          lastClicked={lastClicked}
          lastClickedMgrs={lastClickedMgrs}
          onFillTarget={() => {
            if (!lastClicked) return;
            setTargetInput({
              lat: lastClicked.lat.toFixed(5),
              lng: lastClicked.lng.toFixed(5),
            });
          }}
        />
      </section>
      <section className="control-section">
        <MissionControl
          targetInput={targetInput}
          onChange={handleTargetChange}
          onSubmit={handleCommand}
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
        />
        <ThreatPanel
          intruders={intruders}
          onScan={handleScanIntruders}
          onAlert={handleRaiseAlert}
          formatDistance={formatDistance}
        />
        <AlertLogPanel alertLog={alertLog} />
      </section>
    </div>
  );
}
