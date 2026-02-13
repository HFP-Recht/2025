import { createContext, useContext, useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import type { Course } from "@hfp/content-schema";
import { loadCourse } from "../courseService";
import { CourseSidebar } from "./CourseSidebar";

interface CourseContextValue {
  course: Course;
}

const CourseContext = createContext<CourseContextValue | null>(null);

export function useCourse(): CourseContextValue {
  const value = useContext(CourseContext);
  if (!value) {
    throw new Error("useCourse must be used inside CourseLayout");
  }
  return value;
}

export function CourseLayout(): JSX.Element {
  const { courseId } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!courseId) {
    return <div className="page-state error">Missing course ID.</div>;
  }

  let course: Course;
  try {
    course = loadCourse(courseId);
  } catch {
    return <div className="page-state error">Course not found: {courseId}</div>;
  }

  return (
    <CourseContext.Provider value={{ course }}>
      <div className="course-shell">
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle sidebar"
        >
          {sidebarOpen ? "\u2715" : "\u2630"}
        </button>

        <aside className={`course-sidebar ${sidebarOpen ? "open" : ""}`}>
          <CourseSidebar
            course={course}
            onNavigate={() => setSidebarOpen(false)}
          />
        </aside>

        <main className="course-content">
          <Outlet />
        </main>
      </div>
    </CourseContext.Provider>
  );
}
