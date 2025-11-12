import { NextResponse } from "next/server";

// Mock camera database
const mockCameraDatabase = {
  cam001: {
    name: "กล้องสำเร็จ ฐาน 1",
    lat: 14.2059,
    lng: 101.2134,
    mgrs: "48QXA123456",
    orientation: 45,
    timestamp: new Date().toISOString(),
  },
  cam002: {
    name: "กล้องสำเร็จ ฐาน 2",
    lat: 14.2100,
    lng: 101.2150,
    mgrs: "48QXA234567",
    orientation: 180,
    timestamp: new Date().toISOString(),
  },
  cam003: {
    name: "กล้องสำเร็จ ฐาน 3",
    lat: 14.2120,
    lng: 101.2100,
    mgrs: "48QXA345678",
    orientation: 270,
    timestamp: new Date().toISOString(),
  },
};

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const camId = url.searchParams.get("id") || url.pathname.split("/").pop();
    const token = request.headers.get("x-camera-token");

    if (!camId || camId === "route.js") {
      return NextResponse.json(
        { error: "Camera ID is required" },
        { status: 400 }
      );
    }

    // Verify token if provided
    if (token && token !== "valid-token") {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 403 }
      );
    }

    // Get camera data from mock database
    const cameraData = mockCameraDatabase[camId] || {
      name: `Camera ${camId}`,
      lat: 14.2059 + Math.random() * 0.05,
      lng: 101.2134 + Math.random() * 0.05,
      mgrs: "48QXA" + Math.random().toString(36).substring(2, 8).toUpperCase(),
      orientation: Math.random() * 360,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(cameraData, { status: 200 });
  } catch (error) {
    console.error("Camera API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch camera data", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    // Save or update camera data
    if (body?.camId && body?.lat && body?.lng) {
      mockCameraDatabase[body.camId] = {
        name: body.name || `Camera ${body.camId}`,
        lat: body.lat,
        lng: body.lng,
        mgrs: body.mgrs || "48QXA000000",
        orientation: body.orientation || 0,
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json({ success: true, data: mockCameraDatabase[body.camId] });
    }

    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Camera POST error:", error);
    return NextResponse.json(
      { error: "Failed to save camera data", details: error.message },
      { status: 500 }
    );
  }
}
