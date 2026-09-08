# LTI embedded question authentication

This note records the intentionally simplified authentication and availability design for Canvas-embedded HelpMe questions.

## Current design

A HelpMe question linked into Canvas uses the ordinary HelpMe LTI launch and ordinary HelpMe LTI application session. There is no second question-scoped JWT, no second resource cookie, and no separate resource-auth controller or guard.

The flow is:

1. Canvas launches HelpMe through LTI and sends a signed ID token.
2. HelpMe verifies the LTI launch through the existing middleware.
3. For a question launch, HelpMe additionally verifies that the launch is from the configured Canvas client, maps the signed Canvas course ID to the HelpMe course, parses the signed `helpme_question_id`, and verifies that the question belongs to that mapped HelpMe course.
4. HelpMe then uses the existing main LTI identity path to find the HelpMe user.
5. If that user is not yet enrolled in the mapped HelpMe course, the existing LTI flow enrolls them as a student.
6. HelpMe issues the normal `lti_auth_token` application-session cookie and redirects the iframe to the selected question.
7. Question and feedback requests use the existing JWT and course-role guards. Feedback is always stored against the authenticated HelpMe `userId`.

The URL course ID and question ID are navigation inputs, not authorization. Course membership is rechecked by the normal course-role guard, and the question lookup remains scoped to the course.

## Canvas trust configuration

Each HelpMe environment is pinned to one Canvas registration through:

```text
LTI_CANVAS_CLIENT_ID
```

`assertTrustedCanvasPlatform` requires the verified LTI token's client ID to match this value. Missing configuration fails closed. The LTI library verifies the token signature before HelpMe relies on the launch claims.

For local development, follow [Test HelpMe questions in local Canvas](LOCAL_CANVAS_SETUP.md).

## Session lifetime: 5 hours, not 10 hours

The embedded-question flow originally considered a longer 10-hour session. The current decision is a **5-hour LTI application session**.

Five hours is intentionally long enough for a normal quiz/exam session, including students moving among several embedded questions, while reducing the time a copied browser credential remains useful compared with a 10-hour session. All LTI session issuance paths use the same 5-hour lifetime, enforced with the standard JWT `exp` claim.

This is a product/security tradeoff, not a Canvas deadline. Canvas remains responsible for whether the quiz itself is available.

## Multi-question quiz assumption to confirm with the professor

The expected course design is approximately one HelpMe LTI embed per Canvas quiz question. A ten-question quiz can therefore contain ten HelpMe embeds.

Our working assumption is that loading each embedded external-tool question causes Canvas to perform the normal LTI launch for that resource. Repeated launches are acceptable for the current MVP because each successful launch simply re-establishes the same ordinary HelpMe LTI session and routes the student to the selected question.

This assumption should be confirmed with the professor in the real target Canvas quiz configuration. We are deliberately not adding a second resource-token system merely to optimize repeated question launches before that workflow proves it is necessary.

## Existing HelpMe account assumption

The MVP assumes quiz students already have HelpMe accounts that the existing LTI identity flow can match.

If a student reaches an embedded question before their HelpMe account is ready, the existing HelpMe login/registration flow can be completed and the student can reopen the Canvas quiz/question to trigger a fresh LTI launch. Exact-question return-through-registration machinery is intentionally deferred until the real course workflow demonstrates that it is needed.

## Accepted same-course question access tradeoff

The learner UI does **not** list all embeddable questions. However, once a student has a valid HelpMe LTI session and is enrolled in the HelpMe course, a technically knowledgeable student could manually change the question ID in an API request and retrieve another student-visible embeddable question from the same course.

For the current low-stakes self-assessment use case, this is an explicit MVP tradeoff accepted in exchange for deleting the separate per-question authentication system. The server still blocks questions from other HelpMe courses, and the learner response never exposes grading criteria. Revisit exact per-question authorization only if the professor considers early access to another question unacceptable or the assessments become higher stakes.

## Criteria are hidden from the student response

`criteriaText` is grading configuration and must not be returned by the student-accessible single-question endpoint.

