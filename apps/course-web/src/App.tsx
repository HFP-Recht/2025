import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth";
import { LoginPage } from "./pages/LoginPage";
import { EmbedFallbackPage } from "./pages/embed/EmbedFallbackPage";
import { ModulePlayerPage } from "./pages/ModulePlayerPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { CourseLayout } from "./pages/CourseLayout";
import { CourseHomePage } from "./pages/CourseHomePage";
import { SubtopicPageView } from "./pages/SubtopicPageView";

export function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/course/hfp-recht-modul1" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/embed/fallback" element={<EmbedFallbackPage />} />

      {/* Course routes */}
      <Route
        path="/course/:courseId"
        element={
          <RequireAuth allowedRoles={["student", "teacher", "admin", "editor"]}>
            <CourseLayout />
          </RequireAuth>
        }
      >
        <Route index element={<CourseHomePage />} />
        <Route path=":subtopicSlug" element={<Navigate to="grundlagen" replace />} />
        <Route path=":subtopicSlug/:pageSlug" element={<SubtopicPageView />} />
      </Route>

      {/* Legacy module routes (backwards compat) */}
      <Route
        path="/module/:moduleId"
        element={
          <RequireAuth allowedRoles={["student", "teacher", "admin", "editor"]}>
            <ModulePlayerPage />
          </RequireAuth>
        }
      />

      <Route
        path="/embed/module/:moduleId"
        element={
          <RequireAuth allowedRoles={["student", "teacher", "admin", "editor"]}>
            <ModulePlayerPage embedded />
          </RequireAuth>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
