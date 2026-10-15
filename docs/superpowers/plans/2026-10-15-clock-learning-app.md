# Clock Learning App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학생 6명이 오락실 타이틀 → 자기 이름 선택 → 연습·실전·공유 모드 메뉴를 거쳐 개인 일과 카드 8장으로 학습하며 교사가 진행과 완성 결과를 실시간 확인하는 첫 웹앱을 만든다.

**Architecture:** 같은 출처에서 React 화면과 Express API를 제공한다. 서버가 SQLite에 수업·카드·진행을 저장하고 정답을 판정하며, 인증된 SSE로 역할별 스냅샷을 전달한다. 이름 선택 세션은 명단만 조회하고 선택 후의 학생 세션은 해당 학생의 학습 자료만 조회한다.

**Tech Stack:** Node.js 24 LTS, npm workspaces, TypeScript, React, Vite, Express, node:sqlite, Zod, sharp, Vitest, Supertest, React Testing Library, Playwright.

**Spec:** [2026-10-14-clock-learning-app-design.md](../specs/2026-10-14-clock-learning-app-design.md).

**User clarification, 2026-10-15:** 아이들이 만든 그림은 아직 없다. 예시 그림으로 먼저 개발하고 나중에 교사 준비 화면에서 실제 그림으로 교체한다. 실제 자료 제공을 개발의 전제 조건으로 삼지 않는다.

**Screen flow clarification, 2026-10-15:** 학생용 앱 첫 화면은 가운데 큰 제목과 PRESS ANY BUTTON 안내가 있는 오락실 시작 화면이다. 터치·키 입력으로 이름 선택에 진입하고, 이름 선택 후에는 활동을 자동 실행하지 않고 연습·실전·공유 모드 메뉴를 표시한다.

**Mode selection clarification, 2026-10-15:** 모드는 자유롭게 선택한다. 선생님이 수업 순서를 말로 안내하며 모드별 개방이나 원격 강제 전환은 없다. 모든 모드의 '홈으로 돌아가기'는 같은 학생의 모드 메뉴로 돌아간다. 왕복해도 작성 중 내용과 저장된 진행을 유지한다.

## Global Constraints

- 첫 버전은 한 학급, 학생 6명, 교사 1명을 지원한다.
- React + Node.js + SQLite 구성을 사용한다. Node.js 24 LTS와 npm workspaces, 하나의 lockfile을 사용한다.
- 학생 화면은 타이틀 → 이름 선택 → 연습·실전·공유 모드 선택 → 선택한 활동 순서다. 학생별 코드 입력 대신 교사가 수업 전에 태블릿을 학급에 연결해 둔다.
- 각 학생은 카드 8장, 일어나기·잠자기 각 1장과 자유 일과 6장을 가진다.
- `minuteOfDay`는 0~1439 범위의 30분 배수이고 학생별로 중복되지 않는다. 시 입력은 1~12, 분은 0·30이다.
- 수업은 `preparing → active → ended`, 실전은 `reading → ordering → completed`다. active 동안 연습·실전·공유 세 모드를 자유롭게 선택한다.
- 오답은 정답을 공개하지 않는다. 시각 오류는 입력 영역, 순서 오류는 카드 영역에 표시한다.
- 학생 6개의 독립 브라우저 context와 교사 1개 context로 검증하고 정상 로컬 환경에서 저장된 변경은 교사 화면에 2초 이내 반영한다.
- 터치 영역 최소 48 CSS px, 기준 화면 1024×768, 키보드 조작·모션 감소·색 외 오류 안내를 지원한다.
- 학급 코드는 8자리 난수, 세션 토큰은 32바이트 난수, 세션 유효 시간은 8시간이다.
- 그림은 PNG·JPEG·WebP, 파일당 2 MB 및 최대 4096×4096 픽셀로 제한하고 재인코딩하여 메타데이터를 제거한다.
- 공개 저장소와 자동 테스트에는 가명과 가상 일과, 예시 그림만 사용한다. 비밀번호·학급 코드·쿠키·그림·정답 입력을 로그에 남기지 않는다.
- 기본 DB·업로드·서버 키는 Git에서 제외할 `.local/`에 둔다. 현재 클라우드 체크아웃을 사용하며 별도 worktree를 만들지 않는다.
- 이 문서 검토와 실행 방식 선택 전에 제품 코드·scaffolding·의존성 설치를 시작하지 않는다. 외부 프로젝트 생성·유료 배포는 포함하지 않는다.

## Review Focus

- 이름이 같은 학생: 표시 이름을 키로 쓰지 않고 ID로 카드를 연결하며 구별 표기가 없으면 수업 시작을 막는다. Task 4·9에서 검증한다.
- 학생을 바꾸는 도중 도착한 이전 요청: 이전 카드·오류·SSE·음성 피드백이 새 학생 화면에 섞이지 않아야 한다. Task 9·11에서 검증한다.
- 제출은 저장됐지만 응답이 유실된 경우: 재연결 후 같은 operation ID로 확인하며 집계·완료를 중복 처리하지 않는다. Task 7·11에서 검증한다.
- 수업이 바뀌는 순간의 저장·SSE: 진행 revision과 단계 revision을 따로 검사해 오래된 응답으로 화면이 되돌아가거나 종료 후 입력이 저장되지 않아야 한다. Task 7·8·11에서 검증한다.
- 이미지 교체·새 수업 복사·삭제: 실패 시 원본을 보존하고 다른 수업이 참조하는 그림은 지우지 않아야 한다. Task 5·12에서 검증한다.

