import { Html5Qrcode } from "html5-qrcode";
import { useEffect } from "react";

type ScannerProps = {
  onScan: (barcode: string) => void;
};

function Scanner({ onScan }: ScannerProps) {
  useEffect(() => {
    const scanner = new Html5Qrcode("reader");

    const started = scanner.start(
      { facingMode: "environment" },
      { fps: 10 },
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
  return <div id="reader" />;
}
export default Scanner;
