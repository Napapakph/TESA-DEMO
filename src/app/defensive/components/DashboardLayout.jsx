"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import TopBar from "./TopBar";
import SidebarInfo from "./SidebarInfo";
import MapSection from "./MapSection";
import RightSideBar from "./RightSideBar";
import "../defensive-dashboard.css";

const SOCKET_URL = "http://192.168.1.104:3000";
const DEFAULT_BASE = {
  lat: 14.2059,
  lng: 101.2134,
  mgrs: "48QXA123456",
  name: "ฐานปฏิบัติการหลัก",
};

export default function DashboardLayout() {
  const mapRef = useRef(null);
  const [baseInfo, setBaseInfo] = useState(DEFAULT_BASE);
  const [cameraInfo, setCameraInfo] = useState(null);
  const [drones, setDrones] = useState([]);
  const [mapStyleKey, setMapStyleKey] = useState("outdoors");
  const [layers, setLayers] = useState([
    { id: "drones", label: "Drone Positions", icon: "🚁", enabled: true, color: "#ff3333" },
    { id: "cameras", label: "Camera Locations", icon: "📷", enabled: true, color: "#66b3ff" },
    { id: "threats", label: "Threat Zones", icon: "⚠️", enabled: false, color: "#ffd700" },
    { id: "coverage", label: "Coverage Areas", icon: "📡", enabled: false, color: "#66b3ff" },
  ]);

  const [wsStatus, setWsStatus] = useState("กำลังเชื่อมต่อ...");
  const [wsError, setWsError] = useState("");
  const [cameraFocusTrigger, setCameraFocusTrigger] = useState(0);

  // Focus Base Configuration
  const [focusBaseConfig] = useState({
    useApiOnly: true, // ต้องมีพิกัดจาก API เท่านั้น
    enableFallback: false, // ถ้าไม่มี API ให้ไป (10,10)
  });

  const handleMapReady = useCallback((map) => {
    mapRef.current = map;
  }, []);

  const handleFocusBase = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    // ตรวจสอบว่ามีข้อมูลฐานทัพจาก API หรือไม่
    if (baseInfo && baseInfo.lat && baseInfo.lng) {
      // มีข้อมูลจาก API - บินไปที่พิกัดนั้น
      map.flyTo({
        center: [baseInfo.lng, baseInfo.lat],
        zoom: 14,
        essential: true,
      });
    } else {
      // ไม่มีข้อมูลจาก API
      if (focusBaseConfig.enableFallback) {
        // เปิด fallback - ไปที่ (10, 10)
        map.flyTo({
          center: [10, 10],
          zoom: 10,
          essential: true,
        });
      }
      // ถ้า useApiOnly = true และไม่มี API = ไม่ทำอะไร
    }
  }, [baseInfo, focusBaseConfig]);

  const handleCameraInfoLoad = useCallback(
    ({ lat, lng, mgrs, name, timestamp, camId, orientation, ...rest }) => {
      setBaseInfo({ lat, lng, mgrs, name });
      setCameraInfo({
        camId,
        name,
        timestamp,
        lat,
        lng,
        mgrs,
        orientation: orientation ?? 0,
        ...rest,
      });
      // Trigger camera focus
      setCameraFocusTrigger((prev) => prev + 1);
    },
    []
  );

  const handleClearCamera = useCallback(() => {
    setCameraInfo(null);
    setBaseInfo(DEFAULT_BASE);
    // ไม่เปลี่ยนตำแหน่งแผนที่
  }, []);

  const handleLayerToggle = useCallback((layerId) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === layerId ? { ...layer, enabled: !layer.enabled } : layer
      )
    );
  }, []);

  // Socket.IO connection
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    
    console.log("Socket.IO URL:", SOCKET_URL);
    
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      reconnectionDelayMax: 5000,
    });

    socket.on("connect", () => {
      console.log("Socket.IO connected:", socket.id);
      setWsStatus("เชื่อมต่อแล้ว");
      setWsError("");
    });

    socket.on("connect_error", (error) => {
      console.error("Socket.IO connection error:", error);
      setWsStatus("เกิดข้อผิดพลาด");
      setWsError(error?.message || "ไม่สามารถเชื่อมต่อได้");
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket.IO disconnected:", reason);
      setWsStatus("ตัดการเชื่อมต่อ");
      if (reason === "io server disconnect") {
        // Server disconnected the socket, need to manually reconnect
        socket.connect();
      }
    });

    socket.on("reconnect", (attemptNumber) => {
      console.log("Socket.IO reconnected after", attemptNumber, "attempts");
      setWsStatus("เชื่อมต่อแล้ว");
      setWsError("");
    });

    socket.on("reconnect_error", (error) => {
      console.error("Socket.IO reconnection error:", error);
      setWsStatus("กำลังเชื่อมต่อใหม่...");
      setWsError(error?.message || "ไม่สามารถเชื่อมต่อได้");
    });

    socket.on("reconnect_failed", () => {
      console.error("Socket.IO reconnection failed");
      setWsStatus("เชื่อมต่อล้มเหลว");
      setWsError("ไม่สามารถเชื่อมต่อใหม่ได้");
    });

    // Listen for drone data
    // Adjust event name based on your server's emit event name
    // Common event names: "drones", "drone-data", "data", "message", etc.
    socket.on("drones", (payload) => {
      handleDroneData(payload);
    });

    socket.on("drone-data", (payload) => {
      handleDroneData(payload);
    });

    socket.on("data", (payload) => {
      handleDroneData(payload);
    });

    socket.on("message", (payload) => {
      handleDroneData(payload);
    });

    // Fallback: listen to all events for debugging
    socket.onAny((eventName, ...args) => {
      console.log("Socket.IO event received:", eventName, args);
      // Try to handle as drone data if it looks like an array
      if (args.length > 0 && Array.isArray(args[0])) {
        handleDroneData(args[0]);
      }
    });

    function handleDroneData(payload) {
      console.log("[DashboardLayout] Received drone data:", payload);
      
      if (!Array.isArray(payload)) {
        console.warn("[DashboardLayout] Payload is not an array:", typeof payload);
        return;
      }
      
      console.log(`[DashboardLayout] Processing ${payload.length} drone items`);
      
      // Validate and map Socket.IO data to drone structure
      const validatedDrones = payload
        .filter((item, index) => {
          // Validate required fields
          const isValid = (
            item &&
            typeof item.droneId === "number" &&
            typeof item.lat === "number" &&
            typeof item.lng === "number" &&
            typeof item.time === "string"
          );
          
          if (!isValid) {
            console.warn(`[DashboardLayout] Invalid drone item at index ${index}:`, item);
          }
          
          return isValid;
        })
        .map((item) => ({
          droneId: item.droneId ?? 0,
          type: item.type ?? "Unknown",
          lat: item.lat ?? 0,
          lng: item.lng ?? 0,
          velocity: item.velocity ?? 0,
          direction: item.direction ?? 0,
          time: item.time ?? new Date().toISOString(),
          isDrone: item.isDrone ?? true,
          cam_id: item.cam_id ?? "",
        }));
      
      console.log(`[DashboardLayout] Validated ${validatedDrones.length} drones:`, validatedDrones);
      setDrones(validatedDrones);
    }

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  const cameraOrientation = cameraInfo?.orientation ?? 0;

  return (
    <div className="dashboard-root">
      <TopBar
        baseInfo={baseInfo}
        onFocusBase={handleFocusBase}
        cameraOrientation={cameraOrientation}
        wsStatus={wsStatus}
        wsError={wsError}
        cameraInfo={cameraInfo}
      />
      <div className="dashboard-content">
        {/* Fullscreen Map */}
        <MapSection
          mapStyleKey={mapStyleKey}
          layers={layers}
          cameraInfo={cameraInfo}
          drones={drones}
          onMapReady={handleMapReady}
          onCameraFocus={cameraFocusTrigger}
        />

        {/* Left Sidebar Overlay */}
        <SidebarInfo drones={drones} />

        {/* Right Sidebar Overlay - Combined Layer Control + Camera Form */}
        <RightSideBar
          mapStyleKey={mapStyleKey}
          onMapStyleChange={setMapStyleKey}
          layers={layers}
          onLayerToggle={handleLayerToggle}
          cameraInfo={cameraInfo}
          onCameraInfoLoad={handleCameraInfoLoad}
          onClearCamera={handleClearCamera}
        />
      </div>
    </div>
  );
}

