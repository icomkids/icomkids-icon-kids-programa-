import { Outlet } from "react-router-dom";
import { MobileNavBar, Sidebar } from "./sidebar";

export function AppShell() {
  return (
    <div className="flex min-h-svh w-full bg-muted/40">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNavBar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
