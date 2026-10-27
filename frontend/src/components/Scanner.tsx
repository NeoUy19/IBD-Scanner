import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useState } from "react";

type ScannerProps = {
  onScan: (barcode: string) => void;
};
function Scanner({ onScan }: ScannerProps) {
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    const scanner = new Html5Qrcode("reader");
    let done = false; // set to true after the first read, so repeats are ignored

    const started = scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 200, height: 100 }, aspectRatio: 1 },
      (text) => {
        if (done) return;
        done = true;
        setDetected(true);
        setTimeout(() => {
          onScan(text);
        }, 600);
      },
      undefined,
    );

    return () => {
      started
        .then(() => scanner.stop())
        .then(() => scanner.clear())
        .catch(() => {});
    };
  }, []);
  return (
    <div className="scanner">
      <div id="reader" />
      <p className="scan-hint">
        {detected ? "Scanning..." : "Line up barcode within the box"}{" "}
      </p>
    </div>
  );
}
export default Scanner;