## 파일과 실행 규약

기존 문서는 보존하며 README의 구현 상태는 실제 동작을 확인한 뒤 갱신한다. 아래 각 Task의 Files가 생성·수정할 파일의 기준이다. 테스트 fixture는 `tests/helpers/`에만 두고 제품에서 테스트 전용 인증 우회 경로를 만들지 않는다.

루트 스크립트는 `npm run typecheck`, `npm test -- <test-file>`, `npm run test:web -- <test-file>`, `npm run test:e2e -- <spec-file>`, `npm run build`, `npm run dev`, `npm start`, `npm run seed:demo`, `npm run teacher:password`, `npm run backup`으로 통일한다. 테스트 명령은 전체 인자를 루트 Vitest 또는 Playwright로 전달한다. E2E는 Chromium과 WebKit 프로젝트를 사용한다.

아래 테스트 코드는 결정해야 하는 핵심 assertion이다. 테스트마다 독립된 임시 DB·그림 경로와 가상 자료를 사용한다. `expect`는 Vitest, 브라우저 assertion은 Playwright의 것을 사용한다. 실행 전에는 runner와 fixture를 준비하되 구현을 추가하지 않은 상태에서 동작 테스트 실패를 먼저 기록한다. 매 task 마지막에는 나열된 변경 파일만 stage하고 검증 후 commit한다.

## Task 1: 시간·카드 규칙과 공유 계약

**Files:** Create 루트 `package.json`, `package-lock.json`, `.nvmrc`, `.gitignore`, `tsconfig.base.json`, `vitest.config.ts`; 각 workspace의 `package.json`·`tsconfig.json`; `packages/domain/src/{time,cards,grading,index}.ts`; `packages/contracts/src/{models,requests,events,index}.ts`; `tests/helpers/cards.ts`, `tests/domain/{time,cards,grading}.test.ts`.

**Interfaces:** `ClockTime = {hour:number; minute:0|30}`, `Period = 'am'|'pm'`, `Card = {id:string; studentId:string; title:string; kind:'wake'|'sleep'|'custom'; imageId:string; minuteOfDay:number}`, `AnswerMap = Record<string,ClockTime|null>`. Domain exports `toMinuteOfDay(time:ClockTime, period:Period):number`, `toClockTime(minuteOfDay:number):ClockTime`, `handAngles(time:ClockTime):{hour:number;minute:number}`, `validateCards(cards:Card[]):{cardId?:string;code:string}[]`, `gradeTimes(cards:Card[],answers:AnswerMap):string[]`, `gradeOrder(cards:Card[],order:string[]):string[]`, `matchPracticeCard(cards:Card[],time:ClockTime):Card|null`.

- [x] **1. Failing tests:** runner와 workspace 설정만 먼저 준비한다. `tests/helpers/cards.ts`에 `makeValidCards(studentId='s1'):Card[]`를 만들고, 고정 ID `c1`~`c8`, 하루 시각 `[420,450,480,720,900,1080,1170,1230]`, 첫 카드 wake·마지막 카드 sleep·나머지 custom, 가상 title·imageId를 사용한다. 다음 assertion을 포함한 domain tests를 작성한다.

```ts
expect(toMinuteOfDay({hour:12,minute:0},'am')).toBe(0);
expect(toMinuteOfDay({hour:12,minute:30},'pm')).toBe(750);
expect(handAngles({hour:3,minute:30})).toEqual({hour:105,minute:180});
const cards = makeValidCards();
expect(gradeOrder(cards,['c2','c1','c3','c4','c5','c6','c7','c8'])).toEqual(['c2','c1']);
const amAndPmCards = [cards[0], {...cards[0],id:'pm-card',minuteOfDay:1140}];
expect(matchPracticeCard(amAndPmCards,{hour:7,minute:0})?.id).toBe('c1');
```

추가 테스트명: `rejects_out_of_range_time`, `requires_exactly_eight_unique_cards`, `requires_wake_before_sleep`, `rejects_missing_duplicate_or_foreign_order_ids`, `marks_only_wrong_time_ids`, `covers_all_24_clock_faces`.
- [x] **2. Red:** `/workspace/sijong_v1`에서 위 구성에 필요한 의존성만 설치하고 `npm test -- tests/domain` 실행. domain export 미구현으로 실패하는지 확인한다. 테스트 0개 통과는 인정하지 않는다.
- [x] **3. Implement:** 위 정확한 함수와 타입을 구현한다. contracts는 Zod 요청 스키마와 수업·실전 단계 enum을 제공한다. 이름 선택과 학급 연결 역할을 별도 구분한다. `.nvmrc`는 검증된 24.19.0, engines는 Node `>=24 <25`로 지정한다. 모든 새로운 의존성은 실제 설치 가능한 호환 버전으로 lockfile에 고정하고 기존 문서는 수정하지 않는다.
- [x] **4. Green:** `npm test -- tests/domain`과 `npm run typecheck`. 전환·범위·카드 판정 테스트가 모두 실행돼 통과해야 한다.
- [x] **5. Commit:** `feat: define clock learning rules and shared contracts`.

## Task 2: 영속 저장과 가상 학급

