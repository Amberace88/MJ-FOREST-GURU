"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="lv">
      <body style={{ background: "#0b0f0d", color: "#e8efe9", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 22, letterSpacing: 1 }}>Radās kļūda</h1>
          <p style={{ color: "#8fa196" }}>Mēģiniet vēlreiz vai atgriezieties vēlāk.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "10px 18px", borderRadius: 12, border: 0, background: "#2f6b3e", color: "#fff" }}>Mēģināt vēlreiz</button>
        </div>
      </body>
    </html>
  );
}
