import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { migrateStorage } from "./lib/progress.js";
import "./index.css";

// Before anything reads storage: carry a speller's progress, list and settings
// over from the keys the bee-winning version used. Old keys are left in place.
migrateStorage();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
