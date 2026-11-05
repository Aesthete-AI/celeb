import { MotionConfig } from "framer-motion";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ProfileProvider } from "./lib/profile";
import { ShellProvider } from "./lib/shell";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ProfileProvider>
        <ShellProvider>
          <MotionConfig reducedMotion="user">
            <App />
          </MotionConfig>
        </ShellProvider>
      </ProfileProvider>
    </BrowserRouter>
  </StrictMode>,
);
