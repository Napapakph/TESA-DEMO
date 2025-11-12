/**
 * BoxSkeleton - Loading placeholder with same dimensions as actual box
 * Prevents layout shift during data loading
 */
export default function BoxSkeleton({ title = "Loading...", lines = 3 }) {
  return (
    <div className="box-content">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton skeleton-text" />
      ))}
    </div>
  );
}

/**
 * Usage in dashboard boxes:
 * 
 * {isLoading ? (
 *   <BoxSkeleton lines={5} />
 * ) : (
 *   <div className="box-content">
 *     {actualContent}
 *   </div>
 * )}
 */

