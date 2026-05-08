import { Outlet, useLocation } from "react-router-dom";
import { ErrorBoundary } from "@/components/common/error-boundary";
import { MobileNavBar, Sidebar } from "./sidebar";

export function AppShell() {
  const location = useLocation();
  return (
    <div className="flex min-h-svh w-full bg-muted/40">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNavBar />
        <main className="flex-1 overflow-y-auto">
          {/* key=path forces a remount of the boundary on route change so a
              previous error does not stick when the user navigates away. */}
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
