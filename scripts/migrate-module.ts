import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { resolve, join, basename } from "node:path";
import process from "node:process";
import { existsSync } from "node:fs";
import * as cheerio from "cheerio";
import {
  parseModuleVersion,
  validateModuleSemantics,
  type ValidationIssue
} from "../packages/content-schema/src/index";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubtopicFolder {
  order: number;
  folderName: string;
  folderPath: string;
  title: string;
  slug: string;
}

interface LawCaseJson {
  status: string;
  assignmentTitle: string;
  solution_keys: string[];
  subAssignments: Record<string, SubAssignment>;
}

interface SubAssignment {
  title: string;
  type: string;
  caseText: string;
  hints: { id: string; text: string }[];
  solution: {
    level: string;
    solutions: { id: string; answer: string }[];
    discussion: { question: string; answer: string }[];
  };
}

interface ModuleBlock {
  id: string;
  type: string;
  [key: string]: unknown;
}

interface Lesson {
  lessonId: string;
  title: string;
  pageType?: string;
  blocks: ModuleBlock[];
}

interface ModuleVersion {
  schemaVersion: string;
  moduleId: string;
  title: string;
  description: string;
  outcomes: string[];
  version: number;
  status: string;
  legalReferences: { id: string; citation: string; url?: string }[];
  metadata: { language: string; estimatedMinutes?: number };
  generation: {
    sourceDocumentIds: string[];
    generatedBy: string;
    generatedAt: string;
  };
  lessons: Lesson[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function stripWikilinks(text: string): string {
  return text.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, "$1");
}

function toKebabCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeId(prefix: string, index: number): string {
  return `${prefix}-${index + 1}`;
}

function extractLegalReferences(text: string): string[] {
  const refs: Set<string> = new Set();
  const patterns = [
    /(?:OR|ZGB|BV|USG|SVG|SchKG|UWG|StGB|ZPO)\s+Art\.?\s*\d+/g,
    /Art\.?\s*\d+\s+(?:OR|ZGB|BV|USG|SVG|SchKG|UWG|StGB|ZPO)/g
  ];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach((m) => refs.add(m.trim()));
    }
  }
  return [...refs];
}

// ---------------------------------------------------------------------------
// Step 1: Discover subtopic folders
// ---------------------------------------------------------------------------

async function discoverSubtopics(sourceDir: string): Promise<SubtopicFolder[]> {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const subtopics: SubtopicFolder[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === "HFP") continue;

    const match = entry.name.match(/^(\d+)\s+(.+)$/);
    if (!match) continue;

    const order = parseInt(match[1], 10);
    const title = match[2];
    const slug = `${match[1]}-${toKebabCase(title)}`;

    subtopics.push({
      order,
      folderName: entry.name,
      folderPath: join(sourceDir, entry.name),
      title,
      slug
    });
  }

  subtopics.sort((a, b) => a.order - b.order);
  return subtopics;
}

// ---------------------------------------------------------------------------
// Step 2A: Parse 01 file → Lesson "Grundlagen"
// ---------------------------------------------------------------------------

