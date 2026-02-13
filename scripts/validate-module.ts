import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import {
  parseModuleVersion,
  validateModuleSemantics,
  type ValidationIssue
} from "../packages/content-schema/src/index";

async function main(): Promise<void> {
  const fileArg = process.argv[2];

  if (!fileArg) {
    console.error("Usage: npm run validate:module -- <path-to-module-json>");
    process.exit(1);
  }

  const filePath = resolve(process.cwd(), fileArg);
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const moduleVersion = parseModuleVersion(parsed);
  const semanticIssues = validateModuleSemantics(moduleVersion);

  const errors = semanticIssues.filter((issue) => issue.severity === "error");
  const warnings = semanticIssues.filter((issue) => issue.severity === "warning");

  console.log(`Validation successful for ${fileArg}`);
  console.log(`Schema version: ${moduleVersion.schemaVersion}`);
  console.log(`Module ID: ${moduleVersion.moduleId}`);
  console.log(`Lessons: ${moduleVersion.lessons.length}`);

  if (warnings.length > 0) {
    console.log("Warnings:");
    printIssues(warnings);
  }

  if (errors.length > 0) {
    console.error("Errors:");
    printIssues(errors);
    process.exit(1);
  }
}

function printIssues(issues: ValidationIssue[]): void {
  issues.forEach((issue) => {
    console.log(`- [${issue.severity}] ${issue.path}: ${issue.message}`);
  });
}

main().catch((error: unknown) => {
  console.error("Validation failed:", error);
  process.exit(1);
});
