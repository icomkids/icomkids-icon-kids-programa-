import { Navigate, useLocation } from "react-router-dom";
import { isAuthenticated, useAuth } from "./auth-context";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Carregando sessao...
      </div>
    );
  }

  if (!isAuthenticated(auth)) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
