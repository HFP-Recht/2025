import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let testEnv: RulesTestEnvironment;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rules = readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8");

describe("firestore security rules", () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "demo-hfp-platform",
      firestore: {
        rules
      }
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  it("allows student to write own attempt", async () => {
    const studentDb = testEnv.authenticatedContext("student-1", {
      role: "student",
      classIds: ["PK25A"]
    }).firestore();

    await assertSucceeds(
      setDoc(doc(studentDb, "attempts", "student-1_m1_v1"), {
        ownerUid: "student-1",
        classId: "PK25A",
        moduleId: "m1",
        moduleVersionId: "v1",
        status: "draft"
      })
    );
  });

  it("blocks student from reading another student attempt", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "attempts", "student-2_m1_v1"), {
        ownerUid: "student-2",
        classId: "PK25A",
        moduleId: "m1",
        moduleVersionId: "v1",
        status: "draft"
      });
    });

    const studentDb = testEnv.authenticatedContext("student-1", {
      role: "student",
      classIds: ["PK25A"]
    }).firestore();

    await assertFails(getDoc(doc(studentDb, "attempts", "student-2_m1_v1")));
  });

  it("allows teacher to read assigned class submissions only", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "submissions", "s1"), {
        ownerUid: "student-1",
        classId: "PK25A",
        moduleId: "m1",
        moduleVersionId: "v1"
      });

      await setDoc(doc(db, "submissions", "s2"), {
        ownerUid: "student-2",
        classId: "PK99X",
        moduleId: "m2",
        moduleVersionId: "v2"
      });
    });

    const teacherDb = testEnv.authenticatedContext("teacher-1", {
      role: "teacher",
      classIds: ["PK25A"]
    }).firestore();

    await assertSucceeds(getDoc(doc(teacherDb, "submissions", "s1")));
    await assertFails(getDoc(doc(teacherDb, "submissions", "s2")));
  });

  it("allows admin module writes and blocks students", async () => {
    const adminDb = testEnv.authenticatedContext("admin-1", {
      role: "admin",
      classIds: []
    }).firestore();

    const studentDb = testEnv.authenticatedContext("student-1", {
      role: "student",
      classIds: ["PK25A"]
    }).firestore();

    await assertSucceeds(
      setDoc(doc(adminDb, "modules", "m1"), {
        moduleId: "m1",
        title: "Module"
      })
    );

    await assertFails(
      setDoc(doc(studentDb, "modules", "m2"), {
        moduleId: "m2",
        title: "Module"
      })
    );
  });
});