**Files:** Create `apps/server/src/{config,db}.ts`, `apps/server/src/storage/{lessons,students,progress,sessions,operations,images,practice}.ts`, `apps/server/migrations/001-initial.sql`, `apps/server/src/demo/{seed,artwork}.ts`, `tests/helpers/{fixture,server}.ts`, `tests/server/storage.test.ts`.

**Interfaces:** `openStore({dbPath,uploadDir}: {dbPath:string;uploadDir:string}):Store`, `Store.close():void`, `Store.transaction<T>(fn:()=>T):T`; `seedDemo(store:Store):Promise<{lessonId:string;created:boolean}>`. `Config`는 `config.ts`에서 정의하며 `port:number`, `host:string`, `publicOrigin:string`, `dbPath:string`, `uploadDir:string`, `teacherPassword?:string`, `secureCookies:boolean`, `keyPath:string`를 가진다. 환경 변수와 기본값은 Task 12의 실행 규약을 따른다. Store repositories expose `lessons.get(id)`, `students.list(lessonId)`, `students.cards(studentId)`, `progress.get(studentId)`, `sessions.find(tokenHash)`, `operations.find(scope,id)`, `images.get(id)`, `practice.get(id)` with explicit record types exported by storage files. `createFixture():Promise<{store:Store;root:string;cleanup():Promise<void>}>` is test-only.

- [x] **1. Failing tests:** `reopens_saved_progress` checks progress after close/reopen; `rolls_back_failed_transaction` checks no partial writes; `migrations_are_repeatable` checks existing data survives; `seed_is_non_destructive` checks two calls keep one demo; `seed_refuses_when_real_lesson_open` checks no extra active lesson or overwritten records; `demo_has_six_distinct_personal_sets` asserts 6 students, 8 valid cards each and distinct artwork/title association.
- [x] **2. Red:** `npm test -- tests/server/storage.test.ts` fails because Store and seeding are missing.
- [x] **3. Implement:** use node:sqlite DatabaseSync, foreign keys, WAL, `busy_timeout=5000`, migration transaction and repository parameterized SQL. Store records use spec fields including revision, code HMAC, request hash and session scope. `seedDemo` creates only synthetic records with first-party PNG artwork rendered using sharp from original inline SVG definitions; example figures require no external download or uploaded child artwork. Add sharp as a server dependency for this deliverable and reuse it in Task 5. Supply deterministic injectable seed fixture for tests and cryptographic randomness for runtime IDs. Config maps paths to the configured data root; startup password enforcement is wired in Task 3·12 rather than required for raw storage tests.
- [x] **4. Green:** storage suite and domain suite pass; test temp directories are removed, `.local/` is ignored, foreign key violations are observable.
- [x] **5. Commit:** `feat: persist lessons and seed a synthetic classroom`.

## Task 3: 교사·기기 연결·이름 선택 인증 API

**Files:** Create `apps/server/src/{app,errors}.ts`, `apps/server/src/auth/{crypto,service,middleware,routes,limits}.ts`, `tests/server/auth.test.ts`; Modify `packages/contracts/src/{models,requests}.ts`, `tests/helpers/server.ts`.

**Interfaces:** `createApp(deps:{store:Store;config:Config}):Express`, `AuthService.bootstrapTeacher(password:string):void`, `AuthService.loginTeacher(password:string):SessionIssue`, `loginClassroom(code:string):SessionIssue`, `selectStudent(session:Session,studentId:string):SessionIssue`, `resetStudent(session:Session):SessionIssue`, `revokeLessonSessions(lessonId:string):void`, `SessionIssue={token:string;csrfToken:string;session:Session}`. `Session.role` is `teacher|classroom|student`; middleware obtains it from the hashed cookie token, never request student IDs. `GET /api/session` returns role, scope, CSRF token, expiry, never token hashes.

- [x] **1. Failing tests:** `classroom_session_sees_roster_only` asserts no card/image/progress access; `selected_id_scopes_student` asserts another student's scope is inaccessible; `teacher_login_is_separate`; `lesson_revocation_and_logout_revoke_sessions`; `expired_session_is_401`; `teacher_bootstrap_requires_password`; `cross_origin_or_missing_csrf_is_rejected`; `tokens_are_hashed_at_rest` verifies raw secrets absent in DB. Resource handlers from later tasks are represented here by test-only protected handlers exercising the actual auth middleware; full resource access tests remain in Tasks 5·7·8. Use fake clock: sixth failed login for the same hashed account/code in 5 minutes is 429; IP-wide 21st attempt in 5 minutes is 429 and other identities don't bypass it.
- [x] **2. Red:** `npm test -- tests/server/auth.test.ts` must fail on auth behavior.
- [x] **3. Implement:** POST teacher/classroom/student/reset/logout routes from spec; GET session and classroom roster. Teacher scrypt, code HMAC with persisted 0600 key, 32-byte random cookies, 8-hour expiry; HttpOnly/SameSite=Lax, Secure in HTTPS production. Rotate session on role change, validate Origin on all writes, require session CSRF on authenticated writes, limit login attempts, redact request logs. Reject student selection from an ended lesson or outside connected classroom; name selection is supervised classroom selection, not verified personal identity.
- [x] **4. Green:** `npm test -- tests/server/auth.test.ts` and typecheck pass. Unauthenticated endpoints never disclose roster or codes.
- [x] **5. Commit:** `feat: authenticate classroom devices and student name selection`.

## Task 4: 수업·학생별 카드 준비 API

