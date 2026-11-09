import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdminEmailSettingsPage } from "@/pages/AdminEmailSettingsPage";
import { HomePage } from "@/pages/HomePage";
import { SetupPage } from "@/pages/SetupPage";

export function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/admin/settings/email" element={<AdminEmailSettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