The single-question response exposes only the fields the embedded learner UI needs:

- question ID
- course ID
- question text
- minimum sentence guidance
- maximum sentence guidance

The staff-only course question list still returns the complete question model so professors and TAs can create and edit grading criteria. The grading service also loads the complete server-side model when it builds the grading prompt.

## JWT purposes remain explicit

Normal HelpMe and LTI application sessions carry `kind: "app-auth"`. The normal JWT strategy accepts only that kind and a positive safe-integer `userId`.

The short token exchanged by `/login/entry` carries `kind: "login-entry"` and is accepted only by the login-entry exchange.

The old `embeddable-resource` credential family is no longer part of the embedded-question runtime flow. There is no compatibility path for it because this branch has not been deployed.

All application sessions rely on the standard JWT `exp` claim generated by the JWT library.

## Course mapping

Question launches still require an existing Canvas-course-to-HelpMe-course mapping. The signed Canvas course ID is resolved through the existing `LMSCourseIntegrationModel` mapping.

One-click LTI-only course mapping remains deferred. The existing LMS integration record also represents Canvas API configuration, so silently creating that record from an LTI launch would mix course identity with API authorization. Revisit that product decision separately if the professor needs a one-click setup flow.

## Question and rubric versioning is Git-only

Approved question text, criteria, instructions, sentence limits, and grading-profile definitions (`policyKind`, `systemPrompt`, `allowedScores`, `reasonCodes`) are versioned by checking them into Git alongside the reviewed code/prompt version. The Git-versioned prompt defaults live in `packages/common`; record any approved course-specific question/profile values in Git in the same change that reviews them.

This is deliberately simple: there is no exporter, framework, or version table. Staff UI edits write to the mutable `EmbeddableQuestionModel` / `EmbeddableGradingProfileModel` rows and are not automatically Git-versioned. Feedback rows in `EmbeddableQuestionFeedbackModel` store the submission, score, comment, and reasons, but do not capture a historical snapshot of the question text, criteria, or profile/prompt in effect at grading time.

## Deadline decision for the MVP

HelpMe does not currently receive a sufficiently trusted per-question or quiz deadline from the nested external-tool launch used by this placement. We therefore do **not** add HelpMe-side deadline enforcement in this MVP.

Canvas controls quiz visibility and availability. HelpMe controls only the 5-hour application-session lifetime. If a session expires while the quiz is still legitimately available, the student reopens the Canvas quiz/question and receives a fresh verified LTI launch.

Do not restore per-question `availableFrom` / `availableUntil` fields merely to duplicate Canvas settings. If the professor later requires HelpMe to enforce a deadline, first verify the real launch claims. If Canvas does not provide a trustworthy effective deadline, prefer one assessment-level HelpMe deadline shared across the embedded questions rather than ten duplicated per-question deadlines.

## Verification to do with the professor / real Canvas course

Before production use, verify the actual target quiz behavior rather than building more authentication machinery from assumptions:

- Confirm that each embedded HelpMe question receives a fresh signed LTI launch when loaded.
- Confirm that a normal ten-question quiz can move among embedded questions without requiring manual HelpMe login.
- Confirm that a student whose 5-hour HelpMe session expires can reopen the Canvas question and continue through a fresh launch.
- Confirm whether the accepted same-course question access tradeoff is appropriate for this self-assessment.
- Capture only the non-sensitive claim names needed to determine whether Canvas supplies a trustworthy effective quiz/resource deadline. Do not log names, email addresses, ID tokens, or session tokens.
- Confirm that students cannot retrieve `criteriaText` from the single-question API while staff can still edit criteria through the staff-only question-management flow.

## Testing principle

Tests for this flow should protect externally meaningful behavior: a verified mapped question launch should establish the ordinary HelpMe session and land on the selected question; an enrolled student should be able to load and submit that question; outsiders and cross-course question IDs should be rejected; and the learner response must not expose grading criteria.

Avoid tests whose only purpose is to mirror JWT payload construction, cookie-name helpers, or private implementation structure.
