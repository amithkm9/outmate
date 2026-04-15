import "./SamplePrompts.css";

const SAMPLES = [
  "Find 3 fast-growing SaaS companies in the US with 50-500 employees, raising Series B or later.",
  "Give me 3 VPs of Sales in European fintech startups with more than 100 employees.",
  "Top AI infrastructure companies hiring machine learning engineers in India.",
  "3 marketing leaders at e-commerce brands in North America doing more than $50M in revenue.",
  "Cybersecurity firms with increasing web traffic and at least 200 employees.",
];

export default function SamplePrompts({ onSelect }) {
  return (
    <div className="sample-prompts">
      <p className="sample-label">Try an example:</p>
      <div className="sample-list">
        {SAMPLES.map((s, i) => (
          <button key={i} className="sample-chip" onClick={() => onSelect(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
