import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/milestone/DashboardPage";

export function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth allowedRoles={["teacher", "admin", "editor"]}>
            <DashboardPage />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
