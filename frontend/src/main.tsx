import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Silenciar mensaje de React DevTools en desarrollo
if (typeof window !== "undefined") {
  const originalConsoleLog = console.log;
  console.log = (...args) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Download the React DevTools") ||
        args[0].includes("Content Script Bridge"))
    ) {
      return;
    }
    originalConsoleLog.apply(console, args);
  };
}

createRoot(document.getElementById("root")!).render(<App />);
