import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Navigate, Route, Routes } from "react-router";
import "./index.css";
import { I18nProvider } from "./lib/i18n";
import { PlatformProvider } from "./platform/store";
import { FamilyShell } from "./apps/family/FamilyShell";
import { FamilySignIn } from "./apps/family/SignIn";
import { FamilyHome } from "./apps/family/Home";
import { FamilyReferralPage } from "./apps/family/ReferralPage";
import { ClinicShell } from "./apps/clinic/ClinicShell";
import { Waitlist } from "./apps/clinic/Waitlist";
import { Reports } from "./apps/clinic/Reports";
import { DataPage } from "./apps/clinic/Data";
import { ModelPage } from "./apps/clinic/Model";
import { SettingsPage } from "./apps/clinic/Settings";
import { AuditPage } from "./apps/clinic/Audit";
import { DemoGuide } from "./apps/DemoGuide";
import { NotFound } from "./pages/NotFound";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PlatformProvider>
      <I18nProvider>
        <HashRouter>
          <Routes>
            {/* Family app */}
            <Route element={<FamilyShell />}>
              <Route index element={<FamilySignIn />} />
              <Route path="my" element={<FamilyHome />} />
              <Route path="my/:clinicId/:refId" element={<FamilyReferralPage />} />
            </Route>
            {/* Clinic portal */}
            <Route path="clinic" element={<ClinicShell />}>
              <Route index element={<Navigate to="waitlist" replace />} />
              <Route path="waitlist" element={<Waitlist />} />
              <Route path="reports" element={<Reports />} />
              <Route path="data" element={<DataPage />} />
              <Route path="model" element={<ModelPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="audit" element={<AuditPage />} />
            </Route>
            <Route path="demo" element={<DemoGuide />} />
            {/* Old prototype links */}
            <Route path="staff/*" element={<Navigate to="/clinic" replace />} />
            <Route path="family/*" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
      </I18nProvider>
    </PlatformProvider>
  </StrictMode>,
);
