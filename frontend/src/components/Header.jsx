import "./Header.css";

export default function Header() {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="logo">
          <span className="logo-icon">O</span>
          <h1>OutMate &ndash; NLP Enrichment Demo</h1>
        </div>
        <span className="badge">B2B Data Intelligence</span>
      </div>
    </header>
  );
}
