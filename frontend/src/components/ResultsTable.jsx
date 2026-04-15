import "./ResultsTable.css";

const COMPANY_COLUMNS = [
  { key: "name", label: "Company" },
  { key: "domain", label: "Domain" },
  { key: "industry", label: "Industry" },
  { key: "employee_count", label: "Employees" },
  { key: "revenue", label: "Revenue" },
  { key: "country", label: "Country" },
  { key: "state", label: "Region" },
  { key: "website", label: "Website" },
  { key: "linkedin_url", label: "LinkedIn" },
];

const PROSPECT_COLUMNS = [
  { key: "name", label: "Name" },
  { key: "title", label: "Title" },
  { key: "company", label: "Company" },
  { key: "email", label: "Email" },
  { key: "country", label: "Country" },
  { key: "department", label: "Dept" },
  { key: "seniority", label: "Level" },
  { key: "linkedin_url", label: "LinkedIn" },
];

function formatCell(value, key) {
  if (value === "N/A" || value == null) return <span className="na">N/A</span>;

  if (key === "linkedin_url" && typeof value === "string" && value !== "N/A") {
    return (
      <a href={value} target="_blank" rel="noopener noreferrer" className="link">
        Profile
      </a>
    );
  }

  if ((key === "domain" || key === "website") && typeof value === "string" && value !== "N/A") {
    const url = value.startsWith("http") ? value : `https://${value}`;
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="link">
        {value}
      </a>
    );
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : <span className="na">N/A</span>;
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export default function ResultsTable({ results, onViewJson }) {
  if (!results?.length) return null;

  const isCompany = results[0].type === "company";
  const columns = isCompany ? COMPANY_COLUMNS : PROSPECT_COLUMNS;

  return (
    <div className="results-container">
      <h2 className="results-title">
        Enriched Results ({results.length})
      </h2>

      {/* Desktop table view */}
      <div className="table-wrapper">
        <table className="results-table">
          <thead>
            <tr>
              <th>#</th>
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row, i) => (
              <tr key={i}>
                <td className="row-num">{i + 1}</td>
                {columns.map((col) => (
                  <td key={col.key}>{formatCell(row[col.key], col.key)}</td>
                ))}
                <td>
                  <button
                    className="json-btn"
                    onClick={() => onViewJson(row.raw || row)}
                  >
                    View JSON
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card view */}
      <div className="cards-view">
        {results.map((row, i) => (
          <div key={i} className="result-card">
            <div className="card-header">
              <span className="card-num">#{i + 1}</span>
              <strong>{row.name || "Unknown"}</strong>
              <button
                className="json-btn"
                onClick={() => onViewJson(row.raw || row)}
              >
                View JSON
              </button>
            </div>
            <div className="card-fields">
              {columns.filter(c => c.key !== "name").map((col) => (
                <div key={col.key} className="card-field">
                  <span className="card-label">{col.label}</span>
                  <span className="card-value">
                    {formatCell(row[col.key], col.key)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