**Files:** Create `apps/server/src/lessons/{service,routes}.ts`, `tests/server/lessons.test.ts`; Modify storage repositories and `packages/contracts/src/{models,requests}.ts`.

**Interfaces:** `LessonService.create():Promise<LessonRecord>`, `getTeacherLesson(id:string):TeacherLesson`, `updateStudent(lessonId:string,studentId:string,input:StudentSetup):TeacherLesson`, `rotateCode(lessonId:string):{code:string}`, `changePhase(lessonId:string,input:PhaseCommand):TeacherLesson`, `delete(lessonId:string):void`. `StudentSetup={displayName:string;distinction:string;cards:Card[]}`, `PhaseCommand={operationId:string;expectedRevision:number;phase:'active'|'ended';confirmIncomplete:boolean}`, `LessonPhase='preparing'|'active'|'ended'`. `TeacherLesson` includes 6 roster entries, setup validation, phase revision and progress summary; plaintext code is returned only by rotation.

- [x] **1. Failing tests:** `only_one_open_lesson`, `setup_requires_six_valid_sets`, `duplicate_names_require_distinction`, `rename_keeps_id_card_binding`, `running_cards_are_locked`, `stale_phase_is_409`, `duplicate_transition_advances_once`, `ending_requires_incomplete_confirmation`, `mode_selection_does_not_change_lesson_phase`, `ended_lesson_is_read_only`, `new_lesson_copies_cards_without_overwriting_history`, `rotated_code_revokes_old_code_and_sessions`. Name comparison trims and NFC-normalizes input; duplicate complete display labels are rejected. Max display name/distinction 30 characters, title 60; render as text.
- [x] **2. Red:** `npm test -- tests/server/lessons.test.ts` fails on missing service/routes.
- [x] **3. Implement:** spec's teacher lesson endpoints. Starting the lesson validates six complete card sets with required images, temporal constraints and distinguishable names; teacher starts/ends the whole lesson only. There is no teacher-controlled practice/practical/sharing phase or per-mode unlock. Empty first lesson uses demo content; following lessons copy prior setup with new IDs and code. After auth, check existing operation before new transition revision; transactionally persist only once. Code reissue revokes classroom/student sessions and existing live connections through Task 8 integration.
- [x] **4. Green:** lessons suite, auth and storage suites pass; injected transition write failure leaves old phase/revision intact.
- [x] **5. Commit:** `feat: prepare personal card sets and control lesson phases`.

## Task 5: 학생 그림 등록과 보호된 이미지 제공

**Files:** Create `apps/server/src/images/{service,routes}.ts`, `tests/server/images.test.ts`; Modify storage image/lesson repositories.

**Interfaces:** `ImageService.upload(session:Session,studentId:string,bytes:Buffer):Promise<{imageId:string}>`, `open(session:Session,imageId:string):{path:string;mime:string}`, `attachToCard(lessonId:string,cardId:string,imageId:string):void`, `removeUnreferenced(lessonId:string):Promise<void>`. File writes use temporary files and atomic rename; repository references determine lifecycle.

- [x] **1. Failing tests:** `accepts_png_jpeg_webp`, `rejects_svg_html_and_spoofed_mime`, `rejects_over_2mb_or_4096_dimensions`, `strips_metadata`, `only_teacher_uploads_during_preparation`, `student_can_read_only_own_images`, `failed_attach_keeps_previous_image`, `deleting_copied_lesson_preserves_shared_image`. Assert pre-existing bytes/reference still exist after injected DB or filesystem error.
- [x] **2. Red:** `npm test -- tests/server/images.test.ts` fails on absent image service.
- [x] **3. Implement:** bound upload bytes before buffering, sharp input pixel limit before decode, verify actual decoded format, reencode metadata-free image, random filenames under configured private upload dir. IDs are lookup keys, never filesystem paths from requests. No static public upload folder. Clean unattached replacement on failure; orphan housekeeping cannot remove referenced images. Teacher deletion rejects active lesson and removes only unreferenced assets after DB commit.
- [x] **4. Green:** image suite and relevant lesson/auth suites pass; failed unauthenticated download returns no bytes.
- [x] **5. Commit:** `feat: upload and privately serve personal card artwork`.

## Task 6: 무제한 연습 판정 API

**Files:** Create `apps/server/src/practice/{service,routes}.ts`, `tests/server/practice.test.ts`; Modify practice storage repository and shared contracts.

**Interfaces:** `PracticeService.next(session:Session):PracticeQuestion`, `check(session:Session,id:string,answer:ClockTime):PracticeResult`; `PracticeQuestion={id:string;clock:ClockTime}`, `PracticeResult={correct:boolean;matchedCardId:string|null;solvedCount:number}`. Server never accepts client-provided target time or count.

- [x] **1. Failing tests:** `samples_all_24_faces` uses deterministic test random source; `unsolved_question_is_reused`; `wrong_answer_does_not_expose_target_in_feedback`; `solved_answer_counts_once`; `no_matching_card_still_succeeds`; `matching_am_pm_selects_earlier_card`; `active_lesson_allows_practice_without_mode_lock`; `another_student_question_is_forbidden`; `no_ten_question_limit` solves at least 25.
- [x] **2. Red:** `npm test -- tests/server/practice.test.ts` fails on missing API.
- [x] **3. Implement:** server-generated problem IDs and random time, persist unsolved question and counters; atomic solved transition; reuse Task 1 matching rule. Practice is available during active lesson regardless of practical completion and mode roundtrip reuses unsolved question. Target clock is intentionally sent for drawing, but verdict/hint/accessible feedback text never discloses numeric answer. Wrong answers are successful HTTP responses with `correct:false`.
- [x] **4. Green:** practice suite and domain suite pass, including exactly-once count after repeated identical check.
- [x] **5. Commit:** `feat: generate and grade unlimited clock practice`.

