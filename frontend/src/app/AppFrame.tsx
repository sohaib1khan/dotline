import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { AppNav } from "@/components/AppNav";
import { applyRoomTheme } from "@/store/room";

export function AppFrame({ mode }: { mode: "learner" | "admin" }) {
  useEffect(() => {
    const root = document.documentElement;
    if (mode === "admin") {
      root.dataset.shell = "admin";
      applyRoomTheme(null);
    } else {
      root.dataset.shell = "learner";
    }
    return () => {
      delete root.dataset.shell;
    };
  }, [mode]);

  return (
    <div className={`frame-shell${mode === "admin" ? " frame-shell-admin" : ""}`}>
      <AppNav mode={mode} />
      <div className="frame-main">
        <div className={`panel${mode === "admin" ? " panel-admin" : ""}`}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
