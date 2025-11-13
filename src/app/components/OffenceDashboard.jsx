"use client";

import { useState } from "react";

export default function OffenceDashboard() {
  const [isExpanded, setIsExpanded] = useState(false);

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
        <p>Offence dashboard placeholder.</p>
        <p className="offence-overlay__hint">
          Future offence controls and visuals will appear here.
        </p>
      </div>
    </aside>
  );
}