## Task 7: 실전 입력·배열의 저장과 판정 API

**Files:** Create `apps/server/src/progress/{service,routes}.ts`, `tests/server/progress.test.ts`; Modify contracts and progress/operation storage.

**Interfaces:** `ProgressCommand={operationId:string;expectedRevision:number;action:'save'|'check-times'|'check-order'|'return-to-reading';answers?:AnswerMap;order?:string[]}`; `ProgressResult={progress:StudentProgress;wrongTimeIds:string[];wrongOrderIds:string[]}`, `StudentProgress={studentId:string;revision:number;stage:'reading'|'ordering'|'completed';answers:AnswerMap;order:string[];completedAt:string|null}`. `ProgressService.read(session:Session):StudentSnapshot`, `apply(session:Session,command:ProgressCommand):ProgressResult`. `StudentSnapshot={lessonId:string;phase:LessonPhase;phaseRevision:number;student:{id:string;displayName:string;distinction:string};cards:Card[];progress:StudentProgress;practice:PracticeQuestion|null;solvedCount:number}`.

- [ ] **1. Failing tests:** `active_lesson_allows_practical_without_prior_practice`; `wrong_times_mark_inputs_only`; `all_eight_correct_allow_ordering`; `wrong_order_marks_card_positions_only`; `cannot_complete_with_wrong_times`; `return_to_reading_clears_completion`; `home_save_never_changes_practical_stage_or_verdict`; `duplicate_operation_replays_once_even_with_old_revision`; `changed_body_same_operation_rejected`; `two_tabs_get_conflict_and_latest_state`; `phase_changed_rejects_pending_save`; `db_failure_never_reports_success`; `refresh_reopens_saved_order`. Reject foreign/missing/repeated card IDs and client-supplied stage/complete flags.
- [ ] **2. Red:** `npm test -- tests/server/progress.test.ts` fails on missing progress service.
- [ ] **3. Implement:** register student state/progress routes. Require active lesson for new progress writes but no completed practice prerequisite; validate practical action/stage separately. Canonical server grading, update revision and operation response in one transaction. Auth/scope first, replay lookup second, new revision/phase validation third. Preserve retryable response body with input hash, never credentials. Return 409 with canonical own snapshot on conflicts. Home autosave uses `save`, not `return-to-reading`, so opening another mode preserves practical stage and completion. Save only legitimate fields and clear outdated verdict flags when edited. Distinguish HTTP validation errors from educational wrong answers.
- [ ] **4. Green:** progress, domain, auth suites pass; injected commit failure leaves no operation receipt or progress mutation.
- [ ] **5. Commit:** `feat: save and grade card reading and ordering`.

## Task 8: 역할별 실시간 스냅샷

**Files:** Create `apps/server/src/events/{hub,routes,snapshots}.ts`, `tests/server/events.test.ts`; Modify services in Tasks 3·4·6·7 and shared events contract.

**Interfaces:** `EventHub.publishCommitted(lessonId:string):void`, `subscribe(session:Session,send:(event:SnapshotEvent)=>void):()=>void`, `revoke(sessionIds:string[]):void`, `close():void`. `SnapshotEvent={type:'snapshot';data:StudentSnapshot|TeacherSnapshot}`, `TeacherSnapshot={lessonId:string;phase:LessonPhase;phaseRevision:number;students:StudentSummary[]}`, `StudentSummary={studentId:string;displayName:string;distinction:string;progressRevision:number;stage:StudentProgress['stage'];correctTimeCount:number;solvedCount:number;connected:boolean;completedAt:string|null}`. Full teacher lesson API supplies authorized completed card views; student events contain own state only.

- [ ] **1. Failing tests:** `connect_and_reconnect_send_current_snapshot`; `student_event_contains_no_peer_data`; `classroom_session_cannot_subscribe`; `rollback_emits_nothing`; `committed_update_arrives_under_2s`; `revocation_closes_open_stream`; `phase_change_during_student_save_yields_consistent_snapshot`; `expiry_closes_connection`; `multiple_tabs_keep_connected_until_last_close`.
- [ ] **2. Red:** `npm test -- tests/server/events.test.ts` fails on missing SSE hub/routes.
- [ ] **3. Implement:** `/api/events` checks role/scope and keeps session expiry enforcement while open. Send initial fresh snapshot, updates only after commit, heartbeat every 15 seconds; cleanup on close and shutdown. Connectivity is count of live authenticated student streams, not evidence of learning completion. Use no-cache headers and disable response buffering. New subscribers get full current state, not an assumed persistent process event log.
- [ ] **4. Green:** event suite and mutation suites pass; tests close all streams/server handles and preserve failing underlying exit codes.
- [ ] **5. Commit:** `feat: stream authorized lesson progress snapshots`.

## Task 9: 오락실 타이틀·이름 선택·모드 메뉴와 교사 준비 화면

