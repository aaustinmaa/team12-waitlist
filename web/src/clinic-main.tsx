// Entry: the clinic portal (clinic/index.html).
import { HashRouter, Navigate, Route, Routes } from "react-router";
import { mount } from "./boot";
import { ClinicShell } from "./apps/clinic/ClinicShell";
import { Waitlist } from "./apps/clinic/Waitlist";
import { Reports } from "./apps/clinic/Reports";
import { DataPage } from "./apps/clinic/Data";
import { ModelPage } from "./apps/clinic/Model";
import { SettingsPage } from "./apps/clinic/Settings";
import { AuditPage } from "./apps/clinic/Audit";
import { NotFound } from "./pages/NotFound";

mount(
  <HashRouter>
    <Routes>
      <Route element={<ClinicShell />}>
        <Route index element={<Navigate to="waitlist" replace />} />
        <Route path="waitlist" element={<Waitlist />} />
        <Route path="reports" element={<Reports />} />
        <Route path="data" element={<DataPage />} />
        <Route path="model" element={<ModelPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  </HashRouter>,
);
