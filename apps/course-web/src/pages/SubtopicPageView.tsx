import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ModuleRenderer, type AttemptAnswers } from "@hfp/content-renderer";
import type { ModuleVersion } from "@hfp/content-schema";
import { useAuth } from "../auth";
import { loadCourseModule } from "../courseService";
import { getMyAttempt, saveAttempt } from "../firestoreApi";
import { useCourse } from "./CourseLayout";

const PAGE_SLUG_TO_INDEX: Record<string, number> = {
  grundlagen: 0,
  zusammenfassung: 1,
  rechtsfaelle: 2,
  mindmap: 3
};

const PAGE_SLUGS = ["grundlagen", "zusammenfassung", "rechtsfaelle", "mindmap"];

export function SubtopicPageView(): JSX.Element {
  const { courseId, subtopicSlug, pageSlug } = useParams();
  const { course } = useCourse();
  const { user, role, classIds } = useAuth();

  const [moduleVersion, setModuleVersion] = useState<ModuleVersion | null>(null);
  const [answers, setAnswers] = useState<AttemptAnswers>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [cloudDraftReady, setCloudDraftReady] = useState(false);

  const classId = classIds[0] ?? "";
  const moduleVersionId = moduleVersion
    ? `${moduleVersion.moduleId}_v${moduleVersion.version}`
    : "";

  const localStorageKey = useMemo(() => {
    const uid = user?.uid ?? "anonymous";
    return `attempt:${uid}:${subtopicSlug ?? "unknown"}:${moduleVersionId || "pending"}`;
  }, [subtopicSlug, moduleVersionId, user?.uid]);

  // Load module
  useEffect(() => {
    if (!subtopicSlug) {
      setError("Missing subtopic.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    loadCourseModule(subtopicSlug)
      .then((loaded) => setModuleVersion(loaded))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load module.")
      )
      .finally(() => setLoading(false));
  }, [subtopicSlug]);

  // Load local answers
  useEffect(() => {
    const raw = localStorage.getItem(localStorageKey);
    if (!raw) {
      setAnswers({});
      return;
    }
    try {
      setAnswers(JSON.parse(raw) as AttemptAnswers);
    } catch {
      setAnswers({});
    }
  }, [localStorageKey]);

  // Load cloud draft
  useEffect(() => {
    setCloudDraftReady(false);
    if (!moduleVersion || !user || role !== "student") {
      setCloudDraftReady(true);
      return;
    }

    let canceled = false;
    (async () => {
      try {
        const remote = await getMyAttempt(moduleVersion.moduleId, moduleVersionId);
        if (canceled) return;
        if (remote && Object.keys(remote.answers ?? {}).length > 0) {
          setAnswers((curr) => ({ ...remote.answers, ...curr }));
          setSaveStatus(
            remote.status === "submitted"
              ? "Loaded submitted answers."
              : "Loaded cloud draft."
          );
        }
      } catch {
        if (!canceled) setSaveStatus("Cloud draft unavailable.");
      } finally {
        if (!canceled) setCloudDraftReady(true);
      }
    })();
    return () => { canceled = true; };
  }, [moduleVersion, moduleVersionId, role, user]);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(localStorageKey, JSON.stringify(answers));
  }, [answers, localStorageKey]);

  // Autosave to Firestore
  useEffect(() => {
    if (!moduleVersion || !user || role !== "student" || !classId || !cloudDraftReady) {
      return;
    }
    const handle = window.setTimeout(async () => {
      try {
        setSaveStatus("Saving...");
        await saveAttempt({
          moduleId: moduleVersion.moduleId,
          moduleVersionId,
          classId,
          answers
        });
        setSaveStatus(`Saved ${new Date().toLocaleTimeString()}`);
      } catch {
        setSaveStatus("Autosave failed.");
      }
    }, 1000);
    return () => window.clearTimeout(handle);
  }, [answers, classId, cloudDraftReady, moduleVersion, moduleVersionId, role, user]);

  if (loading) {
    return <div className="page-state">Loading...</div>;
  }

  if (error || !moduleVersion) {
    return <div className="page-state error">{error || "Module not available."}</div>;
  }

  const lessonIndex = PAGE_SLUG_TO_INDEX[pageSlug ?? "grundlagen"] ?? 0;
  const lesson = moduleVersion.lessons[lessonIndex];

  if (!lesson) {
    return <div className="page-state error">Page not found.</div>;
  }

  // Create a filtered module with only the active lesson for the renderer
  const filteredModule: ModuleVersion = {
    ...moduleVersion,
    lessons: [lesson]
  };

  // Navigation
  const currentSubtopic = course.subtopics.find((s) => s.moduleId === subtopicSlug);
  const totalPages = moduleVersion.lessons.length;
  const prevSlug = lessonIndex > 0 ? PAGE_SLUGS[lessonIndex - 1] : null;
  const nextSlug = lessonIndex < totalPages - 1 ? PAGE_SLUGS[lessonIndex + 1] : null;

  return (
    <div className="subtopic-page">
      {saveStatus ? <div className="save-status">{saveStatus}</div> : null}

      <ModuleRenderer
        module={filteredModule}
        answers={answers}
        onAnswersChange={setAnswers}
        viewerRole={role ?? undefined}
        readOnly={role !== "student"}
        lessonLayout="stack"
      />

      <nav className="page-nav">
        {prevSlug ? (
          <Link
            to={`/course/${courseId}/${subtopicSlug}/${prevSlug}`}
            className="page-nav-btn"
          >
            Zurück
          </Link>
        ) : (
          <span />
        )}
        <span className="page-nav-label">
          {currentSubtopic?.title} — {lesson.title}
        </span>
        {nextSlug ? (
          <Link
            to={`/course/${courseId}/${subtopicSlug}/${nextSlug}`}
            className="page-nav-btn"
          >
            Weiter
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