**Files:** Create `apps/web/{index.html,vite.config.ts}`, `apps/web/src/{main,App}.tsx`, `apps/web/src/styles.css`, `apps/web/src/api/client.ts`, `apps/web/src/auth/{DeviceConnect,NamePicker,TeacherLogin,SessionProvider}.tsx`, `apps/web/src/student/{TitleScreen,ModeMenu}.tsx`, `apps/web/src/teacher/{LessonSetup,StudentCardEditor}.tsx`, `tests/web/{entry-flow,name-picker,lesson-setup}.test.tsx`; Modify `vitest.config.ts` for the jsdom web project.

**Interfaces:** API `request<T>(path:string,init?:RequestInit):Promise<T>` validates shared responses and attaches current CSRF token on mutations. `SessionProvider` exposes `session`, `refresh():Promise<void>`, `selectStudent(id:string):Promise<void>`, `resetStudent():Promise<void>` and session epoch. `TitleScreen({onStart,onTeacher}:{onStart:()=>void;onTeacher:()=>void})`; `NamePicker({students,onStart}:{students:RosterItem[];onStart:(id:string)=>Promise<void>})`; `RosterItem={id:string;displayName:string;distinction:string}`; `StudentMode='practice'|'practical'|'sharing'`; `ModeMenu({studentName,onSelect,onChangeName}:{studentName:string;onSelect:(mode:StudentMode)=>void;onChangeName:()=>Promise<void>})`. Modes remain separate from server lesson phases; availability follows the reviewed spec. `LessonSetup({lessonId}:{lessonId:string})` uses Tasks 4·5 endpoints. Session identity scopes all local caches and pending effects.

- [ ] **1. Failing tests:** entry screen centers '시계는 째깍! 하루는 찰칵!' with '게임을 시작하려면 아무 버튼이나 누르세요' and 'PRESS ANY BUTTON'. `tap_or_enter_advances_to_names_only`; `repeat_or_tab_does_not_skip_screen`; `teacher_button_does_not_start_student_flow`; `no_autoplay_before_gesture`; `reduced_motion_keeps_prompt_static`; `reload_starts_at_title_without_erasing_progress`. NamePicker renders '내 이름을 골라요' and 6 large buttons; a name click submits stable student ID and shows the selected name with 3 mode buttons, never auto-starts an activity. Also test `same_name_uses_distinction`; `selection_loads_that_students_eight_cards`; `switch_clears_prior_cards_and_errors`; `late_old_request_cannot_replace_new_student`; `name_setup_escapes_markup`; `teacher_replaces_example_artwork`; `code_shown_once_then_reissue_available`. Mock only network in component tests, not the component logic under test.
- [ ] **2. Red:** `npm run test:web -- tests/web/entry-flow.test.tsx tests/web/name-picker.test.tsx tests/web/lesson-setup.test.tsx` fails on missing UI. Provide React/Vite/test scaffolding only as needed for this deliverable.
- [ ] **3. Implement:** student view state is title → names → menu → selected activity; initial entry and reload show title even if server student session persists. Handle one pointer/keyboard gesture once and remove title listeners before name selection. Existing student sessions can list own classroom roster; when a name is confirmed, finish/reset the previous student session before selecting the new ID and refresh CSRF. Mode buttons use exact labels from spec and preserve selected student's saved state. Route teacher pages separately, use same-origin API/proxy and code-entry device setup; no student password/code field in NamePicker. Teacher form binds names, 8 editable cards, image upload, phase validation and code rotation. Distinct sample sets come from server seed; browser assets must not substitute one global card set. Abort pending requests and discard responses from older session epochs; never cache student snapshots in localStorage.
- [ ] **4. Green:** component suites and typecheck pass. 1024×768 title, name picker and mode menu are readable with 48px minimum targets. Arcade styling preserves Korean readability and avoids rapid flashing; teacher UI masks password and handles expired auth without clearing confirmed DB progress.
- [ ] **5. Commit:** `feat: add arcade title name selection and personal mode menu`.

## Task 10: 학생 학습 화면

**Files:** Create `apps/web/src/student/{StudentWorkspace,PracticeView,ReadingView,OrderingView,CompletedView,StudentShareView,ModeShell}.tsx`, `apps/web/src/components/{ClockFace,TimeInput,ActivityCard,Feedback,SoundToggle}.tsx`, `apps/web/src/student/useProgressDraft.ts`, `tests/web/{practice,practical,accessibility}.test.tsx`.

**Interfaces:** `ClockFace({time,hint}:{time:ClockTime;hint:'none'|'minute-hand'|'zoom'})`; `TimeInput({value,onChange,error}:{value:ClockTime|null;onChange:(v:ClockTime)=>void;error:boolean})`; `ActivityCard({card,flipped,onFlip}:{card:Card;flipped:boolean;onFlip:()=>void})`; `ModeShell({studentName,onHome,children}:{studentName:string;onHome:()=>Promise<void>;children:React.ReactNode})`; `StudentShareView({snapshot}:{snapshot:StudentSnapshot})`; `useProgressDraft(snapshot:StudentSnapshot)` returns draft, update methods, save status and `submit(action:ProgressCommand['action']):Promise<void>`. Mount hook in StudentWorkspace above the menu/activity switch so mode changes do not unmount drafts. Hook interface is extended with Task 11 recovery methods without changing command shape.

