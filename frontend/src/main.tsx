import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000
    }
  }
});

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "2rem",
            background: "#f7f3ec",
            color: "#1f2522",
            fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
          }}
        >
          <div style={{ maxWidth: "24rem", textAlign: "center" }}>
            <h1 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>Pennywise needs a reload</h1>
            <p style={{ marginBottom: "1.25rem" }}>The page did not finish loading. Reload to open it again.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                height: "3rem",
                padding: "0 1.25rem",
                border: 0,
                borderRadius: "0.75rem",
                background: "#8B5CF6",
                color: "white",
                fontWeight: 700
              }}
            >
              Reload
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </AppErrorBoundary>
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // Service workers are being retired because iOS home-screen apps can keep
    // their Cache Storage after a release. Update an existing registration
    // once so /sw.js can clear it; do not create a new registration.
    navigator.serviceWorker
      .getRegistration()
      .then((registration) => registration?.update())
      .catch(() => undefined);
  });
}
