import { NextResponse } from "next/server";
import {
  fetchDroneSnapshot,
  saveDroneTarget,
  recordAlert,
  fetchAlertHistory,
} from "@/server/mockDatabase";

// ให้บริการข้อมูลสถานะโดรนล่าสุดสำหรับฝั่ง frontend
export async function GET() {
  const snapshot = fetchDroneSnapshot();
  const alerts = fetchAlertHistory();
  return NextResponse.json({ ...snapshot, alerts });
}

// รับคำสั่งใหม่จาก frontend เพื่อตั้งค่าจุดหมายหรือบันทึกแจ้งเตือน
export async function POST(request) {
  const body = await request.json();

  if (body?.target) {
    saveDroneTarget(body.target);
  }

  if (body?.alert) {
    recordAlert(body.alert);
  }

  return NextResponse.json({ success: true });
}

// API สำหรับดึงข้อมูลกล้อง (Camera Info)
export async function GET_CAMERA(request, context) {
  try {
    const { camId } = context.params || {};
    
    if (!camId) {
      return NextResponse.json(
        { error: "Camera ID is required" },
        { status: 400 }
      );
    }

    // Mock camera data - สามารถแทนที่ด้วย real API call
    const mockCameraData = {
      cam001: {
        name: "กล้อง ฐาน 1",
        lat: 14.2059,
        lng: 101.2134,
        mgrs: "48QXA123456",
        orientation: 45,
        time: new Date().toISOString(),
      },
      cam002: {
        name: "กล้อง ฐาน 2",
        lat: 14.2100,
        lng: 101.2150,
        mgrs: "48QXA234567",
        orientation: 180,
        time: new Date().toISOString(),
      },
    };

    const cameraData = mockCameraData[camId] || {
      name: `Camera ${camId}`,
      lat: 14.2059 + Math.random() * 0.01,
      lng: 101.2134 + Math.random() * 0.01,
      mgrs: "48QXA123456",
      orientation: Math.random() * 360,
      time: new Date().toISOString(),
    };

    return NextResponse.json(cameraData, { status: 200 });
  } catch (error) {
    console.error("Camera API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch camera data" },
      { status: 500 }
    );
  }
}
