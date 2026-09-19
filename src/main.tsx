import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { registerServiceWorker } from "./registerServiceWorker";
import "./styles.css";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Root element was not found.");
}

const showsRepsInputPrototype =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("prototype") === "reps";

const root = createRoot(rootElement);

if (showsRepsInputPrototype) {
  void import("./RepsInputPrototype").then(({ RepsInputPrototype }) => {
    root.render(
      <StrictMode>
        <RepsInputPrototype />
      </StrictMode>,
    );
  });
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  registerServiceWorker();
}