- [ ] **1. Failing tests:** `all_three_modes_are_freely_selectable`; `home_button_in_every_mode_returns_to_same_students_menu`; `return_to_menu_keeps_progress`; `home_does_not_require_correct_answers`; `home_save_failure_keeps_draft_and_offers_retry`; `offline_home_roundtrip_keeps_in_memory_draft`; `sharing_without_result_shows_guidance_not_answers`; `mode_roundtrip_does_not_reset_completion`; `wrong_practice_preserves_question_and_hints`; `correct_without_card_can_continue`; `no_answer_in_hint_or_accessible_label`; `input_click_does_not_flip_card`; `time_error_only_input_border`; `order_error_only_card_border`; `drag_and_keyboard_moves_match`; `cannot_order_before_time_check`; `completion_waits_for_server`; `return_to_reading_removes_completion`; `audio_starts_after_gesture_and_mutes`; `reduced_motion_avoids_flip_animation`.
- [ ] **2. Red:** `npm run test:web -- tests/web/practice.test.tsx tests/web/practical.test.tsx tests/web/accessibility.test.tsx` fails on missing learning UI.
- [ ] **3. Implement:** render clock via domain angles; large hour/minute buttons; positive feedback and optional matching own card; practical input and order phases with persistent randomized initial order. Use pointer events for touch ordering plus labelled move buttons for keyboard. Label periods and active student name. All modes use ModeShell with exact label '홈으로 돌아가기' in the same position, returning to menu without logout/name reset. Preserve drafts above view switch; flush `save` on online home navigation, offer retry/discard on write failure, allow offline return with retained draft and warning. StudentShareView shows only own complete result or exact guidance '실전모드에서 일과표를 완성해 주세요'. Dirty input clears only its prior error. Display save state, debounce autosave 400ms, serialize writes and include latest draft in explicit check operation; disable duplicate submits while pending. No optimistic completion.
- [ ] **4. Green:** UI tests and domain tests pass, including all 24 clock positions and color-independent feedback. Screens work at 1024×768 and 390×844 without hidden essential controls.
- [ ] **5. Commit:** `feat: teach clock reading and personal card ordering`.

## Task 11: 교사 진행·공유 화면과 연결 복구

**Files:** Create `apps/web/src/realtime/{useSnapshot,merge}.ts`, `apps/web/src/teacher/{Dashboard,ShareView,LessonHistory}.tsx`, `apps/web/src/student/ConnectionStatus.tsx`, `tests/web/recovery.test.tsx`, `tests/e2e/{classroom,recovery}.spec.ts`, `tests/helpers/browser.ts`, `playwright.config.ts`; Modify Task 9 session/provider and Task 10 draft hook.

**Interfaces:** `mergeStudentSnapshot(current:StudentSnapshot,incoming:StudentSnapshot):StudentSnapshot` never regresses either applicable revision; `useSnapshot(scope:{role:'student'|'teacher';lessonId:string;studentId?:string;epoch:number})` returns snapshot and connection state, cleans old streams on scope change. `useProgressDraft` adds `recover():Promise<void>`, `discardDraft():void`, `reapplyDraft():Promise<void>`. `Dashboard({lessonId}:{lessonId:string})` renders TeacherSnapshot; ShareView retrieves only teacher-authorized completed card sets.

- [ ] **1. Failing tests:** 7 contexts assert selected names get distinct own cards, six independent progress states and teacher update within 2000ms. `students_can_use_different_modes_concurrently`; `teacher_share_does_not_force_student_navigation`; `home_roundtrip_keeps_selected_student_and_draft`; `switch_closes_old_sse_and_ignores_old_feedback`; `teacher_can_share_completed_student_only`; `incomplete_sharing_does_not_mark_complete`; `saved_response_lost_retries_same_operation_once`; `older_snapshot_cannot_rollback_new_phase`; `offline_draft_survives_in_memory`; `conflict_requires_discard_or_reapply`; `ended_lesson_prevents_reapply`; `reload_restores_only_confirmed_state`; `server_restart_restores_progress`. Browser fixture controls real HTTP server and uses isolated DB, never production data.
- [ ] **2. Red:** `npm run test:web -- tests/web/recovery.test.tsx` and `npm run test:e2e -- tests/e2e/classroom.spec.ts tests/e2e/recovery.spec.ts` demonstrate missing real-time/recovery behavior.
- [ ] **3. Implement:** native EventSource authenticated cookies, scope-aware cleanup, commit-only dashboard progress and selected complete student's large timeline. Offline disables new verdicts, preserves draft, explains unsaved refresh loss, but home/mode menu navigation retains in-memory drafts. Recovery replays uncertain operation first, then fetches snapshot; same revision submits pending draft, conflict presents explicit options, ended/changed lesson disallows reapply. Connection state is distinct from completion and saving. Teacher lesson ending has incomplete warning and confirmations; opening a student's timeline never sends a student navigation command.
- [ ] **4. Green:** component and E2E suites pass in Chromium and WebKit, tests actually execute for 6 student contexts plus teacher. Verify response-loss scenarios with aborted responses after real server commit, not fabricated progress states.
- [ ] **5. Commit:** `feat: share live classroom progress and recover interrupted sessions`.

## Task 12: 제품 실행·운영 명령·최종 검증

**Files:** Create `apps/server/src/{main,shutdown}.ts`, `apps/server/src/cli/{seed-demo,teacher-password,backup}.ts`, `tests/server/operations.test.ts`, `tests/e2e/production.spec.ts`, `.github/workflows/ci.yml`, `.env.example`; Modify `README.md`, `docs/IMPLEMENTATION_CHECKLIST.md`, root npm scripts and workspace build configs.

