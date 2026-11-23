// Entry: the family app (index.html).
import { HashRouter, Route, Routes } from "react-router";
import { mount } from "./boot";
import { FamilyShell } from "./apps/family/FamilyShell";
import { FamilySignIn } from "./apps/family/SignIn";
import { FamilyHome } from "./apps/family/Home";
import { FamilyReferralPage } from "./apps/family/ReferralPage";
import { NotFound } from "./pages/NotFound";

mount(
  <HashRouter>
    <Routes>
      <Route element={<FamilyShell />}>
        <Route index element={<FamilySignIn />} />
        <Route path="my" element={<FamilyHome />} />
        <Route path="my/:clinicId/:refId" element={<FamilyReferralPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  </HashRouter>,
  "family",
);
