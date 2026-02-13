# Source Documents

Store canonical source inputs for AI-assisted generation here.

Examples:

- case studies
- legal reference compilations
- lesson notes
- approved markdown source packs

These files are read-only reference artifacts for generation and review workflows.

Milestone 6 note:

- Source material can be ingested into Firestore via the admin dashboard (`upsertSourceDocument` callable).
- Ingested documents are chunked into `sourceChunks` for retrieval metadata and citation linking.
