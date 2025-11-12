/**
 * DashboardBox - Reusable box container for dashboard components
 * Maintains fixed size, prevents layout shift
 * 
 * @param {string} title - Box header title
 * @param {string} spanClass - Grid span class (e.g., "span-2x1")
 * @param {React.ReactNode} children - Box content
 * @param {string} badge - Optional badge text/number
 * @param {boolean} noPadding - Remove content padding (for maps/charts)
 * @param {string} className - Additional classes
 */
export default function DashboardBox({
  title,
  spanClass = "span-1x1",
  children,
  badge,
  noPadding = false,
  className = "",
}) {
  return (
    <div className={`dashboard-box ${spanClass} ${className}`}>
      {title && (
        <div className="box-header">
          <span className="accent">●</span>
          {title}
          {badge && <span className="badge">{badge}</span>}
        </div>
      )}
      <div className={`box-content ${noPadding ? "no-padding" : ""}`}>
        {children}
      </div>
    </div>
  );
}

/**
 * Example usage:
 * 
 * <DashboardBox title="Drone Status" spanClass="span-2x1" badge="3">
 *   <div className="data-grid">
 *     <div className="data-item">
 *       <div className="data-label">Position</div>
 *       <div className="data-value">14.2059, 101.2134</div>
 *     </div>
 *   </div>
 * </DashboardBox>
 * 
 * <DashboardBox title="Map View" spanClass="span-3x3" noPadding className="map-box">
 *   <div className="fill-parent" ref={mapContainerRef} />
 * </DashboardBox>
 */

