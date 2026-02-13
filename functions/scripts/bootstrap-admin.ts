import { readFile } from "node:fs/promises";
import process from "node:process";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

type Role = "student" | "teacher" | "admin" | "editor";

async function main(): Promise<void> {
  const uidArg = getArg("--uid");
  const emailArg = getArg("--email");
  const roleArg = (getArg("--role") ?? "admin") as Role;
  const classIdsArg = getArg("--classIds") ?? "";
  const classIds = classIdsArg
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (!uidArg && !emailArg) {
    throw new Error("Provide either --uid <uid> or --email <email>.");
  }

  if (!["student", "teacher", "admin", "editor"].includes(roleArg)) {
    throw new Error("--role must be one of: student, teacher, admin, editor.");
  }

  await initializeAdmin();

  const auth = getAuth();
  const userRecord = uidArg ? await auth.getUser(uidArg) : await auth.getUserByEmail(emailArg!);

  await auth.setCustomUserClaims(userRecord.uid, {
    role: roleArg,
    classIds
  });

  const db = getFirestore();
  await db
    .collection("users")
    .doc(userRecord.uid)
    .set(
      {
        uid: userRecord.uid,
        role: roleArg,
        classIds,
        email: userRecord.email ?? null,
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

  console.log("Custom claims and user profile updated:");
  console.log(`- uid: ${userRecord.uid}`);
  console.log(`- email: ${userRecord.email ?? "(none)"}`);
  console.log(`- role: ${roleArg}`);
  console.log(`- classIds: ${classIds.join(", ") || "(none)"}`);
}

async function initializeAdmin(): Promise<void> {
  const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH;

  if (serviceAccountPath) {
    const raw = await readFile(serviceAccountPath, "utf8");
    const serviceAccount = JSON.parse(raw) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };

    initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key
      })
    });
    return;
  }

  initializeApp();
}

function getArg(name: string): string | undefined {
  const index = process.argv.findIndex((entry) => entry === name);
  if (index === -1) {
    return undefined;
  }
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

main().catch((error: unknown) => {
  console.error("Bootstrap failed:", error);
  process.exit(1);
});