async function parseGrundlagenLesson(
  folderPath: string,
  subtopicSlug: string
): Promise<{ lesson: Lesson; outcomes: string[] }> {
  const files = await readdir(folderPath);
  const file01 = files.find((f) => f.startsWith("01 ") && f.endsWith(".md"));
  if (!file01) {
    throw new Error(`No 01 file found in ${folderPath}`);
  }

  const content = await readFile(join(folderPath, file01), "utf8");
  const blocks: ModuleBlock[] = [];
  const outcomes: string[] = [];
  let blockCounter = 0;

  // Extract outcomes from [!success] callout
  const successMatch = content.match(/>\s*\[!success\][^\n]*\n((?:>.*\n?)*)/);
  if (successMatch) {
    const calloutBody = successMatch[1]
      .split("\n")
      .map((line) => line.replace(/^>\s*/, "").trim())
      .filter((line) => line.startsWith("- "))
      .map((line) => stripWikilinks(line.replace(/^-\s*\.{3}\s*/, "").replace(/^-\s*/, "").trim()));

    outcomes.push(...calloutBody.filter((o) => o.length > 0));
  }

  // Extract [!info] Kernaussage blocks under ### headings
  const sections = content.split(/(?=^###\s)/m);
  for (const section of sections) {
    const headingMatch = section.match(/^###\s+(.+)/m);
    if (!headingMatch) continue;

    const sectionTitle = stripWikilinks(headingMatch[1].trim());

    // Find [!info] Kernaussage in this section
    const kernaussageMatch = section.match(
      />\s*\[!info\]\s*Kernaussage\s*\n((?:>.*\n?)*)/
    );
    if (kernaussageMatch) {
      const kernaussageBody = kernaussageMatch[1]
        .split("\n")
        .map((line) => line.replace(/^>\s*/, "").trim())
        .filter((line) => line.length > 0)
        .join("\n");

      const cleanContent = stripWikilinks(kernaussageBody);
      if (cleanContent.length > 0) {
        blocks.push({
          id: makeId(`${subtopicSlug}-theory`, blockCounter++),
          type: "theory",
          title: sectionTitle,
          content: cleanContent
        });
      }
    }
  }

  // Extract [!question] Reflexionsfragen
  const reflexionMatch = content.match(
    />\s*\[!question\]\s*Reflexionsfragen[^\n]*\n((?:>.*\n?)*)/
  );
  if (reflexionMatch) {
    const reflexionBody = reflexionMatch[1]
      .split("\n")
      .map((line) => line.replace(/^>\s*>?\s*/, "").trim())
      .filter((line) => line.startsWith("- "))
      .map((line) => stripWikilinks(line.replace(/^-\s*/, "").trim()));

    if (reflexionBody.length > 0) {
      blocks.push({
        id: makeId(`${subtopicSlug}-discussion`, blockCounter++),
        type: "discussion-prompt",
        title: "Reflexionsfragen zum Einstieg",
        prompts: reflexionBody.map((prompt, i) => ({
          id: makeId(`${subtopicSlug}-refl`, i),
          prompt
        }))
      });
    }
  }

  // Fallback: if no blocks were extracted, create a simple theory block
  if (blocks.length === 0) {
    blocks.push({
      id: `${subtopicSlug}-theory-fallback`,
      type: "theory",
      title: "Grundlagen",
      content: stripWikilinks(
        content
          .replace(/^#.*$/gm, "")
          .replace(/>\s*\[![^\]]+\][^\n]*\n(?:>.*\n?)*/g, "")
          .replace(/<iframe[^>]*>.*?<\/iframe>/gs, "")
          .trim()
          .slice(0, 500) || "Siehe Lehrmittel."
      )
    });
  }

  if (outcomes.length === 0) {
    outcomes.push("Die Grundlagen dieses Themas verstehen und anwenden können.");
  }

  return {
    lesson: {
      lessonId: `${subtopicSlug}-grundlagen`,
      title: "Grundlagen",
      pageType: "theory",
      blocks
    },
    outcomes
  };
}

// ---------------------------------------------------------------------------
// Step 2B: Parse 02 file → dwik HTML → Lesson "Zusammenfassung"
// ---------------------------------------------------------------------------

async function parseZusammenfassungLesson(
  folderPath: string,
  subtopicSlug: string,
  projectRoot: string
): Promise<Lesson> {
  const files = await readdir(folderPath);
  const file02 = files.find((f) => f.startsWith("02 ") && f.endsWith(".md"));
  if (!file02) {
    throw new Error(`No 02 file found in ${folderPath}`);
  }

  const mdContent = await readFile(join(folderPath, file02), "utf8");

  // Extract iframe src → dwik HTML filename
  const iframeMatch = mdContent.match(/src="[^"]*\/dwik\/(\d+\.html)"/);
  if (!iframeMatch) {
    // Fallback: create a placeholder lesson
    return {
      lessonId: `${subtopicSlug}-zusammenfassung`,
      title: "Zusammenfassung",
      pageType: "summary",
      blocks: [
        {
          id: `${subtopicSlug}-summary-placeholder`,
          type: "theory",
          title: "Das Wichtigste in Kürze",
          content: "Zusammenfassung wird geladen..."
        }
      ]
    };
  }

  const htmlFilename = iframeMatch[1];
  const htmlPath = join(projectRoot, "dwik", htmlFilename);

  if (!existsSync(htmlPath)) {
    throw new Error(`HTML file not found: ${htmlPath}`);
  }

  const htmlContent = await readFile(htmlPath, "utf8");
  const $ = cheerio.load(htmlContent);

  const blocks: ModuleBlock[] = [];
  let blockCounter = 0;

  // Parse .section elements → theory blocks & competence-check blocks
  $(".section").each((_i, section) => {
    const $section = $(section);
    const sectionTitle = $section.find(".section-title").first().text().trim();

    // Collect text content (subsections, paragraphs, lists, concept-boxes)
    const contentParts: string[] = [];

    $section.children().each((_j, child) => {
      const $child = $(child);
      if ($child.hasClass("section-title")) return;
      if ($child.hasClass("dropdown")) return;

      // Subsections
      if ($child.hasClass("subsection") || $child.is("p") || $child.is("ul")) {
        const text = $child.text().trim();
        if (text.length > 0) {
          contentParts.push(text);
        }
      }

      // Two-column layouts
      if ($child.hasClass("two-column")) {
        $child.find(".column").each((_k, col) => {
          const colText = $(col).text().trim();
          if (colText.length > 0) {
            contentParts.push(colText);
          }
        });
      }

      // Concept boxes (not inside dropdowns)
      if ($child.hasClass("concept-box")) {
        const boxTitle = $child.find(".concept-box-title").text().trim();
        const boxContent = $child.find("p").not(".concept-box-title").text().trim();
        if (boxTitle || boxContent) {
          contentParts.push(`${boxTitle}: ${boxContent}`.trim());
        }
      }
    });

    // Also grab concept-boxes inside subsections
    $section.find(".subsection .concept-box").each((_j, box) => {
      const $box = $(box);
      const boxTitle = $box.find(".concept-box-title").text().trim();
      const boxContent = $box
        .find("p")
        .not(".concept-box-title")
        .map((_k, p) => $(p).text().trim())
        .get()
        .join(" ");
      if (boxTitle || boxContent) {
        contentParts.push(`${boxTitle}: ${boxContent}`.trim());
      }
    });

    const theoryContent = contentParts.join("\n\n").trim();
    if (theoryContent.length > 0 && sectionTitle.length > 0) {
      blocks.push({
        id: makeId(`${subtopicSlug}-sum-theory`, blockCounter++),
        type: "theory",
        title: sectionTitle,
        content: theoryContent
      });
    }

    // Parse dropdown → competence-check blocks
    $section.find(".dropdown").each((_j, dropdown) => {
      const $dropdown = $(dropdown);
      const questions: { id: string; prompt: string; hint?: string; solution?: string }[] = [];

      const $questions = $dropdown.find(".dropdown-content .question");
      const $answers = $dropdown.find(".dropdown-content .answer");

      $questions.each((k, qEl) => {
        const questionText = $(qEl).text().trim();
        const answerText = $answers.eq(k).text().trim();

        if (questionText.length > 0) {
          questions.push({
            id: makeId(`${subtopicSlug}-sum-q${blockCounter}`, k),
            prompt: questionText,
            solution: answerText || undefined
          });
        }
      });

      if (questions.length > 0) {
        blocks.push({
          id: makeId(`${subtopicSlug}-sum-check`, blockCounter++),
          type: "competence-check",
          title: `Kompetenz-Check: ${sectionTitle}`,
          questions
        });
      }
    });
  });

  if (blocks.length === 0) {
    blocks.push({
      id: `${subtopicSlug}-summary-fallback`,
      type: "theory",
      title: "Das Wichtigste in Kürze",
      content: "Zusammenfassung der prüfungsrelevanten Konzepte."
    });
  }

  return {
    lessonId: `${subtopicSlug}-zusammenfassung`,
    title: "Zusammenfassung",
    pageType: "summary",
    blocks
  };
}

// ---------------------------------------------------------------------------
// Step 2C: Parse 03 file → JSON → Lesson "Rechtsfälle"
// ---------------------------------------------------------------------------

async function parseRechtsfaelleLesson(
  folderPath: string,
  subtopicSlug: string,
  hfpDir: string
): Promise<{ lesson: Lesson; legalRefs: string[] }> {
  const files = await readdir(folderPath);
  const file03 = files.find((f) => f.startsWith("03 ") && f.endsWith(".md"));
  if (!file03) {
    throw new Error(`No 03 file found in ${folderPath}`);
  }

  const mdContent = await readFile(join(folderPath, file03), "utf8");

  // Extract assignmentId from the first iframe
  const assignmentMatch = mdContent.match(/assignmentId=([^&"'\s]+)/);
  if (!assignmentMatch) {
    throw new Error(`No assignmentId found in ${file03}`);
  }

  const assignmentId = assignmentMatch[1].replace(/&amp;/g, "&");

  // Find JSON file in HFP folder
  const hfpFiles = await readdir(hfpDir);
  const jsonFile = hfpFiles.find(
    (f) => f.endsWith(".json") && (f === `${assignmentId}.json` || f.includes(assignmentId))
  );

  if (!jsonFile) {
    throw new Error(
      `No JSON file found for assignmentId '${assignmentId}' in ${hfpDir}. Available: ${hfpFiles.filter((f) => f.endsWith(".json")).join(", ")}`
    );
  }

  const jsonContent = await readFile(join(hfpDir, jsonFile), "utf8");
  const lawCaseData = JSON.parse(jsonContent) as LawCaseJson;

  const blocks: ModuleBlock[] = [];
  const allLegalRefs: string[] = [];
  let blockCounter = 0;

  // Extract discussion questions from the MD file for each fall
  const discussionMap = new Map<string, string[]>();
  const fallBlocks = mdContent.split(/>\[!example\]-\s*/);
  for (const fallBlock of fallBlocks) {
    const subIdMatch = fallBlock.match(/subId=([^"&\s]+)/);
    if (!subIdMatch) continue;
    const subId = subIdMatch[1];

    const discussionLines: string[] = [];
    const lines = fallBlock.split("\n");
    for (const line of lines) {
      const dMatch = line.match(/^>>-\s*(.+)/);
      if (dMatch) {
        discussionLines.push(dMatch[1].trim());
      }
    }
    if (discussionLines.length > 0) {
      discussionMap.set(subId, discussionLines);
    }
  }

  const STEP_TITLES = [
    "Sachverhalt erfassen",
    "Rechtsgrundlagen bestimmen",
    "Voraussetzungen prüfen",
    "Entscheid und Kommunikation"
  ];

  // Process each subAssignment
  const subAssignmentEntries = Object.entries(lawCaseData.subAssignments);
  for (const [subId, subAssignment] of subAssignmentEntries) {
    if (subAssignment.type !== "law_case") continue;

    const steps = [];
    for (let s = 0; s < 4; s++) {
      const stepId = `step_${s + 1}` as const;
      const hint = subAssignment.hints[s]
        ? stripHtmlTags(subAssignment.hints[s].text)
        : undefined;
      const solution = subAssignment.solution.solutions[s]
        ? stripHtmlTags(subAssignment.solution.solutions[s].answer)
        : undefined;

      steps.push({
        id: stepId,
        title: STEP_TITLES[s],
        prompt: hint || `Bearbeiten Sie ${STEP_TITLES[s]}.`,
        hint: hint || undefined,
        solution: solution || undefined
      });

      // Collect legal references from solutions
      if (solution) {
        allLegalRefs.push(...extractLegalReferences(solution));
      }
    }

    blocks.push({
      id: makeId(`${subtopicSlug}-case`, blockCounter),
      type: "law-case-4-step",
      title: subAssignment.title,
      caseText: subAssignment.caseText,
      steps
    });
    blockCounter++;

    // Add discussion prompt from either JSON or MD
    const jsonDiscussion = subAssignment.solution.discussion;
    const mdDiscussion = discussionMap.get(subId);

    const discussionPrompts: { id: string; prompt: string }[] = [];

    if (jsonDiscussion && jsonDiscussion.length > 0) {
      jsonDiscussion.forEach((d, i) => {
        discussionPrompts.push({
          id: makeId(`${subtopicSlug}-disc-${subId}`, i),
          prompt: stripHtmlTags(d.question)
        });
      });
    } else if (mdDiscussion && mdDiscussion.length > 0) {
      mdDiscussion.forEach((q, i) => {
        discussionPrompts.push({
          id: makeId(`${subtopicSlug}-disc-${subId}`, i),
          prompt: q
        });
      });
    }

    if (discussionPrompts.length > 0) {
      blocks.push({
        id: makeId(`${subtopicSlug}-disc-block`, blockCounter++),
        type: "discussion-prompt",
        title: `Diskussion: ${subAssignment.title}`,
        prompts: discussionPrompts
      });
    }
  }

  if (blocks.length === 0) {
    blocks.push({
      id: `${subtopicSlug}-cases-fallback`,
      type: "theory",
      title: "Rechtsfälle",
      content: "Keine Rechtsfälle in dieser Lektion."
    });
  }

  return {
    lesson: {
      lessonId: `${subtopicSlug}-rechtsfaelle`,
      title: "Rechtsfälle",
      pageType: "cases",
      blocks
    },
    legalRefs: [...new Set(allLegalRefs)]
  };
}

// ---------------------------------------------------------------------------
// Step 2D: Parse 04 file → Lesson "Mindmap"
// ---------------------------------------------------------------------------

async function parseMindmapLesson(
  folderPath: string,
  subtopicSlug: string,
  subtopicTitle: string
): Promise<Lesson | null> {
  const files = await readdir(folderPath);
  const file04 = files.find((f) => f.startsWith("04 ") && f.endsWith(".md"));
  if (!file04) {
    return null;
  }

  const content = await readFile(join(folderPath, file04), "utf8");

  // Extract mermaid content
  const mermaidMatch = content.match(/```mermaid\n([\s\S]*?)```/);
  if (!mermaidMatch) {
    return null;
  }

  const mermaidContent = mermaidMatch[1].trim();

  return {
    lessonId: `${subtopicSlug}-mindmap`,
    title: "Mindmap",
    pageType: "mindmap",
    blocks: [
      {
        id: `${subtopicSlug}-mindmap-block`,
        type: "mindmap",
        title: `Mindmap: ${subtopicTitle}`,
        content: mermaidContent
      }
    ]
  };
}

// ---------------------------------------------------------------------------
// Assemble module
// ---------------------------------------------------------------------------

async function buildModule(
  subtopic: SubtopicFolder,
  projectRoot: string
): Promise<{ module: ModuleVersion; warnings: string[] }> {
  const hfpDir = join(subtopic.folderPath, "..", "HFP");
  const warnings: string[] = [];

  // Parse all lessons
  const { lesson: grundlagenLesson, outcomes } = await parseGrundlagenLesson(
    subtopic.folderPath,
    subtopic.slug
  );

  const zusammenfassungLesson = await parseZusammenfassungLesson(
    subtopic.folderPath,
    subtopic.slug,
    projectRoot
  );

  const { lesson: rechtsfaelleLesson, legalRefs } = await parseRechtsfaelleLesson(
    subtopic.folderPath,
    subtopic.slug,
    hfpDir
  );

  const mindmapLesson = await parseMindmapLesson(
    subtopic.folderPath,
    subtopic.slug,
    subtopic.title
  );

  // Assemble lessons
  const lessons: Lesson[] = [grundlagenLesson, zusammenfassungLesson, rechtsfaelleLesson];
  if (mindmapLesson) {
    lessons.push(mindmapLesson);
  } else {
    warnings.push(`No mindmap file found for ${subtopic.folderName}`);
  }

  // Build legal references
  const legalReferences = legalRefs.map((ref, i) => ({
    id: `ref-${subtopic.slug}-${i + 1}`,
    citation: ref
  }));

  const module: ModuleVersion = {
    schemaVersion: "1.0.0",
    moduleId: subtopic.slug,
    title: subtopic.title,
    description: `Schwerpunktthema: ${subtopic.title}`,
    outcomes,
    version: 1,
    status: "published",
    legalReferences,
    metadata: { language: "de-CH" },
    generation: {
      sourceDocumentIds: [subtopic.folderName],
      generatedBy: "migrate-module.ts",
      generatedAt: new Date().toISOString()
    },
    lessons
  };

  return { module, warnings };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const sourceArg = process.argv[2];
  if (!sourceArg) {
    console.error("Usage: npm run migrate:module -- content/sources/modul1");
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const sourceDir = resolve(projectRoot, sourceArg);

  if (!existsSync(sourceDir)) {
    console.error(`Source directory not found: ${sourceDir}`);
    process.exit(1);
  }

  console.log(`Scanning ${sourceDir}...`);
  const subtopics = await discoverSubtopics(sourceDir);
  console.log(`Found ${subtopics.length} subtopics:`);
  subtopics.forEach((s) => console.log(`  ${s.order}: ${s.title} → ${s.slug}`));

  // Ensure output directories exist
  const modulesDir = join(projectRoot, "content", "modules");
  const coursesDir = join(projectRoot, "content", "courses");
  await mkdir(modulesDir, { recursive: true });
  await mkdir(coursesDir, { recursive: true });

  const results: { subtopic: SubtopicFolder; success: boolean; file?: string }[] = [];

  for (const subtopic of subtopics) {
    console.log(`\nProcessing: ${subtopic.folderName}...`);

    try {
      const { module, warnings } = await buildModule(subtopic, projectRoot);

      warnings.forEach((w) => console.log(`  WARN: ${w}`));

      // Validate with schema
      try {
        const validated = parseModuleVersion(module);
        const semanticIssues = validateModuleSemantics(validated);
        const errors = semanticIssues.filter((i) => i.severity === "error");
        const warns = semanticIssues.filter((i) => i.severity === "warning");

        if (warns.length > 0) {
          warns.forEach((w) => console.log(`  SEMANTIC WARN: ${w.path}: ${w.message}`));
        }

        if (errors.length > 0) {
          console.error(`  VALIDATION ERRORS:`);
          errors.forEach((e) => console.error(`    ${e.path}: ${e.message}`));
        }
      } catch (validationError) {
        console.error(
          `  SCHEMA ERROR: ${validationError instanceof Error ? validationError.message : String(validationError)}`
        );
      }

      // Write module JSON
      const outputFile = join(modulesDir, `${subtopic.slug}.v1.json`);
      await writeFile(outputFile, JSON.stringify(module, null, 2), "utf8");
      console.log(`  Written: ${outputFile}`);

      results.push({ subtopic, success: true, file: outputFile });
    } catch (error) {
      console.error(
        `  ERROR: ${error instanceof Error ? error.message : String(error)}`
      );
      results.push({ subtopic, success: false });
    }
  }

  // Generate course index
  const courseIndex = {
    courseId: "hfp-recht-modul1",
    title: "Modul 1 – Grundlagen & Vertragsrecht",
    description: "8 Schwerpunktthemen zum Vertragsrecht",
    subtopics: subtopics.map((s) => ({
      order: s.order,
      moduleId: s.slug,
      title: s.title
    }))
  };

  const courseFile = join(coursesDir, "hfp-recht-modul1.json");
  await writeFile(courseFile, JSON.stringify(courseIndex, null, 2), "utf8");
  console.log(`\nCourse index written: ${courseFile}`);

  // Summary
  console.log("\n=== MIGRATION SUMMARY ===");
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;
  console.log(`Successful: ${successCount}/${results.length}`);
  if (failCount > 0) {
    console.log(`Failed: ${failCount}`);
    results
      .filter((r) => !r.success)
      .forEach((r) => console.log(`  - ${r.subtopic.folderName}`));
  }
}

main().catch((error: unknown) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
