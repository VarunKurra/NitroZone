"use client";

import { ErrorView } from "@/components/common/error-view";
import "./globals.css";

export default function GlobalError(props: { error: Error & { digest?: string }; reset?: () => void; retry?: () => void }) {
  return (
    <html lang="en">
      <body>
        <ErrorView {...props} />
      </body>
    </html>
  );
}
