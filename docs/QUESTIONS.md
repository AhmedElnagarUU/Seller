# Open questions from implementing agents

When a task or doc does not tell you what to do, add an entry here **instead of guessing**.
The owner or planner answers it, updates the relevant doc, then marks it answered.

## Format

```
### Q-<number>: <short title>
- Task: T-XXX
- Asked by: <agent / model name>
- Question: <what is unclear, one or two sentences>
- Options I see: <optional: A) ... B) ...>
- Status: OPEN
- Answer: <filled in by owner/planner>
- Doc updated: <file + section, filled in by owner/planner>
```

## Questions

### Q-001: tailwindcss 4.6.7 does not exist
- Task: T-001
- Asked by: Claude (implementing agent)
- Question: The task pins `tailwindcss` 4.6.7, but the npm registry has no such version (latest is 4.3.4).
- Options I see: A) 4.3.4, same as `@tailwindcss/postcss` (used for now so the build works). B) another version.
- Status: OPEN
- Answer:
- Doc updated:

### Q-002: Docker image tags for mongo, minio, mc
- Task: T-001
- Asked by: Claude (implementing agent)
- Question: The task says tags are "pinned in T-001" but gives none. I used `mongo:8.0.4` (verified, works). For `minio/minio:RELEASE.2025-04-22T22-12-26Z` and `minio/mc:RELEASE.2025-04-16T18-13-26Z` I could not verify the tags (Docker Hub pull was denied in my sandbox; MinIO may have stopped publishing images there).
- Options I see: A) keep these tags. B) owner names tags or another registry for MinIO.
- Status: OPEN
- Answer:
- Doc updated:

### Q-003: MONGODB_URI in vitest `test.env`
- Task: T-001
- Asked by: Claude (implementing agent)
- Question: The task says `test.env` holds every env variable, but a fixed `MONGODB_URI` there overrides the in-memory URI that `global-setup.ts` sets, so tests cannot connect. I left `MONGODB_URI` out of `test.env`.
- Options I see: A) keep it out (current). B) pass the URI with vitest `provide`/`inject`.
- Status: OPEN
- Answer:
- Doc updated:
