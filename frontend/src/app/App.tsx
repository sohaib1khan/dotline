import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppFrame } from "@/app/AppFrame";
import { Bootstrap } from "@/app/Bootstrap";
import { RequireAuth } from "@/app/RequireAuth";
import { HeartbeatBridge } from "@/components/HeartbeatBridge";
import { TelemetryBridge } from "@/components/TelemetryBridge";
import { AdminAnnouncementsPage } from "@/pages/AdminAnnouncementsPage";
import { AdminBugsPage } from "@/pages/AdminBugsPage";
import { AdminContentPage } from "@/pages/AdminContentPage";
import { AdminDashboardPage } from "@/pages/AdminDashboardPage";
import { AdminEmailSettingsPage } from "@/pages/AdminEmailSettingsPage";
import { AdminLoginLogPage } from "@/pages/AdminLoginLogPage";
import { AdminMonitoringPage } from "@/pages/AdminMonitoringPage";
import { AdminSettingsHubPage } from "@/pages/AdminSettingsHubPage";
import { AdminUsersPage } from "@/pages/AdminUsersPage";
import { AdminXpDebugPage } from "@/pages/AdminXpDebugPage";
import { BrailleLessonPage } from "@/pages/BrailleLessonPage";
import { BrailleTrackPage } from "@/pages/BrailleTrackPage";
import { CheckEmailPage } from "@/pages/CheckEmailPage";
import { CursiveLessonPage } from "@/pages/CursiveLessonPage";
import { CursiveTrackPage } from "@/pages/CursiveTrackPage";
import { DoorChooserPage } from "@/pages/DoorChooserPage";
import { EntryGatePage } from "@/pages/EntryGatePage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { GamePlayPage } from "@/pages/GamePlayPage";
import { GamesPage } from "@/pages/GamesPage";
import { InboxPage } from "@/pages/InboxPage";
import { InputDebugPage } from "@/pages/InputDebugPage";
import { LoginPage } from "@/pages/LoginPage";
import { ProgressPage } from "@/pages/ProgressPage";
import { ReportProblemPage } from "@/pages/ReportProblemPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { RoomStatusboardPage } from "@/pages/RoomStatusboardPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SetupPage } from "@/pages/SetupPage";
import { SignupPage } from "@/pages/SignupPage";
import { SignatureStudioPage } from "@/pages/SignatureStudioPage";
import { TracksPage } from "@/pages/TracksPage";
import { VerifyEmailPage } from "@/pages/VerifyEmailPage";

export function App() {
  return (
    <BrowserRouter>
      <Bootstrap>
        <TelemetryBridge />
        <HeartbeatBridge />
        <Routes>
          <Route path="/" element={<EntryGatePage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/check-email" element={<CheckEmailPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/tracks" element={<TracksPage />} />
            <Route element={<AppFrame mode="learner" />}>
              <Route path="/app" element={<DoorChooserPage />} />
              <Route path="/app/rooms/:track" element={<RoomStatusboardPage />} />
              <Route path="/app/braille" element={<BrailleTrackPage />} />
              <Route path="/app/braille/lessons/:lessonId" element={<BrailleLessonPage />} />
              <Route path="/app/cursive" element={<CursiveTrackPage />} />
              <Route path="/app/cursive/lessons/:lessonId" element={<CursiveLessonPage />} />
              <Route path="/app/cursive/signature" element={<SignatureStudioPage />} />
              <Route path="/app/games" element={<GamesPage />} />
              <Route path="/app/games/:gameKey" element={<GamePlayPage />} />
              <Route path="/app/progress" element={<ProgressPage />} />
              <Route path="/app/inbox" element={<InboxPage />} />
              <Route path="/app/report" element={<ReportProblemPage />} />
              <Route path="/app/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route element={<RequireAuth role="admin" />}>
            <Route element={<AppFrame mode="admin" />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/monitoring" element={<AdminMonitoringPage />} />
              <Route path="/admin/monitoring/logins" element={<AdminLoginLogPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/content" element={<AdminContentPage />} />
              <Route path="/admin/bugs" element={<AdminBugsPage />} />
              <Route path="/admin/announcements" element={<AdminAnnouncementsPage />} />
              <Route path="/admin/settings" element={<AdminSettingsHubPage />} />
              <Route path="/admin/settings/email" element={<AdminEmailSettingsPage />} />
              <Route path="/admin/debug/input" element={<InputDebugPage />} />
              <Route path="/admin/debug/xp" element={<AdminXpDebugPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Bootstrap>
    </BrowserRouter>
  );
}
