"use client";

import dynamic from "next/dynamic";

const DefenseDashboard = dynamic(() => import("./DefenseDashboard"), { ssr: false });

export default function Home() {
  return (
    <main className="page-shell">
      <DefenseDashboard />
    </main>
  );
}
