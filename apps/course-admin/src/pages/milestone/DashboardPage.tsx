import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth";
import {
  assignUserRole,
  createStudentAccessKey,
  exportClassCsv,
  generateModuleDraft,
  getClassSubmissions,
  getModuleVersionDetail,
  getPilotMetrics,
  getSubmissionDetail,
  listReviewQueue,
  listSourceDocuments,
  publishModuleVersion,
  updateModuleReviewStatus,
  upsertSourceDocument,
  type DraftGenerationResult,
  type ModuleVersionDetail,
  type PilotMetrics,
  type ReviewQueueItem,
  type SubmissionAnswerValue,
  type SubmissionDetail,
  type SubmissionSummary,
  type SourceDocumentSummary,
  type ValidationIssue
} from "../../services/firestoreApi";

export function DashboardPage(): JSX.Element {
  const { role, classIds, signOutUser } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState("");

  const [classId, setClassId] = useState(classIds[0] ?? "");
  const [moduleIdFilter, setModuleIdFilter] = useState("");
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionDetail | null>(null);
  const [submissionDetailLoading, setSubmissionDetailLoading] = useState(false);

  const [targetUid, setTargetUid] = useState("");
  const [targetRole, setTargetRole] = useState<"student" | "teacher" | "admin" | "editor">("student");
  const [targetClassIds, setTargetClassIds] = useState("");

  const [accessKeyClassId, setAccessKeyClassId] = useState(classIds[0] ?? "PK25A");
  const [accessKeyMaxUses, setAccessKeyMaxUses] = useState("30");
  const [accessKeyExpiresDays, setAccessKeyExpiresDays] = useState("120");
  const [accessKeyNote, setAccessKeyNote] = useState("");
  const [generatedStudentAccessKey, setGeneratedStudentAccessKey] = useState("");

  const [publishModuleId, setPublishModuleId] = useState("");
  const [publishVersionId, setPublishVersionId] = useState("");

  const [sourceDocumentId, setSourceDocumentId] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceContent, setSourceContent] = useState("");
  const [sourceTags, setSourceTags] = useState("");
  const [sourceReplaceExisting, setSourceReplaceExisting] = useState(false);
  const [sources, setSources] = useState<SourceDocumentSummary[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);

  const [draftModuleId, setDraftModuleId] = useState("pilot-vertragsrecht");
  const [draftTitle, setDraftTitle] = useState("Pilotmodul Vertragsrecht");
  const [draftDescription, setDraftDescription] = useState(
    "Pilotmodul fuer die erste produktive AI-gestuetzte Auslieferung im neuen Review-Workflow."
  );
  const [draftOutcomes, setDraftOutcomes] = useState(
    [
      "Die Lernenden erklaeren den Vertragsabschluss nach OR Art. 1.",
      "Die Lernenden pruefen Formvorschriften und gueltige Vertragsinhalte.",
      "Die Lernenden wenden die 4-Schritt-Fallanalyse auf Werkstattfaelle an."
    ].join("\n")
  );
  const [manualSourceIds, setManualSourceIds] = useState("");
  const [generatedDraft, setGeneratedDraft] = useState<DraftGenerationResult | null>(null);

  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [selectedModuleVersion, setSelectedModuleVersion] = useState<ModuleVersionDetail | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const [metricsModuleId, setMetricsModuleId] = useState("pilot-vertragsrecht");
  const [metricsClassId, setMetricsClassId] = useState(classIds[0] ?? "");
  const [pilotMetrics, setPilotMetrics] = useState<PilotMetrics | null>(null);

  const canManageRoles = role === "admin";
  const canEditPipeline = role === "admin" || role === "editor";
  const classScopeHint = useMemo(() => classIds.join(", "), [classIds]);

  async function handleLoadSubmissions(): Promise<void> {
    if (!classId.trim()) {
      setStatus("Class ID is required.");
      return;
    }

    try {
      setStatus("Loading submissions...");
      const records = await getClassSubmissions(classId.trim(), moduleIdFilter.trim() || undefined);
      setSubmissions(records);
      setSelectedSubmission(null);
      setStatus(`Loaded ${records.length} submissions.`);
    } catch {
      setStatus("Could not load submissions.");
    }
  }

  async function handleViewSubmission(submissionId: string): Promise<void> {
    try {
      setSubmissionDetailLoading(true);
      setStatus("Loading submission detail...");
      const detail = await getSubmissionDetail(submissionId);
      setSelectedSubmission(detail);
      setStatus(`Loaded submission ${submissionId}.`);
    } catch {
      setStatus("Could not load submission detail.");
    } finally {
      setSubmissionDetailLoading(false);
    }
  }

  async function handleExportCsv(): Promise<void> {
    if (!classId.trim()) {
      setStatus("Class ID is required for export.");
      return;
    }

    try {
      setStatus("Generating CSV export...");
      const { csv } = await exportClassCsv(classId.trim(), moduleIdFilter.trim() || undefined);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${classId.trim()}-submissions.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStatus("CSV export downloaded.");
    } catch {
      setStatus("CSV export failed.");
    }
  }

  async function handleAssignRole(): Promise<void> {
    if (!targetUid.trim()) {
      setStatus("Target UID is required.");
      return;
    }

    try {
      const parsedClassIds = targetClassIds
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);

      await assignUserRole(targetUid.trim(), targetRole, parsedClassIds);
      setStatus("Role assignment updated.");
    } catch {
      setStatus("Role assignment failed.");
    }
  }

  async function handleCreateStudentAccessKey(): Promise<void> {
    if (!accessKeyClassId.trim()) {
      setStatus("Class ID is required to create a student access key.");
      return;
    }

    const maxUses = Number.parseInt(accessKeyMaxUses, 10);
    const expiresInDays = Number.parseInt(accessKeyExpiresDays, 10);

    if (!Number.isFinite(maxUses) || maxUses <= 0) {
      setStatus("Max uses must be a positive number.");
      return;
    }

    if (!Number.isFinite(expiresInDays) || expiresInDays <= 0) {
      setStatus("Expires in days must be a positive number.");
      return;
    }

    try {
      setStatus("Creating student access key...");
      const result = await createStudentAccessKey({
        classId: accessKeyClassId.trim(),
        maxUses,
        expiresInDays,
        note: accessKeyNote.trim() || undefined
      });

      setGeneratedStudentAccessKey(result.accessKey);
      setStatus(
        `Student access key created for class ${result.classId} (max uses: ${result.maxUses}, expires: ${result.expiresAt}).`
      );
    } catch {
      setStatus("Could not create student access key.");
    }
  }

  async function handlePublish(): Promise<void> {
    if (!publishModuleId.trim() || !publishVersionId.trim()) {
      setStatus("Module ID and version ID are required.");
      return;
    }

    try {
      await publishModuleVersion(publishModuleId.trim(), publishVersionId.trim());
      setStatus("Module version published.");
    } catch {
      setStatus("Publish action failed. Ensure the version is approved first.");
    }
  }

  async function handleLoadSources(): Promise<void> {
    try {
      setStatus("Loading source documents...");
      const records = await listSourceDocuments();
      setSources(records);
      setStatus(`Loaded ${records.length} source documents.`);
    } catch {
      setStatus("Could not load source documents.");
    }
  }

  async function handleUpsertSourceDocument(): Promise<void> {
    if (!canEditPipeline) {
      setStatus("Only admin/editor can modify source documents.");
      return;
    }

    if (!sourceDocumentId.trim() || !sourceTitle.trim() || !sourceContent.trim()) {
      setStatus("Source ID, title, and content are required.");
      return;
    }

    try {
      setStatus("Saving source document...");
      const result = await upsertSourceDocument({
        sourceDocumentId: sourceDocumentId.trim(),
        title: sourceTitle.trim(),
        content: sourceContent,
        tags: sourceTags
          .split(",")
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0),
        replaceExisting: sourceReplaceExisting
      });

      setStatus(
        `Source document ${result.sourceDocumentId} saved (${result.chunkCount} chunks, checksum ${result.checksum.slice(0, 12)}...).`
      );
      await handleLoadSources();
    } catch {
      setStatus("Could not save source document.");
    }
  }

  function toggleSourceSelection(sourceId: string): void {
    setSelectedSourceIds((current) =>
      current.includes(sourceId)
        ? current.filter((entry) => entry !== sourceId)
        : [...current, sourceId]
    );
  }

  async function handleGenerateDraft(): Promise<void> {
    if (!canEditPipeline) {
      setStatus("Only admin/editor can generate drafts.");
      return;
    }

    if (!draftModuleId.trim() || !draftTitle.trim() || !draftDescription.trim()) {
      setStatus("Module ID, title, and description are required for generation.");
      return;
    }

    const outcomes = draftOutcomes
      .split("\n")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    if (outcomes.length === 0) {
      setStatus("At least one learning outcome is required.");
      return;
    }

    const manualIds = manualSourceIds
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    const sourceDocumentIds = selectedSourceIds.length > 0 ? selectedSourceIds : manualIds;

    if (sourceDocumentIds.length === 0) {
      setStatus("Select source documents or provide manual source IDs.");
      return;
    }

    try {
      setStatus("Generating module draft...");
      const result = await generateModuleDraft({
        moduleId: draftModuleId.trim(),
        title: draftTitle.trim(),
        description: draftDescription.trim(),
        outcomes,
        sourceDocumentIds
      });

      setGeneratedDraft(result);
      setPublishModuleId(result.moduleId);
      setPublishVersionId(result.moduleVersionId);
      setStatus(
        `Draft generated: ${result.moduleVersionId} (errors: ${result.validationSummary.errorCount}, warnings: ${result.validationSummary.warningCount}).`
      );
      await handleLoadReviewQueue();
    } catch {
      setStatus("Draft generation failed.");
    }
  }

  async function handleLoadReviewQueue(): Promise<void> {
    try {
      setStatus("Loading review queue...");
      const records = await listReviewQueue();
      setReviewQueue(records);
      setStatus(`Loaded ${records.length} module versions in review queue.`);
    } catch {
      setStatus("Could not load review queue.");
    }
  }

  async function handleOpenModuleVersion(moduleVersionId: string): Promise<void> {
    try {
      setStatus("Loading module version detail...");
      const detail = await getModuleVersionDetail(moduleVersionId);
      setSelectedModuleVersion(detail);
      setPublishModuleId(detail.moduleId);
      setPublishVersionId(detail.moduleVersionId);
      setStatus(`Loaded ${moduleVersionId}.`);
    } catch {
      setStatus("Could not load module version detail.");
    }
  }

  async function handleReviewTransition(nextStatus: "draft" | "review" | "approved"): Promise<void> {
    if (!selectedModuleVersion) {
      setStatus("Select a module version first.");
      return;
    }

    try {
      setStatus(`Updating status to ${nextStatus}...`);
      await updateModuleReviewStatus(
        selectedModuleVersion.moduleVersionId,
        nextStatus,
        reviewNote.trim() || undefined
      );

      const refreshed = await getModuleVersionDetail(selectedModuleVersion.moduleVersionId);
      setSelectedModuleVersion(refreshed);
      await handleLoadReviewQueue();
      setStatus(`Status updated to ${nextStatus}.`);
    } catch {
      setStatus(`Could not set status to ${nextStatus}.`);
    }
  }

  async function handlePublishSelected(): Promise<void> {
    if (!selectedModuleVersion) {
      setStatus("Select a module version first.");
      return;
    }

    try {
      await publishModuleVersion(selectedModuleVersion.moduleId, selectedModuleVersion.moduleVersionId);
      const refreshed = await getModuleVersionDetail(selectedModuleVersion.moduleVersionId);
      setSelectedModuleVersion(refreshed);
      await handleLoadReviewQueue();
      setStatus(`Published ${selectedModuleVersion.moduleVersionId}.`);
    } catch {
      setStatus("Publish failed. Version must be in approved status.");
    }
  }

  async function handleLoadPilotMetrics(): Promise<void> {
    if (!metricsModuleId.trim()) {
      setStatus("Pilot metrics require a module ID.");
      return;
    }

    try {
      setStatus("Loading pilot metrics...");
      const metrics = await getPilotMetrics(metricsModuleId.trim(), metricsClassId.trim() || undefined);
      setPilotMetrics(metrics);
      setStatus("Pilot metrics loaded.");
    } catch {
      setStatus("Could not load pilot metrics.");
    }
  }

  async function handleSignOut(): Promise<void> {
    await signOutUser();
    navigate("/login", { replace: true });
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1>Course Admin Dashboard</h1>
          <p>Role: {role ?? "unknown"}</p>
          <p>Class scope: {classScopeHint || "none"}</p>
        </div>
        <button type="button" className="secondary-btn" onClick={handleSignOut}>
          Sign out
        </button>
      </header>

      <section className="panel">
        <h2>Source documents (Milestone 6)</h2>
        <div className="row-actions">
          <button type="button" className="secondary-btn" onClick={handleLoadSources}>
            Load source docs
          </button>
        </div>

        <div className="table-wrap compact-table">
          <table>
            <thead>
              <tr>
                <th>Use</th>
                <th>Source ID</th>
                <th>Title</th>
                <th>Chunks</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.sourceDocumentId}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedSourceIds.includes(source.sourceDocumentId)}
                      onChange={() => toggleSourceSelection(source.sourceDocumentId)}
                    />
                  </td>
                  <td>{source.sourceDocumentId}</td>
                  <td>{source.title}</td>
                  <td>{source.chunkCount}</td>
                  <td>{source.updatedAt || "-"}</td>
                </tr>
              ))}
              {sources.length === 0 ? (
                <tr>
                  <td colSpan={5}>No source documents loaded.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {canEditPipeline ? (
          <div className="stack-section">
            <h3>Upsert source document</h3>
            <div className="grid two-col">
              <label>
                Source ID
                <input
                  value={sourceDocumentId}
                  onChange={(event) => setSourceDocumentId(event.target.value)}
                  placeholder="source_vertragsrecht_01"
                />
              </label>

              <label>
                Title
                <input
                  value={sourceTitle}
                  onChange={(event) => setSourceTitle(event.target.value)}
                  placeholder="Vertragsrecht Grundlagen"
                />
              </label>

              <label className="full-width">
                Tags (comma-separated)
                <input
                  value={sourceTags}
                  onChange={(event) => setSourceTags(event.target.value)}
                  placeholder="vertrag,grundlagen,pilot"
                />
              </label>

              <label className="full-width">
                Source content
                <textarea
                  rows={8}
                  value={sourceContent}
                  onChange={(event) => setSourceContent(event.target.value)}
                  placeholder="Paste canonical source text here..."
                />
              </label>

              <label className="inline-checkbox full-width">
                <input
                  type="checkbox"
                  checked={sourceReplaceExisting}
                  onChange={(event) => setSourceReplaceExisting(event.target.checked)}
                />
                Replace existing source if ID already exists
              </label>
            </div>

            <button type="button" className="primary-btn" onClick={handleUpsertSourceDocument}>
              Save source document
            </button>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>Draft generation (Milestone 6)</h2>
        <div className="grid two-col">
          <label>
            Module ID
            <input value={draftModuleId} onChange={(event) => setDraftModuleId(event.target.value)} />
          </label>

          <label>
            Module title
            <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
          </label>

          <label className="full-width">
            Description
            <textarea
              rows={3}
              value={draftDescription}
              onChange={(event) => setDraftDescription(event.target.value)}
            />
          </label>

          <label className="full-width">
            Outcomes (one per line)
            <textarea
              rows={5}
              value={draftOutcomes}
              onChange={(event) => setDraftOutcomes(event.target.value)}
            />
          </label>

          <label className="full-width">
            Manual source IDs (comma-separated fallback)
            <input
              value={manualSourceIds}
              onChange={(event) => setManualSourceIds(event.target.value)}
              placeholder="source_1,source_2"
            />
          </label>
        </div>

        <div className="row-actions">
          <button type="button" className="primary-btn" onClick={handleGenerateDraft} disabled={!canEditPipeline}>
            Generate draft
          </button>
          <button type="button" className="secondary-btn" onClick={handleLoadReviewQueue}>
            Load review queue
          </button>
        </div>

        {generatedDraft ? (
          <div className="generated-key-box">
            <p>
              Draft created: <strong>{generatedDraft.moduleVersionId}</strong>
            </p>
            <p>
              Validation - errors: {generatedDraft.validationSummary.errorCount}, warnings: {" "}
              {generatedDraft.validationSummary.warningCount}
            </p>
            <details>
              <summary>Prompt bundle preview</summary>
              <pre>{JSON.stringify(generatedDraft.promptBundle, null, 2)}</pre>
            </details>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>Review queue (Milestone 6)</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Version ID</th>
                <th>Module</th>
                <th>Status</th>
                <th>Errors</th>
                <th>Warnings</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviewQueue.map((entry) => (
                <tr key={entry.moduleVersionId}>
                  <td>{entry.moduleVersionId}</td>
                  <td>
                    {entry.title}
                    <div className="micro-text">{entry.moduleId}</div>
                  </td>
                  <td>
                    <span className={`status-chip status-${entry.status}`}>{entry.status}</span>
                  </td>
                  <td>{entry.errorCount}</td>
                  <td>{entry.warningCount}</td>
                  <td>{entry.updatedAt || "-"}</td>
                  <td>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => handleOpenModuleVersion(entry.moduleVersionId)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
              {reviewQueue.length === 0 ? (
                <tr>
                  <td colSpan={7}>No items in review queue.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {selectedModuleVersion ? (
          <div className="stack-section">
            <h3>Selected module version</h3>
            <div className="submission-detail-meta">
              <p>
                <strong>Version:</strong> {selectedModuleVersion.moduleVersionId}
              </p>
              <p>
                <strong>Module:</strong> {selectedModuleVersion.moduleId}
              </p>
              <p>
                <strong>Status:</strong> {selectedModuleVersion.status}
              </p>
              <p>
                <strong>Errors:</strong> {selectedModuleVersion.validationSummary.errorCount}
              </p>
              <p>
                <strong>Warnings:</strong> {selectedModuleVersion.validationSummary.warningCount}
              </p>
              <p>
                <strong>Updated:</strong> {selectedModuleVersion.updatedAt || "-"}
              </p>
            </div>

            <label>
              Review note (optional)
              <textarea rows={3} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} />
            </label>

            <div className="row-actions">
              <button type="button" className="secondary-btn" onClick={() => handleReviewTransition("review")}>
                Move to review
              </button>
              <button type="button" className="secondary-btn" onClick={() => handleReviewTransition("draft")}>
                Move to draft
              </button>
              <button type="button" className="primary-btn" onClick={() => handleReviewTransition("approved")}>
                Approve
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={handlePublishSelected}
                disabled={role !== "admin"}
              >
                Publish
              </button>
            </div>

            <ValidationIssueList issues={selectedModuleVersion.validationIssues} />

            <details className="json-preview">
              <summary>Show module JSON</summary>
              <pre>{JSON.stringify(selectedModuleVersion.content, null, 2)}</pre>
            </details>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>Pilot metrics (Milestone 8)</h2>
        <div className="grid two-col">
          <label>
            Module ID
            <input value={metricsModuleId} onChange={(event) => setMetricsModuleId(event.target.value)} />
          </label>
          <label>
            Class ID (optional)
            <input value={metricsClassId} onChange={(event) => setMetricsClassId(event.target.value)} />
          </label>
        </div>

        <div className="row-actions">
          <button type="button" className="secondary-btn" onClick={handleLoadPilotMetrics}>
            Load pilot metrics
          </button>
        </div>

        {pilotMetrics ? (
          <div className="submission-detail-meta">
            <p>
              <strong>Open events:</strong> {pilotMetrics.openEvents}
            </p>
            <p>
              <strong>Iframe opens:</strong> {pilotMetrics.iframeOpenEvents}
            </p>
            <p>
              <strong>Submit events:</strong> {pilotMetrics.submitEvents}
            </p>
            <p>
              <strong>Submissions:</strong> {pilotMetrics.submissions}
            </p>
            <p>
              <strong>Unique open users:</strong> {pilotMetrics.uniqueOpenUsers}
            </p>
            <p>
              <strong>Unique submission users:</strong> {pilotMetrics.uniqueSubmissionUsers}
            </p>
            <p>
              <strong>Completion rate:</strong> {(pilotMetrics.completionRate * 100).toFixed(1)}%
            </p>
            <p>
              <strong>Last submission:</strong> {pilotMetrics.latestSubmissionAt || "-"}
            </p>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2>Class submissions</h2>
        <div className="grid two-col">
          <label>
            Class ID
            <input value={classId} onChange={(event) => setClassId(event.target.value)} />
          </label>

          <label>
            Module filter (optional)
            <input
              value={moduleIdFilter}
              onChange={(event) => setModuleIdFilter(event.target.value)}
            />
          </label>
        </div>

        <div className="row-actions">
          <button type="button" className="primary-btn" onClick={handleLoadSubmissions}>
            Load submissions
          </button>
          <button type="button" className="secondary-btn" onClick={handleExportCsv}>
            Export CSV
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Submission ID</th>
                <th>Student UID</th>
                <th>Module</th>
                <th>Version</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((entry) => (
                <tr key={entry.submissionId}>
                  <td>{entry.submissionId}</td>
                  <td>{entry.ownerUid}</td>
                  <td>{entry.moduleId}</td>
                  <td>{entry.moduleVersionId}</td>
                  <td>{entry.submittedAt}</td>
                  <td>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => handleViewSubmission(entry.submissionId)}
                      disabled={submissionDetailLoading}
                    >
                      View answers
                    </button>
                  </td>
                </tr>
              ))}
              {submissions.length === 0 ? (
                <tr>
                  <td colSpan={6}>No submissions loaded.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {selectedSubmission ? (
        <section className="panel">
          <h2>Submission detail</h2>
          <div className="submission-detail-meta">
            <p>
              <strong>Submission:</strong> {selectedSubmission.submissionId}
            </p>
            <p>
              <strong>Student UID:</strong> {selectedSubmission.ownerUid}
            </p>
            <p>
              <strong>Class:</strong> {selectedSubmission.classId}
            </p>
            <p>
              <strong>Module:</strong> {selectedSubmission.moduleId}
            </p>
            <p>
              <strong>Version:</strong> {selectedSubmission.moduleVersionId}
            </p>
            <p>
              <strong>Submitted:</strong> {selectedSubmission.submittedAt}
            </p>
          </div>

          <div className="submission-answer-list">
            {Object.entries(selectedSubmission.answers).map(([blockId, answerValue]) => (
              <article key={blockId} className="submission-answer-item">
                <h3>{blockId}</h3>
                <pre>{formatAnswerValue(answerValue)}</pre>
              </article>
            ))}

            {Object.keys(selectedSubmission.answers).length === 0 ? (
              <p>No answer payload found in this submission.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {canManageRoles ? (
        <section className="panel">
          <h2>Create student access key</h2>
          <div className="grid two-col">
            <label>
              Class ID
              <input
                value={accessKeyClassId}
                onChange={(event) => setAccessKeyClassId(event.target.value)}
              />
            </label>

            <label>
              Max uses
              <input
                type="number"
                min={1}
                value={accessKeyMaxUses}
                onChange={(event) => setAccessKeyMaxUses(event.target.value)}
              />
            </label>

            <label>
              Expires in days
              <input
                type="number"
                min={1}
                value={accessKeyExpiresDays}
                onChange={(event) => setAccessKeyExpiresDays(event.target.value)}
              />
            </label>

            <label>
              Note (optional)
              <input value={accessKeyNote} onChange={(event) => setAccessKeyNote(event.target.value)} />
            </label>
          </div>

          <button type="button" className="primary-btn" onClick={handleCreateStudentAccessKey}>
            Generate access key
          </button>

          {generatedStudentAccessKey ? (
            <div className="generated-key-box">
              <p>Share this one-time key with students:</p>
              <code>{generatedStudentAccessKey}</code>
            </div>
          ) : null}
        </section>
      ) : null}

      {canManageRoles ? (
        <section className="panel">
          <h2>Role management (admin)</h2>
          <div className="grid two-col">
            <label>
              Target UID
              <input value={targetUid} onChange={(event) => setTargetUid(event.target.value)} />
            </label>

            <label>
              Role
              <select
                value={targetRole}
                onChange={(event) =>
                  setTargetRole(event.target.value as "student" | "teacher" | "admin" | "editor")
                }
              >
                <option value="student">student</option>
                <option value="teacher">teacher</option>
                <option value="admin">admin</option>
                <option value="editor">editor</option>
              </select>
            </label>

            <label className="full-width">
              Class IDs (comma-separated)
              <input
                value={targetClassIds}
                onChange={(event) => setTargetClassIds(event.target.value)}
              />
            </label>
          </div>

          <button type="button" className="primary-btn" onClick={handleAssignRole}>
            Apply role settings
          </button>
        </section>
      ) : null}

      {(role === "admin" || role === "editor") ? (
        <section className="panel">
          <h2>Publish module version (manual)</h2>
          <div className="grid two-col">
            <label>
              Module ID
              <input
                value={publishModuleId}
                onChange={(event) => setPublishModuleId(event.target.value)}
              />
            </label>

            <label>
              Module Version ID
              <input
                value={publishVersionId}
                onChange={(event) => setPublishVersionId(event.target.value)}
              />
            </label>
          </div>

          <button type="button" className="primary-btn" onClick={handlePublish}>
            Publish
          </button>
        </section>
      ) : null}

      <footer className="status-strip">{status}</footer>
    </main>
  );
}

function ValidationIssueList({ issues }: { issues: ValidationIssue[] }): JSX.Element {
  if (issues.length === 0) {
    return <p className="micro-text">No validation issues reported.</p>;
  }

  return (
    <div className="issue-list">
      <h4>Validation issues</h4>
      {issues.map((issue, index) => (
        <p key={`${issue.code}-${issue.path}-${index}`} className={`issue-${issue.severity}`}>
          [{issue.severity}] {issue.path}: {issue.message}
        </p>
      ))}
    </div>
  );
}

function formatAnswerValue(value: SubmissionAnswerValue): string {
  if (typeof value === "string") {
    return value;
  }

  return Object.entries(value)
    .map(([key, itemValue]) => `${key}: ${itemValue}`)
    .join("\n");
}
