import { describe, expect, it } from "vitest";
import {
  buildGeneratedDraft,
  chunkSourceText,
  normalizeSourceText,
  type SourceDocumentRecord
} from "../../src/pipeline/aiPipeline";

describe("aiPipeline", () => {
  it("normalizes and chunks source text", () => {
    const text = Array.from({ length: 1900 }, () => "Werkstattrecht OR Art. 1").join(" ");
    const normalized = normalizeSourceText(text);
    const chunks = chunkSourceText(normalized, 300, 40);

    expect(normalized.length).toBeGreaterThan(100);
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks[0].chunkId).toMatch(/^chunk_/);
    expect(chunks.every((chunk) => chunk.tokenEstimate > 0)).toBe(true);
  });

  it("builds schema-ready draft with validation summary", () => {
    const sources: SourceDocumentRecord[] = [
      {
        sourceDocumentId: "source_1",
        title: "Vertragsgrundlagen",
        content:
          "Ein Vertrag entsteht durch Antrag und Annahme gemaess OR Art. 1. Formvorschriften stehen in OR Art. 11. Das Modul soll praxisnah fuer Werkstattfaelle sein.",
        tags: ["vertrag"]
      },
      {
        sourceDocumentId: "source_2",
        title: "Rechtsquellen",
        content:
          "Die Normenhierarchie ist zentral. ZGB Art. 1 regelt die richterliche Rechtsfindung. BV Art. 49 beschreibt den Vorrang von Bundesrecht.",
        tags: ["staat"]
      }
    ];

    const draft = buildGeneratedDraft({
      moduleId: "pilot-vertragsrecht",
      title: "Pilot Vertragsrecht",
      description: "Pilotmodul fuer die erste produktive AI-gestuetzte Auslieferung.",
      outcomes: [
        "Die Lernenden erklaeren den Vertragsabschluss.",
        "Die Lernenden wenden die Normenhierarchie auf einen Fall an."
      ],
      sourceDocuments: sources,
      version: 1,
      generatedBy: "unit-test"
    });

    expect(draft.module.moduleId).toBe("pilot-vertragsrecht");
    expect(draft.module.status).toBe("draft");
    expect(draft.module.lessons.length).toBeGreaterThanOrEqual(2);
    expect(draft.module.legalReferences.length).toBeGreaterThanOrEqual(2);
    expect(draft.validationSummary.errorCount).toBe(0);
  });
});
