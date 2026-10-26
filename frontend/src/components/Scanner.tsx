import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useState } from "react";


type ScannerProps = {
  onScan: (barcode: string) => void;
};

function Scanner({ onScan }: ScannerProps) {
  const [detected, setDetected] = useState(false)
  
  useEffect(() => {
    const scanner = new Html5Qrcode("reader");

    const started = scanner.start(
      { facingMode: "environment" },
      // TODO (vertical + guide box): html5-qrcode takes more settings here.
      // Look up `qrbox` (the area it scans in, wide and short suits barcodes)
      // and `aspectRatio` (a value under 1 makes the video taller than wide).
      { fps: 10 },
      // TODO (scanning visual): before calling onScan, set `detected` to true.
      // Optional: wait a moment (setTimeout) so the user sees the visual
      // before App hides the scanner.
      (text) => onScan(text),
      undefined,
    );

    return () => {
      started
        .then(() => scanner.stop())
        .then(() => scanner.clear())
        .catch(() => {});
    };
  }, []);
  // TODO (layout): wrap #reader in a container div (e.g. className="scanner")
  // and put an overlay inside it on top of the video:
  //   - a frame showing where the barcode goes
  //   - a hint like "Line up the barcode inside the box"
  //   - when `detected` is true: change the frame's class (e.g. "detected")
  //     and the hint text (e.g. "Scanning...")
  // Use a ternary or {detected && ...} like in App.tsx.
  return <div id="reader" />;
}
export default Scanner;
