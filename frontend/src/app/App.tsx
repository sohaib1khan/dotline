import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppFrame } from "@/app/AppFrame";
import { Bootstrap } from "@/app/Bootstrap";
import { RequireAuth } from "@/app/RequireAuth";
import { AdminDashboardPage } from "@/pages/AdminDashboardPage";
import { AdminEmailSettingsPage } from "@/pages/AdminEmailSettingsPage";
import { AdminXpDebugPage } from "@/pages/AdminXpDebugPage";
import { BrailleLessonPage } from "@/pages/BrailleLessonPage";
import { BrailleTrackPage } from "@/pages/BrailleTrackPage";
import { CheckEmailPage } from "@/pages/CheckEmailPage";
import { EntryGatePage } from "@/pages/EntryGatePage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { InputDebugPage } from "@/pages/InputDebugPage";
import { LoginPage } from "@/pages/LoginPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SetupPage } from "@/pages/SetupPage";
import { SignupPage } from "@/pages/SignupPage";
import { StatusboardPage } from "@/pages/StatusboardPage";
import { StubPage } from "@/pages/StubPage";
import { TracksPage } from "@/pages/TracksPage";
import { VerifyEmailPage } from "@/pages/VerifyEmailPage";

export function App() {
  return (
    <BrowserRouter>
      <Bootstrap>
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
              <Route path="/app" element={<StatusboardPage />} />
              <Route path="/app/braille" element={<BrailleTrackPage />} />
              <Route path="/app/braille/lessons/:lessonId" element={<BrailleLessonPage />} />
              <Route
                path="/app/cursive"
                element={<StubPage title="Cursive" copy="Cursive lessons arrive in Phase 8." />}
              />
              <Route
                path="/app/games"
                element={<StubPage title="Games" copy="Games arrive in Phase 9." />}
              />
              <Route
                path="/app/progress"
                element={<StubPage title="Progress" copy="Progress page arrives in Phase 10." />}
              />
              <Route
                path="/app/inbox"
                element={<StubPage title="Inbox" copy="Inbox arrives in Phase 11." />}
              />
              <Route
                path="/app/report"
                element={<StubPage title="Report a Problem" copy="Bug reports arrive in Phase 11." />}
              />
              <Route path="/app/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route element={<RequireAuth role="admin" />}>
            <Route element={<AppFrame mode="admin" />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route
                path="/admin/monitoring"
                element={<StubPage title="Monitoring" copy="Monitoring arrives in Phase 13." />}
              />
              <Route
                path="/admin/users"
                element={<StubPage title="Users" copy="User admin arrives in Phase 12." />}
              />
              <Route
                path="/admin/content"
                element={<StubPage title="Content" copy="Content CMS arrives in Phase 12." />}
              />
              <Route
                path="/admin/bugs"
                element={<StubPage title="Bug Reports" copy="Bug queue arrives in Phase 12." />}
              />
              <Route
                path="/admin/announcements"
                element={<StubPage title="Announcements" copy="Announcements arrive in Phase 12." />}
              />
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
