import "./PromptInput.css";

export default function PromptInput({ value, onChange, onSubmit, disabled }) {
  function handleKeyDown(e) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      onSubmit();
    }
  }

  return (
    <div className="prompt-input">
      <label htmlFor="prompt-textarea" className="prompt-label">
        Describe the companies or prospects you're looking for
      </label>
      <textarea
        id="prompt-textarea"
        className="prompt-textarea"
        placeholder="e.g. Find 3 fast-growing SaaS companies in the US with 50-500 employees..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={4}
        maxLength={2000}
      />
      <span className="char-count">{value.length} / 2000</span>
    </div>
  );
}
