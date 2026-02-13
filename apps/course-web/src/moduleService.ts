import { parseModuleVersion, type ModuleVersion } from "@hfp/content-schema";
import sampleModule from "../../../content/modules/sample-module.v1.json";
import pilotModule from "../../../content/modules/pilot/pilot-vertragsrecht.v1.generated.json";
import week3MockModule from "../../../content/modules/classroom/woche3-haftung-gewaehrleistung.v1.generated.json";
import { getPublishedModule } from "./firestoreApi";

const localModules: Record<string, unknown> = {
  [sampleModule.moduleId]: sampleModule,
  [pilotModule.moduleId]: pilotModule,
  [week3MockModule.moduleId]: week3MockModule
};

export async function loadModule(moduleId: string): Promise<ModuleVersion> {
  if (localModules[moduleId]) {
    return parseModuleVersion(localModules[moduleId]);
  }

  const remote = await getPublishedModule(moduleId);
  return parseModuleVersion(remote);
}
