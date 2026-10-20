import React from "react";
import ReactDOM from "react-dom/client";
import { MotionConfig, LazyMotion, domAnimation } from "motion/react";
import "./app/i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import { App } from "./app/App";
import "./styles.css";
import "./interface.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <TooltipProvider delay={350}>
          <App />
        </TooltipProvider>
      </LazyMotion>
    </MotionConfig>
  </React.StrictMode>,
);
