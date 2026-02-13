import { parseModuleVersion, type ModuleVersion, type Course } from "@hfp/content-schema";
import { getPublishedModule } from "./firestoreApi";

import courseIndex from "../../../content/courses/hfp-recht-modul1.json";
import mod10 from "../../../content/modules/10-schweizer-rechtsystem.v1.json";
import mod20 from "../../../content/modules/20-personenrecht.v1.json";
import mod30 from "../../../content/modules/30-vertragslehre.v1.json";
import mod40 from "../../../content/modules/40-vertragsformen.v1.json";
import mod50 from "../../../content/modules/50-entstehung-von-obligationen-aus-vertrag.v1.json";
import mod60 from "../../../content/modules/60-obligationentstehung-am-beispiel-veraeusserungsvertraege.v1.json";
import mod70 from "../../../content/modules/70-vertragserfuellung.v1.json";
import mod80 from "../../../content/modules/80-allgemeine-geschaeftsbedingungen.v1.json";

const localCourses: Record<string, unknown> = {
  [courseIndex.courseId]: courseIndex
};

const localModules: Record<string, unknown> = {
  [mod10.moduleId]: mod10,
  [mod20.moduleId]: mod20,
  [mod30.moduleId]: mod30,
  [mod40.moduleId]: mod40,
  [mod50.moduleId]: mod50,
  [mod60.moduleId]: mod60,
  [mod70.moduleId]: mod70,
  [mod80.moduleId]: mod80
};

const moduleCache = new Map<string, ModuleVersion>();

export function loadCourse(courseId: string): Course {
  const raw = localCourses[courseId];
  if (!raw) {
    throw new Error(`Course not found: ${courseId}`);
  }
  return raw as Course;
}

export async function loadCourseModule(moduleId: string): Promise<ModuleVersion> {
  const cached = moduleCache.get(moduleId);
  if (cached) return cached;

  if (localModules[moduleId]) {
    const parsed = parseModuleVersion(localModules[moduleId]);
    moduleCache.set(moduleId, parsed);
    return parsed;
  }

  const remote = await getPublishedModule(moduleId);
  const parsed = parseModuleVersion(remote);
  moduleCache.set(moduleId, parsed);
  return parsed;
}
