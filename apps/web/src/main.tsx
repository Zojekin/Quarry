import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./index.css";
import "./production.css";
import "katex/dist/katex.min.css";

createRoot(document.getElementById("root")!).render(<App />);
