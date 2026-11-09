import { Outlet } from "react-router-dom";
import { AppNav } from "@/components/AppNav";

export function AppFrame({ mode }: { mode: "learner" | "admin" }) {
  return (
    <div className="frame-shell">
      <AppNav mode={mode} />
      <div className="frame-main">
        <div className="panel">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
