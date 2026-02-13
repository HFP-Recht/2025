import { useEffect, useId, useMemo, useState } from "react";
import mermaid from "mermaid";
import ReactQuill from "react-quill";
import type { ModuleBlock, ModuleVersion, Role } from "@hfp/content-schema";

mermaid.initialize({ startOnLoad: false, theme: "default" });

const quillEditorModules = {
  toolbar: [
    [{ header: [2, 3, false] }],
    ["bold", "italic", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link"],
    ["clean"]
  ]
};

const quillEditorFormats = [
  "header",
  "bold",
  "italic",
  "underline",
  "list",
  "bullet",
  "link"
];

export type BlockAnswerValue = string | Record<string, string>;
export type AttemptAnswers = Record<string, BlockAnswerValue>;

export interface ModuleRendererProps {
  module: ModuleVersion;
  answers: AttemptAnswers;
  onAnswersChange: (next: AttemptAnswers) => void;
  viewerRole?: Role;
  readOnly?: boolean;
  lessonLayout?: "stack" | "tabs";
  verifySolutionKey?: (blockId: string, key: string) => Promise<boolean>;
}

export function ModuleRenderer({
  module,
  answers,
  onAnswersChange,
  viewerRole,
  readOnly = false,
  lessonLayout = "stack",
  verifySolutionKey
}: ModuleRendererProps): JSX.Element {
  const [activeLessonId, setActiveLessonId] = useState(module.lessons[0]?.lessonId ?? "");

  useEffect(() => {
    if (module.lessons.length === 0) {
      setActiveLessonId("");
      return;
    }

    const hasActiveLesson = module.lessons.some((lesson) => lesson.lessonId === activeLessonId);
    if (!hasActiveLesson) {
      setActiveLessonId(module.lessons[0].lessonId);
    }
  }, [activeLessonId, module.lessons]);

  const visibleLessons = useMemo(() => {
    if (lessonLayout !== "tabs" || module.lessons.length <= 1) {
      return module.lessons;
    }

    const activeLesson = module.lessons.find((lesson) => lesson.lessonId === activeLessonId);
    return activeLesson ? [activeLesson] : [module.lessons[0]];
  }, [activeLessonId, lessonLayout, module.lessons]);

  return (
    <div className="cms-module-renderer" data-module-id={module.moduleId}>
      {lessonLayout === "tabs" && module.lessons.length > 1 ? (
        <nav className="cms-lesson-tabs" aria-label="Lesson tabs">
          {module.lessons.map((lesson, index) => {
            const isActive = lesson.lessonId === visibleLessons[0]?.lessonId;
            return (
              <button
                type="button"
                key={lesson.lessonId}
                className={isActive ? "cms-lesson-tab active" : "cms-lesson-tab"}
                onClick={() => setActiveLessonId(lesson.lessonId)}
                aria-pressed={isActive}
              >
                {index + 1}. {lesson.title}
              </button>
            );
          })}
        </nav>
      ) : null}

      {visibleLessons.map((lesson) => (
        <section className="cms-lesson" key={lesson.lessonId}>
          <header className="cms-lesson-header">
            <h2>{lesson.title}</h2>
          </header>

          <div className="cms-block-list">
            {lesson.blocks.map((block) => (
              <BlockRouter
                key={block.id}
                block={block}
                answers={answers}
                onAnswersChange={onAnswersChange}
                viewerRole={viewerRole}
                readOnly={readOnly}
                verifySolutionKey={verifySolutionKey}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

interface BlockRouterProps {
  block: ModuleBlock;
  answers: AttemptAnswers;
  onAnswersChange: (next: AttemptAnswers) => void;
  viewerRole?: Role;
  readOnly: boolean;
  verifySolutionKey?: (blockId: string, key: string) => Promise<boolean>;
}

function BlockRouter({
  block,
  answers,
  onAnswersChange,
  viewerRole,
  readOnly,
  verifySolutionKey
}: BlockRouterProps): JSX.Element {
  switch (block.type) {
    case "theory":
      return <TheoryBlock title={block.title} content={block.content} />;
    case "rich-text-check":
      return (
        <RichTextCheckBlock
          block={block}
          value={toRecordAnswer(answers[block.id])}
          onChange={(next) => setRecordAnswer(block.id, next, answers, onAnswersChange)}
          readOnly={readOnly}
        />
      );
    case "competence-check":
      return (
        <CompetenceCheckBlock
          block={block}
          value={toRecordAnswer(answers[block.id])}
          onChange={(next) => setRecordAnswer(block.id, next, answers, onAnswersChange)}
          readOnly={readOnly}
        />
      );
    case "objective-check":
      return (
        <ObjectiveCheckBlock
          block={block}
          value={toRecordAnswer(answers[block.id])}
          onChange={(next) => setRecordAnswer(block.id, next, answers, onAnswersChange)}
          readOnly={readOnly}
        />
      );
    case "law-case-4-step":
      return (
        <LawCaseBlock
          block={block}
          value={toRecordAnswer(answers[block.id])}
          onChange={(next) => setRecordAnswer(block.id, next, answers, onAnswersChange)}
          readOnly={readOnly}
        />
      );
    case "solution-unlock":
      return (
        <SolutionUnlockBlock
          block={block}
          viewerRole={viewerRole}
          verifySolutionKey={verifySolutionKey}
        />
      );
    case "discussion-prompt":
      return (
        <DiscussionPromptBlock
          block={block}
          value={toRecordAnswer(answers[block.id])}
          onChange={(next) => setRecordAnswer(block.id, next, answers, onAnswersChange)}
          readOnly={readOnly}
        />
      );
    case "mindmap":
      return <MindmapBlock title={block.title} content={block.content} />;
    default:
      return <p>Unknown block type</p>;
  }
}

function TheoryBlock({ title, content }: { title: string; content: string }): JSX.Element {
  return (
    <article className="cms-block cms-block-theory">
      <h3>{title}</h3>
      {splitParagraphs(content).map((paragraph, index) => (
        <p key={`${title}-${index}`}>{paragraph}</p>
      ))}
    </article>
  );
}

function MindmapBlock({ title, content }: { title: string; content: string }): JSX.Element {
  const uniqueId = useId();
  const containerId = `mermaid-${uniqueId.replace(/:/g, "")}`;
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let canceled = false;

    mermaid
      .render(containerId, content)
      .then(({ svg: rendered }) => {
        if (!canceled) {
          setSvg(rendered);
          setError("");
        }
      })
      .catch((err) => {
        if (!canceled) {
          setError(err instanceof Error ? err.message : "Mermaid render failed");
          setSvg("");
        }
      });

    return () => {
      canceled = true;
    };
  }, [containerId, content]);

  return (
    <article className="cms-block cms-block-mindmap">
      <h3>{title}</h3>
      {svg ? (
        <div className="cms-mindmap-svg" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : error ? (
        <pre className="cms-mindmap-fallback">{content}</pre>
      ) : (
        <p>Rendering mindmap...</p>
      )}
    </article>
  );
}

function RichTextCheckBlock({
  block,
  value,
  onChange,
  readOnly
}: {
  block: Extract<ModuleBlock, { type: "rich-text-check" }>;
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  readOnly: boolean;
}): JSX.Element {
  return (
    <article className="cms-block cms-block-rich-text">
      <h3>{block.title}</h3>
      {block.introduction ? <p className="cms-intro">{block.introduction}</p> : null}

      {block.prompts.map((prompt, index) => (
        <div className="cms-question cms-rich-question" key={prompt.id}>
          <label htmlFor={`${block.id}-${prompt.id}`}>
            {index + 1}. {prompt.prompt}
          </label>

          {prompt.hint ? (
            <details className="cms-hint">
              <summary>Hinweis</summary>
              <p>{prompt.hint}</p>
            </details>
          ) : null}

          <div id={`${block.id}-${prompt.id}`} className="cms-quill-wrap">
            <ReactQuill
              theme={readOnly ? "bubble" : "snow"}
              readOnly={readOnly}
              modules={readOnly ? { toolbar: false } : quillEditorModules}
              formats={quillEditorFormats}
              value={value[prompt.id] ?? ""}
              onChange={(nextValue) =>
                onChange({
                  ...value,
                  [prompt.id]: nextValue
                })
              }
            />
          </div>

          {readOnly && prompt.solution ? (
            <details className="cms-hint">
              <summary>Musterloesung</summary>
              <div dangerouslySetInnerHTML={{ __html: prompt.solution }} />
            </details>
          ) : null}
        </div>
      ))}
    </article>
  );
}

type ObjectiveBlock = Extract<ModuleBlock, { type: "objective-check" }>;
type ObjectiveItem = ObjectiveBlock["items"][number];

interface ObjectiveFeedback {
  state: "correct" | "needs-work" | "info";
  message: string;
}

function ObjectiveCheckBlock({
  block,
  value,
  onChange,
  readOnly
}: {
  block: ObjectiveBlock;
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  readOnly: boolean;
}): JSX.Element {
  const [feedbackByItemId, setFeedbackByItemId] = useState<Record<string, ObjectiveFeedback>>({});

  function setItemValue(itemId: string, nextValue: string): void {
    onChange({
      ...value,
      [itemId]: nextValue
    });
  }

  function evaluateItem(item: ObjectiveItem): void {
    const feedback = evaluateObjectiveItem(item, value[item.id]);
    setFeedbackByItemId((current) => ({
      ...current,
      [item.id]: feedback
    }));
  }

  return (
    <article className="cms-block cms-block-objective">
      <h3>{block.title}</h3>
      {block.introduction ? <p className="cms-intro">{block.introduction}</p> : null}

      <div className="cms-objective-list">
        {block.items.map((item, index) => (
          <section className="cms-objective-item" key={item.id}>
            <h4>
              {index + 1}. {item.prompt}
            </h4>

            {item.hint ? (
              <details className="cms-hint">
                <summary>Hinweis</summary>
                <p>{item.hint}</p>
              </details>
            ) : null}

            {item.kind === "mc-single" ? (
              <ObjectiveSingleChoiceInput
                item={item}
                rawValue={value[item.id]}
                onChange={(nextValue) => setItemValue(item.id, nextValue)}
                readOnly={readOnly}
              />
            ) : null}

            {item.kind === "mc-multi" ? (
              <ObjectiveMultiChoiceInput
                item={item}
                rawValue={value[item.id]}
                onChange={(nextValue) => setItemValue(item.id, nextValue)}
                readOnly={readOnly}
              />
            ) : null}

            {item.kind === "true-false" ? (
              <ObjectiveTrueFalseInput
                item={item}
                rawValue={value[item.id]}
                onChange={(nextValue) => setItemValue(item.id, nextValue)}
                readOnly={readOnly}
              />
            ) : null}

            {item.kind === "matching" ? (
              <ObjectiveMatchingInput
                item={item}
                rawValue={value[item.id]}
                onChange={(nextValue) => setItemValue(item.id, nextValue)}
                readOnly={readOnly}
              />
            ) : null}

            {item.kind === "ordering" ? (
              <ObjectiveOrderingInput
                item={item}
                rawValue={value[item.id]}
                onChange={(nextValue) => setItemValue(item.id, nextValue)}
                readOnly={readOnly}
              />
            ) : null}

            {item.kind === "cloze" ? (
              <ObjectiveClozeInput
                item={item}
                rawValue={value[item.id]}
                onChange={(nextValue) => setItemValue(item.id, nextValue)}
                readOnly={readOnly}
              />
            ) : null}

            {!readOnly ? (
              <div className="cms-objective-actions">
                <button type="button" className="cms-check-btn" onClick={() => evaluateItem(item)}>
                  Feedback pruefen
                </button>
              </div>
            ) : null}

            {feedbackByItemId[item.id] ? (
              <div className={`cms-objective-feedback state-${feedbackByItemId[item.id].state}`}>
                {feedbackByItemId[item.id].message}
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </article>
  );
}

function ObjectiveSingleChoiceInput({
  item,
  rawValue,
  onChange,
  readOnly
}: {
  item: Extract<ObjectiveItem, { kind: "mc-single" }>;
  rawValue: string | undefined;
  onChange: (nextValue: string) => void;
  readOnly: boolean;
}): JSX.Element {
  const selected = rawValue ?? "";
  return (
    <div className="cms-objective-options">
      {item.options.map((option) => (
        <label key={option.id} className="cms-option-row">
          <input
            type="radio"
            name={`objective-${item.id}`}
            value={option.id}
            checked={selected === option.id}
            onChange={(event) => onChange(event.target.value)}
            disabled={readOnly}
          />
          <span>{option.text}</span>
        </label>
      ))}
    </div>
  );
}

function ObjectiveMultiChoiceInput({
  item,
  rawValue,
  onChange,
  readOnly
}: {
  item: Extract<ObjectiveItem, { kind: "mc-multi" }>;
  rawValue: string | undefined;
  onChange: (nextValue: string) => void;
  readOnly: boolean;
}): JSX.Element {
  const selectedIds = parseStringArray(rawValue);

  function toggleOption(optionId: string): void {
    const next = selectedIds.includes(optionId)
      ? selectedIds.filter((id) => id !== optionId)
      : [...selectedIds, optionId];

    onChange(JSON.stringify(next));
  }

  return (
    <div className="cms-objective-options">
      {item.options.map((option) => (
        <label key={option.id} className="cms-option-row">
          <input
            type="checkbox"
            checked={selectedIds.includes(option.id)}
            onChange={() => toggleOption(option.id)}
            disabled={readOnly}
          />
          <span>{option.text}</span>
        </label>
      ))}
    </div>
  );
}

function ObjectiveTrueFalseInput({
  item,
  rawValue,
  onChange,
  readOnly
}: {
  item: Extract<ObjectiveItem, { kind: "true-false" }>;
  rawValue: string | undefined;
  onChange: (nextValue: string) => void;
  readOnly: boolean;
}): JSX.Element {
  return (
    <div className="cms-objective-options inline-two">
      <label className="cms-option-row">
        <input
          type="radio"
          name={`objective-${item.id}`}
          checked={rawValue === "true"}
          onChange={() => onChange("true")}
          disabled={readOnly}
        />
        <span>{item.trueLabel}</span>
      </label>
      <label className="cms-option-row">
        <input
          type="radio"
          name={`objective-${item.id}`}
          checked={rawValue === "false"}
          onChange={() => onChange("false")}
          disabled={readOnly}
        />
        <span>{item.falseLabel}</span>
      </label>
    </div>
  );
}

function ObjectiveMatchingInput({
  item,
  rawValue,
  onChange,
  readOnly
}: {
  item: Extract<ObjectiveItem, { kind: "matching" }>;
  rawValue: string | undefined;
  onChange: (nextValue: string) => void;
  readOnly: boolean;
}): JSX.Element {
  const answers = parseStringRecord(rawValue);
  const rightOptions = uniqueStrings([...item.pairs.map((pair) => pair.right), ...item.distractors]);

  function setPairValue(pairId: string, nextValue: string): void {
    const nextAnswers = {
      ...answers,
      [pairId]: nextValue
    };
    onChange(JSON.stringify(nextAnswers));
  }

  return (
    <div className="cms-matching-grid">
      {item.pairs.map((pair) => (
        <label key={pair.id} className="cms-matching-row">
          <span className="cms-matching-left">{pair.left}</span>
          <select
            value={answers[pair.id] ?? ""}
            onChange={(event) => setPairValue(pair.id, event.target.value)}
            disabled={readOnly}
          >
            <option value="">Bitte waehlen</option>
            {rightOptions.map((option) => (
              <option key={`${pair.id}-${option}`} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

function ObjectiveOrderingInput({
  item,
  rawValue,
  onChange,
  readOnly
}: {
  item: Extract<ObjectiveItem, { kind: "ordering" }>;
  rawValue: string | undefined;
  onChange: (nextValue: string) => void;
  readOnly: boolean;
}): JSX.Element {
  const defaultOrder = item.items.map((entry) => entry.id);
  const currentOrder = toNormalizedOrdering(rawValue, defaultOrder);

  function moveEntry(fromIndex: number, direction: -1 | 1): void {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= currentOrder.length) {
      return;
    }

    const next = [...currentOrder];
    const [entry] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, entry);
    onChange(JSON.stringify(next));
  }

  return (
    <div className="cms-ordering-list">
      {currentOrder.map((itemId, index) => {
        const option = item.items.find((entry) => entry.id === itemId);
        if (!option) {
          return null;
        }

        return (
          <div className="cms-ordering-row" key={option.id}>
            <span className="cms-order-index">{index + 1}.</span>
            <span className="cms-order-text">{option.text}</span>
            <div className="cms-order-controls">
              <button
                type="button"
                className="cms-order-btn"
                onClick={() => moveEntry(index, -1)}
                disabled={readOnly || index === 0}
              >
                Nach oben
              </button>
              <button
                type="button"
                className="cms-order-btn"
                onClick={() => moveEntry(index, 1)}
                disabled={readOnly || index === currentOrder.length - 1}
              >
                Nach unten
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ObjectiveClozeInput({
  item,
  rawValue,
  onChange,
  readOnly
}: {
  item: Extract<ObjectiveItem, { kind: "cloze" }>;
  rawValue: string | undefined;
  onChange: (nextValue: string) => void;
  readOnly: boolean;
}): JSX.Element {
  const values = parseStringRecord(rawValue);

  function setBlankValue(blankId: string, nextValue: string): void {
    onChange(
      JSON.stringify({
        ...values,
        [blankId]: nextValue
      })
    );
  }

  return (
    <div className="cms-cloze-wrap">
      <p className="cms-cloze-text">{item.text}</p>
      {item.blanks.map((blank, index) => (
        <label key={blank.id} className="cms-cloze-row">
          <span>
            Luecke {index + 1}: {blank.label}
          </span>
          <input
            type="text"
            value={values[blank.id] ?? ""}
            onChange={(event) => setBlankValue(blank.id, event.target.value)}
            disabled={readOnly}
          />
        </label>
      ))}
    </div>
  );
}

function evaluateObjectiveItem(item: ObjectiveItem, rawValue: string | undefined): ObjectiveFeedback {
  switch (item.kind) {
    case "mc-single": {
      const selectedId = rawValue ?? "";
      if (!selectedId) {
        return {
          state: "info",
          message: "Waehlen Sie eine Option und pruefen Sie dann das Feedback."
        };
      }

      const selectedOption = item.options.find((option) => option.id === selectedId);
      const isCorrect = !!selectedOption?.isCorrect;
      return {
        state: isCorrect ? "correct" : "needs-work",
        message: resolveObjectiveFeedbackText(item, isCorrect)
      };
    }

    case "mc-multi": {
      const selectedIds = new Set(parseStringArray(rawValue));
      if (selectedIds.size === 0) {
        return {
          state: "info",
          message: "Waehlen Sie mindestens eine Option und pruefen Sie dann das Feedback."
        };
      }

      const correctIds = new Set(
        item.options.filter((option) => option.isCorrect).map((option) => option.id)
      );
      const sameSize = selectedIds.size === correctIds.size;
      const sameMembers = [...correctIds].every((id) => selectedIds.has(id));
      const isCorrect = sameSize && sameMembers;

      return {
        state: isCorrect ? "correct" : "needs-work",
        message: resolveObjectiveFeedbackText(item, isCorrect)
      };
    }

    case "true-false": {
      if (rawValue !== "true" && rawValue !== "false") {
        return {
          state: "info",
          message: "Waehlen Sie True oder False und pruefen Sie dann das Feedback."
        };
      }

      const isCorrect = rawValue === String(item.correctAnswer);
      return {
        state: isCorrect ? "correct" : "needs-work",
        message: resolveObjectiveFeedbackText(item, isCorrect)
      };
    }

    case "matching": {
      const selected = parseStringRecord(rawValue);
      const hasAll = item.pairs.every((pair) => typeof selected[pair.id] === "string" && selected[pair.id]);

      if (!hasAll) {
        return {
          state: "info",
          message: "Ordnen Sie jedem linken Begriff einen passenden rechten Begriff zu."
        };
      }

      const isCorrect = item.pairs.every((pair) => selected[pair.id] === pair.right);
      return {
        state: isCorrect ? "correct" : "needs-work",
        message: resolveObjectiveFeedbackText(item, isCorrect)
      };
    }

    case "ordering": {
      const currentOrder = toNormalizedOrdering(rawValue, item.items.map((entry) => entry.id));
      const isCorrect =
        currentOrder.length === item.correctOrder.length &&
        currentOrder.every((entry, index) => entry === item.correctOrder[index]);

      return {
        state: isCorrect ? "correct" : "needs-work",
        message: resolveObjectiveFeedbackText(item, isCorrect)
      };
    }

    case "cloze": {
      const values = parseStringRecord(rawValue);
      const hasAll = item.blanks.every((blank) => normalizeForCompare(values[blank.id]).length > 0);

      if (!hasAll) {
        return {
          state: "info",
          message: "Fuellen Sie alle Luecken aus und pruefen Sie dann das Feedback."
        };
      }

      const isCorrect = item.blanks.every((blank) => {
        const answer = normalizeForCompare(values[blank.id]);
        const accepted = new Set([
          normalizeForCompare(blank.answer),
          ...blank.alternatives.map((entry) => normalizeForCompare(entry))
        ]);
        return accepted.has(answer);
      });

      return {
        state: isCorrect ? "correct" : "needs-work",
        message: resolveObjectiveFeedbackText(item, isCorrect)
      };
    }

    default:
      return {
        state: "info",
        message: "Feedback konnte nicht berechnet werden."
      };
  }
}

function resolveObjectiveFeedbackText(item: ObjectiveItem, isCorrect: boolean): string {
  if (isCorrect) {
    return item.feedbackCorrect ?? item.explanation ?? "Gut begruendet. Diese Antwort passt."
  }

  return item.feedbackIncorrect ?? item.explanation ?? "Noch nicht ganz. Pruefen Sie den Kernbegriff erneut."
}

function parseStringArray(rawValue: string | undefined): string[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((entry): entry is string => typeof entry === "string");
    }
  } catch {
    return rawValue
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return [];
}

function parseStringRecord(rawValue: string | undefined): Record<string, string> {
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.entries(parsed).reduce<Record<string, string>>((acc, [key, value]) => {
      if (typeof value === "string") {
        acc[key] = value;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
}

function toNormalizedOrdering(rawValue: string | undefined, defaultOrder: string[]): string[] {
  const parsed = parseStringArray(rawValue);
  if (parsed.length !== defaultOrder.length) {
    return defaultOrder;
  }

  const parsedSet = new Set(parsed);
  const defaultSet = new Set(defaultOrder);
  if (parsedSet.size !== defaultSet.size) {
    return defaultOrder;
  }

  const allKnown = parsed.every((entry) => defaultSet.has(entry));
  return allKnown ? parsed : defaultOrder;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((entry) => {
    if (!seen.has(entry)) {
      seen.add(entry);
      result.push(entry);
    }
  });

  return result;
}

function normalizeForCompare(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function CompetenceCheckBlock({
  block,
  value,
  onChange,
  readOnly
}: {
  block: Extract<ModuleBlock, { type: "competence-check" }>;
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  readOnly: boolean;
}): JSX.Element {
  return (
    <article className="cms-block cms-block-check">
      <h3>{block.title}</h3>
      {block.introduction ? <p className="cms-intro">{block.introduction}</p> : null}
      {block.questions.map((question, index) => (
        <div className="cms-question" key={question.id}>
          <label htmlFor={`${block.id}-${question.id}`}>
            {index + 1}. {question.prompt}
          </label>
          {question.hint ? (
            <details className="cms-hint">
              <summary>Hint</summary>
              <p>{question.hint}</p>
            </details>
          ) : null}
          <textarea
            id={`${block.id}-${question.id}`}
            value={value[question.id] ?? ""}
            onChange={(event) =>
              onChange({
                ...value,
                [question.id]: event.target.value
              })
            }
            rows={4}
            disabled={readOnly}
          />
        </div>
      ))}
    </article>
  );
}

function LawCaseBlock({
  block,
  value,
  onChange,
  readOnly
}: {
  block: Extract<ModuleBlock, { type: "law-case-4-step" }>;
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  readOnly: boolean;
}): JSX.Element {
  return (
    <article className="cms-block cms-block-law-case">
      <h3>{block.title}</h3>
      <div className="cms-case-text">{block.caseText}</div>

      {block.steps.map((step) => (
        <div className="cms-step" key={step.id}>
          <h4>{step.title}</h4>
          <p className="cms-step-prompt">{step.prompt}</p>
          {step.hint ? (
            <details className="cms-hint">
              <summary>Hint</summary>
              <p>{step.hint}</p>
            </details>
          ) : null}
          <textarea
            id={`${block.id}-${step.id}`}
            value={value[step.id] ?? ""}
            onChange={(event) =>
              onChange({
                ...value,
                [step.id]: event.target.value
              })
            }
            rows={5}
            disabled={readOnly}
          />
        </div>
      ))}
    </article>
  );
}

function SolutionUnlockBlock({
  block,
  viewerRole,
  verifySolutionKey
}: {
  block: Extract<ModuleBlock, { type: "solution-unlock" }>;
  viewerRole?: Role;
  verifySolutionKey?: (blockId: string, key: string) => Promise<boolean>;
}): JSX.Element {
  const [unlockInput, setUnlockInput] = useState("");
  const [isUnlockedByKey, setIsUnlockedByKey] = useState(false);
  const [unlockMessage, setUnlockMessage] = useState("");
  const [checking, setChecking] = useState(false);

  const roleUnlocked =
    block.unlockMode === "role-based" &&
    !!viewerRole &&
    block.allowedRoles.includes(viewerRole);

  const isUnlocked = roleUnlocked || isUnlockedByKey;

  async function handleUnlock(): Promise<void> {
    if (!verifySolutionKey) {
      setUnlockMessage("Solution key verification is not configured.");
      return;
    }

    if (!unlockInput.trim()) {
      setUnlockMessage("Enter a solution key first.");
      return;
    }

    setChecking(true);
    setUnlockMessage("");

    try {
      const valid = await verifySolutionKey(block.id, unlockInput.trim());
      setIsUnlockedByKey(valid);
      setUnlockMessage(valid ? "Solutions unlocked." : "Invalid solution key.");
    } catch {
      setUnlockMessage("Could not verify key right now.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <article className="cms-block cms-block-solution">
      <h3>{block.title}</h3>

      {!isUnlocked ? (
        <div className="cms-solution-locked">
          {block.unlockMode === "role-based" ? (
            <p>Solutions are only visible for configured reviewer roles.</p>
          ) : (
            <>
              <label htmlFor={`${block.id}-unlock`}>Solution key</label>
              <div className="cms-unlock-row">
                <input
                  id={`${block.id}-unlock`}
                  type="password"
                  value={unlockInput}
                  onChange={(event) => setUnlockInput(event.target.value)}
                />
                <button type="button" onClick={handleUnlock} disabled={checking}>
                  {checking ? "Checking..." : "Unlock"}
                </button>
              </div>
            </>
          )}
          {unlockMessage ? <p className="cms-status-message">{unlockMessage}</p> : null}
        </div>
      ) : (
        <div className="cms-solution-list">
          {block.solutions.map((solution) => (
            <section className="cms-solution-item" key={solution.id}>
              <h4>{solution.title}</h4>
              {splitParagraphs(solution.content).map((paragraph, index) => (
                <p key={`${solution.id}-${index}`}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
      )}
    </article>
  );
}

function DiscussionPromptBlock({
  block,
  value,
  onChange,
  readOnly
}: {
  block: Extract<ModuleBlock, { type: "discussion-prompt" }>;
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  readOnly: boolean;
}): JSX.Element {
  return (
    <article className="cms-block cms-block-discussion">
      <h3>{block.title}</h3>
      {block.prompts.map((prompt, index) => (
        <div className="cms-question" key={prompt.id}>
          <label htmlFor={`${block.id}-${prompt.id}`}>
            {index + 1}. {prompt.prompt}
          </label>
          <textarea
            id={`${block.id}-${prompt.id}`}
            value={value[prompt.id] ?? ""}
            onChange={(event) =>
              onChange({
                ...value,
                [prompt.id]: event.target.value
              })
            }
            rows={4}
            disabled={readOnly}
          />
        </div>
      ))}
    </article>
  );
}

function setRecordAnswer(
  blockId: string,
  value: Record<string, string>,
  answers: AttemptAnswers,
  onAnswersChange: (next: AttemptAnswers) => void
): void {
  onAnswersChange({
    ...answers,
    [blockId]: value
  });
}

function toRecordAnswer(value: BlockAnswerValue | undefined): Record<string, string> {
  if (!value) {
    return {};
  }

  if (typeof value === "string") {
    return { value };
  }

  return value;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
