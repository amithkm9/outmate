import { useState } from "react";
import Header from "./components/Header.jsx";
import PromptInput from "./components/PromptInput.jsx";
import SamplePrompts from "./components/SamplePrompts.jsx";
import ResultsTable from "./components/ResultsTable.jsx";
import JsonModal from "./components/JsonModal.jsx";
import FilterBadges from "./components/FilterBadges.jsx";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [results, setResults] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedJson, setSelectedJson] = useState(null);

  async function handleSearch() {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setResults(null);
    setMeta(null);

    try {
      let res;
      try {
        res = await fetch(`${API_URL}/api/enrich`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt.trim() }),
        });
      } catch {
        throw new Error("Cannot reach the server. Please check if the backend is running.");
      }

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.message || "Something went wrong");
      }

      setResults(data.results);
      setMeta(data.meta);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setPrompt("");
    setResults(null);
    setMeta(null);
    setError(null);
  }

  return (
    <div className="app">
      <Header />

      <main className="main">
        <div className="search-section">
          <PromptInput
            value={prompt}
            onChange={setPrompt}
            onSubmit={handleSearch}
            disabled={loading}
          />
          <SamplePrompts onSelect={setPrompt} />

          <div className="actions">
            <button
              className="btn btn-primary"
              onClick={handleSearch}
              disabled={loading || !prompt.trim()}
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Searching...
                </>
              ) : (
                "Search & Enrich"
              )}
            </button>
            {(results || error) && (
              <button className="btn btn-secondary" onClick={handleClear}>
                Clear Results
              </button>
            )}
          </div>

          <p className="limit-note">
            Results are limited to <strong>3 records</strong> per query.
          </p>
        </div>

        {error && (
          <div className="error-banner">
            <strong>Error:</strong> {error}
          </div>
        )}

        {meta && <FilterBadges meta={meta} />}

        {results && results.length > 0 && (
          <ResultsTable results={results} onViewJson={setSelectedJson} />
        )}

        {results && results.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">?</div>
            <h3>No results found</h3>
            <p>Try a different prompt or broaden your search criteria.</p>
          </div>
        )}

        {!results && !loading && !error && (
          <div className="empty-state">
            <div className="empty-icon">&#128269;</div>
            <h3>Ready to search</h3>
            <p>
              Enter a natural language prompt above to find and enrich B2B
              company or prospect data. Try one of the sample prompts to get
              started!
            </p>
          </div>
        )}
      </main>

      {selectedJson && (
        <JsonModal data={selectedJson} onClose={() => setSelectedJson(null)} />
      )}
    </div>
  );
}
