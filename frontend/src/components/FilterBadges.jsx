import "./FilterBadges.css";

export default function FilterBadges({ meta }) {
  if (!meta?.filters_used) return null;

  const { entity_type, filters_used, total_results, duration_ms } = meta;
  const filterEntries = Object.entries(filters_used).filter(
    ([, v]) => v != null && (Array.isArray(v) ? v.length > 0 : true)
  );

  return (
    <div className="filter-badges">
      <div className="filter-header">
        <span className="filter-type">
          {entity_type === "company" ? "Companies" : "Prospects"}
        </span>
        <span className="filter-meta">
          {total_results} result{total_results !== 1 ? "s" : ""} in{" "}
          {(duration_ms / 1000).toFixed(1)}s
        </span>
      </div>
      <div className="badges">
        {filterEntries.map(([key, value]) => (
          <span key={key} className="badge-item">
            <strong>{key.replace(/_/g, " ")}:</strong>{" "}
            {Array.isArray(value) ? value.join(", ") : String(value)}
          </span>
        ))}
      </div>
    </div>
  );
}
