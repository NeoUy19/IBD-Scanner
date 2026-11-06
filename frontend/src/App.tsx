import { useState } from "react";
import type { FormEvent } from "react";
import "./App.css";
import Scanner from "./components/Scanner";

type RuleMatches = {
  additive: string[];
  leaves: string[];
  tags: string[];
  ingredients: string[];
  name: string;
  explanation: string;
};
type FatResult =
  | "Unknown"
  | {
      "fat values": string[];
      name: string;
      explanation: string;
    };

type Product = {
  name: string;
  brand: string;
  image: string;
};

type Flag = {
  name: string;
  matches: string[];
  explanation: string;
};

type ScanResponse = {
  info: Product;
  flags: Record<string, RuleMatches | FatResult>;
};

const API_URL = import.meta.env.VITE_API_URL;
const API_KEY = import.meta.env.VITE_API_KEY;

// Turns the API response into readable lines like "lactose: milk, milk powder"
function toFlags(data: ScanResponse): Flag[] {
  const lines: Flag[] = [];

  const fat = data.flags.fat as FatResult | undefined;
  if (fat === "Unknown") {
    lines.push({
      name: "High fat",
      matches: ["No fat values"],
      explanation: "Fat content could not be checked for this product",
    });
  } else if (fat) {
    lines.push({
      name: fat.name,
      matches: fat["fat values"],
      explanation: fat.explanation,
    });
  }

  for (const [ruleName, value] of Object.entries(data.flags)) {
    if (ruleName === "fat") continue;
    const r = value as RuleMatches;
    const matches = [...r.additive, ...r.leaves, ...r.tags, ...r.ingredients];
    const unique = [...new Set(matches)];
    if (unique.length > 0) {
      lines.push({ name: r.name, matches: unique, explanation: r.explanation });
    }
  }

  return lines;
}

function App() {
  const [barcode, setBarcode] = useState("");
  const [lines, setLines] = useState<Flag[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);

  async function scanBarcode(code: string) {
    setLoading(true);
    setError(null);
    setLines(null);
    setProduct(null);

    try {
      const response = await fetch(API_URL + code, {
        headers: { "x-api-key": API_KEY },
      });
      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setProduct(data.info);
        setLines(toFlags(data));
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

  function handleCameraScan(code: string) {
    setShowCamera(false);
    setBarcode(code);
    scanBarcode(code);
  }

  return (
    <main>
      <h1>IBD Scanner</h1>
      {showDisclaimer && (
        <div className="overlay">
          <div className="popup" role="dialog" aria-modal="true">
            <p className="disclaimer">
              This flags ingredients <strong>commonly reported</strong> as IBD
              triggers. It can't predict how your body will react, and finding
              nothing doesn't mean a food is safe for you. You know your body
              better than an algorithm. Talk to your care team about your diet.
            </p>
            <button onClick={() => setShowDisclaimer(false)}>
              I understand
            </button>
          </div>
        </div>
      )}

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
      <button onClick={() => setShowCamera(!showCamera)}>
        {showCamera ? "Close camera" : "Open camera"}
      </button>
      {/* TODO (scanner page): optional, when showCamera is true, show only the
          scanner and a Close button (hide the form and results) so it feels
          like its own full vertical page. A ternary around the page works. */}
      {showCamera && <Scanner onScan={handleCameraScan} />}

      {error && <p className="error">{error}</p>}

      {lines && lines.length === 0 && (
        <p>No commonly reported trigger ingredients found.</p>
      )}

      {product && (
        <div className="product">
          <h1>{product.name}</h1>
          <p>{product.brand}</p>
          {product.image && <img src={product.image} alt={product.name} />}
        </div>
      )}
      {lines && lines.length > 0 && (
        <ul>
          {lines.map((r) => (
            <li key={r.name}>
              <h3>{r.name}</h3>
              <p>Found: {r.matches.join(", ")}</p>
              <p>{r.explanation}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default App;