**Interfaces:** `startServer(config:Config):Promise<{url:string;close():Promise<void>}>`; Config includes `port`, `host`, `publicOrigin`, `dbPath`, `uploadDir`, `teacherPassword?`, `secureCookies`, `keyPath`. Runtime env names: `PORT`(3000), `HOST`(127.0.0.1), `SIJONG_PUBLIC_ORIGIN`, `SIJONG_DATA_DIR`(.local), `SIJONG_TEACHER_PASSWORD`(initial bootstrap only). `backupStore(store:Store,targetDir:string):Promise<{dbFile:string;manifestFile:string}>` uses SQLite backup API and a consistent asset/key manifest; backup dir is private and outside web roots. Admin password command reads new secret from environment or masked stdin, never CLI arguments/logging.

- [ ] **1. Failing tests:** `production_serves_spa_and_health`, `unknown_api_is_json_404`, `bootstrap_missing_password_fails`, `existing_db_does_not_reset_password`, `graceful_close_releases_sse_and_db`, `backup_reopens_with_images_and_key`, `delete_lesson_keeps_other_references`, `seed_does_not_destroy_real_lesson`, `production_cookie_requires_https_origin`. Use external test fixtures for credentials, never committed usable credentials.
- [ ] **2. Red:** run `npm test -- tests/server/operations.test.ts` and production E2E against built app; confirm failures are missing behavior, not a silently skipped build or zero tests.
- [ ] **3. Implement:** production server serves Vite build with API before SPA fallback, JSON 404 for unknown APIs, writable storage checks, no secret logs. Admin CLI safely seeds examples, changes password and revokes teacher sessions, writes restorable backup; refuse concurrent destructive admin operations. Back up image set and key consistently with database snapshot, either while stopped or under a coordinated exclusive write barrier. CI uses Node 24, npm ci, typecheck, tests, build, Playwright browser installs and meaningful E2E. `.env.example` contains names and nonsecret defaults, no credentials. README provides beginner steps for teacher setup, example-to-real image replacement and device name selection; deployment instructions state HTTPS/persistent disk/single process.
- [ ] **4. Green and actual run:** from repo root, run `npm ci`, `npm run typecheck`, `npm test`, `npm run test:web`, `npm run build`, `npm run test:e2e`. Start the built server with temporary synthetic configuration, GET health and run representative teacher-device-name-practice-practical-share flow. Run backup→restore→login→image read against a separate temp directory. Stop only started processes and verify Git diff for unintended files. Record exact executed/passed/failed/skipped counts; no readiness claim for unrun required checks.
- [ ] **5. Document, persist and commit:** update implementation checklist only for demonstrated behaviors, keeping student usability and 40-minute classroom rehearsal unchecked. Save tested cloud `install_script` and `start_skill` using configuration tools; startup includes working directory, Node activation, credential initialization and health check, and reuse of current checkout with no worktree. Check existing bindings by presence/name before requiring local teacher credential setup; never put secrets in scripts. Proxy-injected network secrets must not be treated as raw local password values. Require no new external account for synthetic validation. Commit `feat: document and verify the runnable classroom app` after all relevant checks; report current-instance validation separately from configuration publication and actual classroom deployment.

## 설계와 계획의 대응

각 설계 요구사항의 구현 위치를 아래 표로 대조한다. 제품 문구·README·이용자 설명은 한국어를 사용한다.

| 설계 절 | 구현 Task |
| --- | --- |
| 1·2 목적·범위와 예시 그림으로 시작 | 2, 4, 9, 12 |
| 3 구조·버전·책임 | 1, 2, 8, 12 |
| 4 이름 선택·학습·접근성 | 1, 3, 6, 7, 9, 10, 11 |
| 5 교사 준비·전환·공유 | 4, 5, 9, 11 |
| 6 데이터·시간·삭제·백업 | 1, 2, 4, 5, 7, 12 |
| 7 API와 범위 검사 | 3, 4, 5, 6, 7, 8 |
| 8 접속·개인정보·이미지 | 3, 5, 9, 12 |
| 9 중복·충돌·단절 복구 | 7, 8, 11, 12 |
| 10 검증·완료 기준 | 각 Task의 Red/Green, 11, 12 |
| 11 실행·재현·설정 저장 | 1, 2, 12 |

## 실행 전 검토

이 계획은 실제 제품 코드가 아니다. 검토 후 사용자가 실행 방식을 선택한다. 권장 방식은 이 세션에서 같은 담당자가 Task 1~12를 순서대로 구현하고 마지막에 전체 변경을 별도 검토하는 Native이며, 이유는 인증·저장·실시간·화면이 같은 계약에 의존하므로 맥락을 유지하는 편이 적합하기 때문이다. 대안은 task마다 구현·검토 에이전트를 따로 두고 마지막에도 전체를 검토하는 방식으로 추가 비용이 든다. 실행 방식 선택 없이 agent를 만들거나 구현에 착수하지 않는다.

실행 시에는 승인된 spec과 이 계획을 함께 읽고 작업별 테스트 실패·통과와 commit을 기록한다. 새로운 기능 요구나 실제 배포 요청이 생기면 현재 구현 범위와 분리하여 사용자와 확인한다.
