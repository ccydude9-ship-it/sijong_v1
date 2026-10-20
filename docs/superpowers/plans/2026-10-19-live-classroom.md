# Single HTML live classroom implementation

Goal: six Wi-Fi tablets keep the teacher's projector view updated before completion; settings is present on every screen.
Architecture: retain the standalone HTML and add opt-in same-origin JSON polling, reusing Express, teacher/classroom/student sessions, CSRF protection and SQLite. Serve HTML in a dedicated classroom entrypoint; no photos or credentials committed. Deployment is a separate final step requiring a persistent HTTPS host.

1. Add validated standalone state and revisioned per-student progress endpoints in apps/server/src/live; reuse existing auth, lesson records and operation replay handling. Teacher publishes one roster and distributes its classroom code. Only the selected student may write their progress. Configuration refresh invalidates old sessions to prevent stale writes.
2. Add classroom server entrypoint serving root index.html with an explicit live-mode marker and inline-safe CSP. Existing server entrypoint remains unchanged.
3. Update index.html: consistent settings icon and accessible settings return flow; teacher login/publish and student code/login; queue progress writes, retry on connection recovery, preserve unacknowledged work, handle conflicts explicitly. Poll only compact progress, not photos. Display six live tiles and allow unfinished work inspection.
4. Update personalized private HTML by carrying its embedded photo sheet into the revised generic UI. Export includes portrait sheet so it can be imported into the authenticated online teacher setup.
5. Verify server authorization, partial answers, independent students, stale revisions, duplicate retry, restart persistence; browser teacher + two tablet contexts, offline recovery, student selection and all-screen settings. Run existing standalone and server checks.

Review focus: edits during in-flight saves; stale work after roster replacement; same student on two devices; no teacher data to student sessions; disconnected state must never claim live updates.
