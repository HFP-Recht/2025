import { useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import type { Course, CourseSubtopic } from "@hfp/content-schema";

interface CourseSidebarProps {
  course: Course;
  onNavigate: () => void;
}

const PAGE_LINKS = [
  { slug: "grundlagen", label: "Grundlagen" },
  { slug: "zusammenfassung", label: "Zusammenfassung" },
  { slug: "rechtsfaelle", label: "Rechtsfälle" },
  { slug: "mindmap", label: "Mindmap" }
] as const;

const SUBTOPICS_WITHOUT_MINDMAP = new Set([
  "70-vertragserfuellung",
  "80-allgemeine-geschaeftsbedingungen"
]);

export function CourseSidebar({ course, onNavigate }: CourseSidebarProps): JSX.Element {
  const { subtopicSlug } = useParams();
  const [expandedId, setExpandedId] = useState<string | null>(subtopicSlug ?? null);

  function toggleExpand(moduleId: string): void {
    setExpandedId(expandedId === moduleId ? null : moduleId);
  }

  return (
    <nav className="sidebar-nav">
      <NavLink
        to={`/course/${course.courseId}`}
        end
        className="sidebar-course-title"
        onClick={onNavigate}
      >
        {course.title}
      </NavLink>

      <ul className="sidebar-subtopic-list">
        {course.subtopics.map((subtopic) => (
          <SubtopicItem
            key={subtopic.moduleId}
            courseId={course.courseId}
            subtopic={subtopic}
            isExpanded={expandedId === subtopic.moduleId || subtopicSlug === subtopic.moduleId}
            onToggle={() => toggleExpand(subtopic.moduleId)}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </nav>
  );
}

function SubtopicItem({
  courseId,
  subtopic,
  isExpanded,
  onToggle,
  onNavigate
}: {
  courseId: string;
  subtopic: CourseSubtopic;
  isExpanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}): JSX.Element {
  const hasMindmap = !SUBTOPICS_WITHOUT_MINDMAP.has(subtopic.moduleId);
  const pages = hasMindmap ? PAGE_LINKS : PAGE_LINKS.filter((p) => p.slug !== "mindmap");

  return (
    <li className="sidebar-subtopic">
      <button
        type="button"
        className={`sidebar-subtopic-toggle ${isExpanded ? "expanded" : ""}`}
        onClick={onToggle}
      >
        <span className="sidebar-chevron">{isExpanded ? "\u25BE" : "\u25B8"}</span>
        {subtopic.title}
      </button>

      {isExpanded ? (
        <ul className="sidebar-page-list">
          {pages.map((page, i) => (
            <li key={page.slug}>
              <NavLink
                to={`/course/${courseId}/${subtopic.moduleId}/${page.slug}`}
                className={({ isActive }) =>
                  `sidebar-page-link ${isActive ? "active" : ""}`
                }
                onClick={onNavigate}
              >
                {String(i + 1).padStart(2, "0")} {page.label}
              </NavLink>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
