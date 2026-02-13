import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import process from "node:process";
import sampleModule from "../content/modules/sample-module.v1.json";
import pilotModule from "../content/modules/pilot/pilot-vertragsrecht.v1.generated.json";

initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? "demo-hfp-platform" });

async function main(): Promise<void> {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.warn("FIRESTORE_EMULATOR_HOST not set. This script is meant for emulators.");
  }

  const db = getFirestore();
  await seedModule(db, sampleModule);
  await seedModule(db, pilotModule);

  await db.collection("classes").doc("PK25A").set(
    {
      classId: "PK25A",
      title: "PK25A",
      teacherUids: ["teacher-demo"],
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  console.log("Seed complete: sample module, pilot module, class");
}

async function seedModule(
  db: ReturnType<typeof getFirestore>,
  moduleData: {
    moduleId: string;
    title: string;
    description: string;
    outcomes: string[];
    version: number;
    status: "draft" | "review" | "approved" | "published";
  }
): Promise<void> {
  const moduleVersionId = `${moduleData.moduleId}_v${moduleData.version}`;

  await db.collection("modules").doc(moduleData.moduleId).set(
    {
      moduleId: moduleData.moduleId,
      title: moduleData.title,
      description: moduleData.description,
      outcomes: moduleData.outcomes,
      publishedVersionId: moduleData.status === "published" ? moduleVersionId : "",
      latestDraftVersionId: moduleVersionId,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  await db.collection("moduleVersions").doc(moduleVersionId).set(
    {
      moduleVersionId,
      moduleId: moduleData.moduleId,
      versionNumber: moduleData.version,
      status: moduleData.status,
      content: moduleData,
      validationSummary: {
        errorCount: 0,
        warningCount: 0
      },
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}

main().catch((error: unknown) => {
  console.error("Seed failed", error);
  process.exit(1);
});
