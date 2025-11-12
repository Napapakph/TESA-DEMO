import { NextResponse } from "next/server";

export async function GET() {
  const token =
    process.env.MAPBOX_ACCESS_TOKEN?.trim() ??
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ??
    "";

  if (!token) {
    console.error(
      "Mapbox token request failed: MAPBOX_ACCESS_TOKEN is not configured."
    );
    return NextResponse.json(
      { error: "Mapbox access token is not configured. Add MAPBOX_ACCESS_TOKEN to your environment." },
      { status: 500 }
    );
  }

  return NextResponse.json({ token }, { status: 200 });
}

export function OPTIONS() {
  return new Response(null, { status: 204 });
}

