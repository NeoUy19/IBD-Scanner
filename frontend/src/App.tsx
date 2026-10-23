import { useState } from "react";
import type { FormEvent } from "react";
import "./App.css";
import Scanner from "./components/Scanner";


// The shapes of the data the API sends back
type RuleMatches = {
  additive: string[];
  leaves: string[];
  tags: string[];
  ingredients: string[];
};
type FatResult = "Unknown" | { "fat values": string[] };
type ScanResponse = Record<string, RuleMatches | FatResult | string>;

const API_URL = import.meta.env.VITE_API_URL;
const API_KEY = import.meta.env.VITE_API_KEY;

// Turns the API response into readable lines like "lactose: milk, milk powder"
function toLines(data: ScanResponse): string[] {
  const lines: string[] = [];

  const fat = data.fat as FatResult | undefined;
  if (fat === "Unknown") {
    lines.push("fat: unknown (no fat data)");
  } else if (fat) {
    lines.push("fat: " + fat["fat values"].join(", "));
  }

  for (const [ruleName, value] of Object.entries(data)) {
    if (ruleName === "fat") continue;
    const r = value as RuleMatches;
    const matches = [...r.additive, ...r.leaves, ...r.tags, ...r.ingredients];
    const unique = [...new Set(matches)];
    if (unique.length > 0) {
      lines.push(ruleName + ": " + unique.join(", "));
    }
  }

  return lines;
}

function App() {
  const [barcode, setBarcode] = useState("");
  const [lines, setLines] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const[showCamera,setShowCamera] = useState(false)


  async function scanBarcode(code: string) {
    setLoading(true);
    setError(null);
    setLines(null);

    try {
      const response = await fetch(API_URL + code, {
        headers: { "x-api-key": API_KEY },
      });
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setLines(toLines(data));
      }
    } catch {
      setError("Could not reach the scanner. Try again.");
    } finally {
      setLoading(false);
    }
  }
  function handleScan(event: FormEvent) {
    event.preventDefault();
    scanBarcode(barcode);
  }

  function handleCameraScan(code: string){
    setShowCamera(false)
    setBarcode(code)
    scanBarcode(code)
  }

  return (
    <main>
      <h1>IBD Scanner</h1>
      <p className="disclaimer">
        This flags ingredients <strong>commonly reported</strong> as IBD
        triggers. It can't predict how your body will react, and finding nothing
        doesn't mean a food is safe for you. You know your body better than an
        algorithm. Talk to your care team about your diet.
      </p>

      <form onSubmit={handleScan}>
        <input
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder="Enter a barcode"
        />
        <button type="submit" disabled={loading || barcode === ""}>
          {loading ? "Scanning..." : "Scan"}
        </button>
      </form>
      <button onClick={() =>setShowCamera(!showCamera)}>{showCamera ? 'Close camera' : 'Open camera'}</button>
      {showCamera && <Scanner onScan={handleCameraScan} />}

      {error && <p className="error">{error}</p>}

      {lines && lines.length === 0 && (
        <p>No commonly reported trigger ingredients found.</p>
      )}

      {lines && lines.length > 0 && (
        <ul>
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default App;
