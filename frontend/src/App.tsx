import { useState } from "react";
import type { FormEvent } from "react";
import "./App.css";
import Scanner from "./components/Scanner";


// The shapes of the data the API sends back
// TODO (explanations): once the backend sends them, add `name: string` and
// `explanation: string` to RuleMatches (and to the fat type).
type RuleMatches = {
  additive: string[];
  leaves: string[];
  tags: string[];
  ingredients: string[];
};
type FatResult = "Unknown" | { "fat values": string[] };

// TODO (explanations): `lines` is a list of plain strings, which can't hold an
// explanation. Make a type for one flagged trigger, e.g.
//   type Flag = { name: string; matches: string[]; explanation: string };
// then have toLines return Flag[] (rename it, e.g. toFlags) and change the
// `lines` state to useState<Flag[] | null>.
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

  // TODO (product image): after the backend change, the rules live under
  // data.flags, so loop over Object.entries(data.flags) instead (and read
  // fat from data.flags.fat). Add a `Product` type
  //   { name: string; brand: string; image: string }
  // and update ScanResponse to { product: Product; flags: ... }.
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
  const [showDisclaimer, setShowDisclaimer] = useState(true);


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
        // TODO (product image): also save data.product in a new state,
        // e.g. useState<Product | null>(null), and clear it at the start
        // of each scan like setLines(null).
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
      <button onClick={() =>setShowCamera(!showCamera)}>{showCamera ? 'Close camera' : 'Open camera'}</button>
      {/* TODO (scanner page): optional, when showCamera is true, show only the
          scanner and a Close button (hide the form and results) so it feels
          like its own full vertical page. A ternary around the page works. */}
      {showCamera && <Scanner onScan={handleCameraScan} />}

      {error && <p className="error">{error}</p>}

      {lines && lines.length === 0 && (
        <p>No commonly reported trigger ingredients found.</p>
      )}

      {/* TODO (product image): above the results, show the product:
            - the name (and brand) as a heading
            - {product.image && <img src={product.image} alt={product.name} />}
              so products with no photo don't show a broken image
          Give the img a max width in App.css (e.g. 120px). */}

      {/* TODO (explanations): render each Flag as a card instead of one line:
            - the trigger name as a heading
            - "Found: " + the matched ingredients
            - the explanation in smaller text underneath
          Optional: hide the explanation behind a "Why?" button, using a
          <details><summary>Why?</summary>...</details> element (no state
          needed). Wording must stay "commonly reported", never "unsafe". */}
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
