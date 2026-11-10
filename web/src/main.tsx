import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router";
import "./index.css";
import { DemoProvider } from "./lib/demoState";
import { AppShell } from "./components/AppShell";
import { DemoHome } from "./pages/DemoHome";
import { FamilyPage } from "./pages/FamilyPage";
import { StaffDashboard } from "./pages/StaffDashboard";
import { ReportsPage } from "./pages/ReportsPage";
import { NotFound } from "./pages/NotFound";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DemoProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DemoHome />} />
            <Route path="family/:id" element={<FamilyPage />} />
            <Route path="staff" element={<StaffDashboard />} />
            <Route path="staff/reports" element={<ReportsPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </HashRouter>
    </DemoProvider>
  </StrictMode>,
);
