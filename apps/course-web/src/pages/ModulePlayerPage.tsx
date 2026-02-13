import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ModuleRenderer, type AttemptAnswers } from "@hfp/content-renderer";
import type { ModuleVersion } from "@hfp/content-schema";
import { useAuth } from "../auth";
import { loadModule } from "../moduleService";
import { getMyAttempt, saveAttempt, submitModule, trackSessionEvent } from "../firestoreApi";
import { EmbedFallbackPage } from "./embed/EmbedFallbackPage";

interface ModulePlayerPageProps {
  embedded?: boolean;
}

export function ModulePlayerPage({ embedded = false }: ModulePlayerPageProps): JSX.Element {
  const { moduleId } = useParams();
  const location = useLocation();
  const { user, role, classIds, signOutUser } = useAuth();
  const navigate = useNavigate();

  const [moduleVersion, setModuleVersion] = useState<ModuleVersion | null>(null);
  const [answers, setAnswers] = useState<AttemptAnswers>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [submitStatus, setSubmitStatus] = useState("");
  const [cloudDraftReady, setCloudDraftReady] = useState(false);

  const classId = classIds[0] ?? "";
  const moduleVersionId = moduleVersion ? `${moduleVersion.moduleId}_v${moduleVersion.version}` : "";
  const openEventKeyRef = useRef("");

  const iframeSession = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  const sessionOrigin = useMemo(() => {
    const queryOrigin = new URLSearchParams(location.search).get("origin");
    if (queryOrigin && queryOrigin.trim().length > 0) {
      return queryOrigin.trim();
    }
    return embedded || iframeSession ? "iframe" : "direct";
  }, [embedded, iframeSession, location.search]);

  const localStorageKey = useMemo(() => {
    const uid = user?.uid ?? "anonymous";
    return `attempt:${uid}:${moduleId ?? "unknown"}:${moduleVersionId || "pending"}`;
  }, [moduleId, moduleVersionId, user?.uid]);

  useEffect(() => {
    if (!moduleId) {
      setError("Missing module id.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    loadModule(moduleId)
      .then((loadedModule) => {
        setModuleVersion(loadedModule);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Could not load module.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [moduleId]);

  useEffect(() => {
    const raw = localStorage.getItem(localStorageKey);
    if (!raw) {
      setAnswers({});
      return;
    }

    try {
      const parsed = JSON.parse(raw) as AttemptAnswers;
      setAnswers(parsed);
    } catch {
      setAnswers({});
    }
  }, [localStorageKey]);

  useEffect(() => {
    setCloudDraftReady(false);

    if (!moduleVersion || !user || role !== "student") {
      setCloudDraftReady(true);
      return;
    }

    let canceled = false;

    const run = async (): Promise<void> => {
      try {
        const remoteAttempt = await getMyAttempt(moduleVersion.moduleId, moduleVersionId);
        if (canceled) {
          return;
        }

        if (remoteAttempt && Object.keys(remoteAttempt.answers ?? {}).length > 0) {
          setAnswers((current) => ({
            ...remoteAttempt.answers,
            ...current
          }));

          setSaveStatus(
            remoteAttempt.status === "submitted"
              ? "Loaded submitted answers from cloud."
              : "Loaded cloud draft."
          );
        }
      } catch {
        if (!canceled) {
          setSaveStatus("Cloud draft unavailable. Working from local data.");
        }
      } finally {
        if (!canceled) {
          setCloudDraftReady(true);
        }
      }
    };

    run();

    return () => {
      canceled = true;
    };
  }, [moduleVersion, moduleVersionId, role, user]);

  useEffect(() => {
    localStorage.setItem(localStorageKey, JSON.stringify(answers));
  }, [answers, localStorageKey]);

  useEffect(() => {
    if (!moduleVersion || !user || role !== "student" || !classId || !cloudDraftReady) {
      return;
    }

    const handle = window.setTimeout(async () => {
      try {
        setSaveStatus("Saving attempt...");
        await saveAttempt({
          moduleId: moduleVersion.moduleId,
          moduleVersionId,
          classId,
          answers
        });
        setSaveStatus(`Saved ${new Date().toLocaleTimeString()}`);
      } catch {
        setSaveStatus("Autosave failed. Changes remain local.");
      }
    }, 1000);

    return () => {
      window.clearTimeout(handle);
    };
  }, [answers, classId, cloudDraftReady, moduleVersion, moduleVersionId, role, user]);

  useEffect(() => {
    if (!moduleVersion || !moduleVersionId || !user || !role) {
      return;
    }

    const eventType = embedded || iframeSession ? "embed_open" : "module_open";
    const eventKey = `${user.uid}:${moduleVersionId}:${eventType}`;
    if (openEventKeyRef.current === eventKey) {
      return;
    }

    openEventKeyRef.current = eventKey;
    void trackSessionEvent({
      moduleId: moduleVersion.moduleId,
      moduleVersionId,
      classId: classId || undefined,
      eventType,
      origin: sessionOrigin
    }).catch(() => undefined);
  }, [
    classId,
    embedded,
    iframeSession,
    moduleVersion,
    moduleVersionId,
    role,
    sessionOrigin,
    user
  ]);

  async function handleSubmit(): Promise<void> {
    if (!moduleVersion || !classId) {
      setSubmitStatus("Class assignment missing. Contact admin.");
      return;
    }

    try {
      const submissionId = await submitModule({
        moduleId: moduleVersion.moduleId,
        moduleVersionId,
        classId,
        answers
      });
      await trackSessionEvent({
        moduleId: moduleVersion.moduleId,
        moduleVersionId,
        classId,
        eventType: "module_submit",
        origin: sessionOrigin
      }).catch(() => undefined);
      setSubmitStatus(`Submitted successfully (${submissionId}).`);
    } catch {
      setSubmitStatus("Submission failed.");
    }
  }

  async function handleSignOut(): Promise<void> {
    await signOutUser();
    navigate("/login", { replace: true });
  }

  if (loading) {
    return <div className="page-state">Loading module...</div>;
  }

  if (error || !moduleVersion) {
    if (embedded) {
      return (
        <EmbedFallbackPage
          moduleId={moduleId}
          reason={error ? "module-load-error" : "module-not-available"}
        />
      );
    }

    return <div className="page-state error">{error || "Module not available."}</div>;
  }

  return (
    <main
      className={embedded ? "module-page embedded" : "module-page"}
      data-session-origin={sessionOrigin}
    >
      <header className="module-header">
        <div>
          <h1>{moduleVersion.title}</h1>
          <p>{moduleVersion.description}</p>
          <p className="module-meta">
            Version {moduleVersion.version} - Role: {role ?? "unknown"}
          </p>
        </div>

        {!embedded ? (
          <button className="secondary-btn" type="button" onClick={handleSignOut}>
            Sign out
          </button>
        ) : null}
      </header>

      <section className="status-strip">
        <span>Session origin: {sessionOrigin}</span>
        <span>{saveStatus}</span>
        <span>{submitStatus}</span>
      </section>

      <ModuleRenderer
        module={moduleVersion}
        answers={answers}
        onAnswersChange={setAnswers}
        viewerRole={role ?? undefined}
        readOnly={role !== "student"}
        lessonLayout="tabs"
      />

      {role === "student" ? (
        <footer className="module-footer">
          <button className="primary-btn" type="button" onClick={handleSubmit}>
            Submit module
          </button>
        </footer>
      ) : (
        <footer className="module-footer">
          <p>Read-only mode for reviewer roles.</p>
        </footer>
      )}
    </main>
  );
}
