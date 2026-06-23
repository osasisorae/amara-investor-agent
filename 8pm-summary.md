# 8pm Summary

Context: audit performed against the current local codebase on `main` after the latest tested changes. Line numbers below refer to the current files in this workspace.

## 1. Prompting

### Prompt inventory

- `lib/agent/prompts.ts:1-15` defines `OUTREACH_EMAIL_PROMPT`.
- `lib/agent/prompts.ts:17-53` defines `QUALIFICATION_PROMPT`.
- `lib/agent/prompts.ts:55-68` defines `DEAL_ROOM_PROMPT`.
- `lib/agent/prompts.ts:70-85` defines `KYC_GUIDANCE_PROMPT`.
- `lib/agent/prompts.ts:87-97` defines `getSystemPromptForStage(stage)`.
- `lib/agent/orchestrator.ts:295-317` defines `buildToolPrompt(stage)`, which dynamically wraps the deal-room and agreement-stage prompts with operational rules.

### Static vs dynamic

- The base prompts in `lib/agent/prompts.ts` are static multiline strings.
- The only dynamically constructed runtime prompt is `buildToolPrompt(stage)` in `lib/agent/orchestrator.ts:295-317`.
- `buildToolPrompt('deal_room')` interpolates `getSystemPromptForStage('deal_room')` and appends tool-use instructions.
- The agreement-stage prompt in `buildToolPrompt()` is a separate hardcoded string, not sourced from `lib/agent/prompts.ts`.

### Separate prompts per stage or one global prompt?

- There is not one global prompt.
- The codebase has separate prompt families for:
  - qualification: `QUALIFICATION_PROMPT` in `lib/agent/prompts.ts:17-53`
  - deal room: `DEAL_ROOM_PROMPT` in `lib/agent/prompts.ts:55-68`
  - KYC guidance: `KYC_GUIDANCE_PROMPT` in `lib/agent/prompts.ts:70-85`
  - tool-driven deal room: `buildToolPrompt('deal_room')` in `lib/agent/orchestrator.ts:295-309`
  - tool-driven agreement stages: `buildToolPrompt('agreement_pending')` in `lib/agent/orchestrator.ts:311-317`
- Important nuance: `QUALIFICATION_PROMPT` exists, but after the latest refactor the qualification flow no longer calls Qwen at runtime. The active qualification experience is deterministic code in `lib/agent/orchestrator.ts:397-529` and `lib/agent/orchestrator.ts:1120-1196`.
- `OUTREACH_EMAIL_PROMPT` also exists but is not referenced by runtime code. A repository-wide search only finds its definition.

### What context is injected into each prompt?

- Plain Qwen calls use `system prompt + conversation history + current user message`.
  - `lib/qwen/client.ts:154-168` (`callQwenWithSystemPrompt`) constructs messages as:
    - system message
    - mapped conversation history
    - current user message
- Tool-loop Qwen calls use `system prompt + conversation history + current user message + tool outputs`.
  - `lib/agent/orchestrator.ts:637-649` builds the initial message list.
  - `lib/agent/orchestrator.ts:668-728` appends the assistant tool calls and the tool results back into the transcript before the next Qwen call.
- Conversation history comes from `lib/db/messages.ts:46-53`.
  - Only `role` and `content` are passed back to Qwen.
  - `messages.metadata` is not passed back to Qwen, so structured UI payloads are lost; the model only sees fallback strings like `[ui:deal_card] Deal room overview`.
- Knowledge base context is not injected into the prompt itself.
  - It enters the model context only as a tool result from `search_knowledge_base`.
  - See `lib/agent/orchestrator.ts:832-838` and `lib/knowledge-base/loader.ts:129-168`.
- Lead data is barely injected into prompts.
  - Current runtime prompts do not include lead fields like `country`, `qualified_at`, `kyc_submitted_at`, or qualification summaries.
  - `appUrl` exists in `ProcessMessageContext` (`lib/agent/orchestrator.ts:213-215`), but it is used only inside tool execution for links/emails, not in the prompt text.

### What is missing or weak in the prompting strategy?

- Qualification prompting is effectively dead code:
  - `QUALIFICATION_PROMPT` exists, but runtime qualification is now deterministic string generation in `lib/agent/orchestrator.ts:1120-1196`.
  - This makes the prompt inventory look richer than the actual runtime behavior.
- There is no prompt-level injection of structured investor context:
  - no explicit lead profile
  - no audit summary
  - no prior qualification answers as structured state
  - no current document-upload state
- Later stages are under-modeled:
  - `agreement_pending`, `agreement_signed`, `payment_pending`, and `closed` all route through the same prompt/tool profile in `lib/agent/orchestrator.ts:571-583`.
- The deal-room prompt tells the model to use KB results, but there is no citation format, no source-quoting discipline, and no enforcement beyond instructions.
- The model never sees structured UI metadata from previous emissions, only fallback text markers from `messages.content`.

## 2. Agentic Techniques

### Is Qwen used with tool definitions or plain chat completions?

- Both patterns exist.
- Plain chat completion is used in:
  - `lib/agent/orchestrator.ts:549-567` for `kyc_intake` via `callQwenWithSystemPrompt()`
  - `lib/qwen/client.ts:134-168` provides the plain-call helper
- Tool/function calling is used in:
  - `lib/agent/orchestrator.ts:629-752` (`runToolConversation`)
  - This is used for `deal_room` and all agreement-related stages.
- Qualification currently does not call Qwen:
  - `lib/agent/orchestrator.ts:397-529` handles qualification entirely in code using `assessQualificationResponse()`.

### Tool definitions that exist

| Tool name | Definition lines | Parameters | What it actually executes |
| --- | --- | --- | --- |
| `send_email` | `lib/agent/orchestrator.ts:83-100` | `to`, `subject`, `body` | Validates recipient is either the lead email or `ADMIN_ALERT_EMAIL`, then sends through Resend via `sendEmail()` in `lib/agent/orchestrator.ts:763-786` and `lib/email/resend-client.ts:18-38`. |
| `update_lead_stage` | `lib/agent/orchestrator.ts:101-118` | `newStage` enum from `LEAD_STAGES` | Updates `leads.stage` in Turso via `updateLeadStage()` and, if the new stage is `deal_room`, also calls `markLeadQualified()`; see `lib/agent/orchestrator.ts:789-808`. |
| `log_audit_event` | `lib/agent/orchestrator.ts:119-140` | `eventType`, optional `metadata` | Inserts an `audit_events` row via `logAuditEvent()`; see `lib/agent/orchestrator.ts:810-829` and `lib/db/audit.ts:32-56`. |
| `search_knowledge_base` | `lib/agent/orchestrator.ts:141-155` | `query` | Runs `searchKnowledgeBaseStructured(query)` over local markdown files in `knowledge-base/`; see `lib/agent/orchestrator.ts:832-838` and `lib/knowledge-base/loader.ts:129-168`. |
| `flag_for_human_review` | `lib/agent/orchestrator.ts:156-170` | `reason` | Moves lead to `pending_human_review`, logs an audit event with a fingerprint, and emails the admin inbox if `appUrl` is available; see `lib/agent/orchestrator.ts:840-881`. |
| `unlock_agreement` | `lib/agent/orchestrator.ts:171-183` | no params | Verifies `lead.kyc_approved === 1` and `approved_by` are set, then returns an agreement link; see `lib/agent/orchestrator.ts:884-899`. |
| `emit_ui_component` | `lib/agent/orchestrator.ts:184-210` | `component`, `data` | Validates the component type, normalizes default data, and returns an agent emission with fallback text plus `messages.metadata`; see `lib/agent/orchestrator.ts:901-919`. |

### Does the orchestrator run a tool-call loop or one shot?

- It runs a real tool loop for tool-enabled stages.
- `lib/agent/orchestrator.ts:659-731` does:
  - call Qwen with tools
  - inspect `tool_calls`
  - execute each tool locally
  - append the tool output into the conversation
  - call Qwen again
- The loop retries for up to 6 iterations.
- If Qwen returns no tool calls, the orchestrator emits the assistant text plus any pending UI emissions and returns (`lib/agent/orchestrator.ts:674-701`).
- If the loop never terminates cleanly, a fallback response is emitted (`lib/agent/orchestrator.ts:734-751`).

### Can the agent initiate actions without an investor message?

- No true autonomy exists.
- The primary entry point is `app/api/chat/[leadId]/route.ts:145-216`.
  - Every agent turn begins with an HTTP POST carrying an investor message.
  - `orchestrator.processMessage()` immediately saves the investor message in `lib/agent/orchestrator.ts:321-335`.
- Side effects outside investor chat are triggered by admin or workflow endpoints, not by a background agent:
  - KYC approval email: `app/api/admin/kyc/[leadId]/route.ts:41-77`
  - OTP email: `app/api/agreement/[leadId]/otp/route.ts:37-70`
  - payment instructions email: `app/api/agreement/[leadId]/sign/route.ts:116-129` calling `lib/payment.ts:62-114`
- There is no scheduler, queue worker, cron, or autonomous retry/follow-up process in the code inspected.

### Honest verdict: chatbot with memory or real agent?

- Honest verdict: this is a stageful chatbot with some agentic mechanics, not a fully autonomous agent.
- Why it is more than a basic chatbot:
  - it has persisted memory in Turso
  - it has explicit stage routing
  - it has a multi-step tool-call loop for deal room and agreement stages
  - it can take actions like sending email, updating stage, logging audit events, and emitting UI
- Why it is still not a "real agent" in the stronger sense:
  - it only reacts to inbound messages or admin endpoints
  - it has no planner, task queue, or background autonomy
  - qualification is deterministic rules, not deliberative reasoning
  - prompt and tool behavior are heavily stage-scripted

## 3. Generative UI

### How UI components are emitted as messages

- The component catalog lives in `lib/chat/components.ts:12-229`.
- Component emission from the orchestrator happens through `emitComponentMessage()` in `lib/agent/orchestrator.ts:937-950`.
  - `content` is a plain fallback string like `[ui:deal_card] Deal room overview`
  - `metadata` is a JSON object from `createComponentMetadata()`
- Messages are saved to Turso with `metadata` serialized as JSON in `lib/db/messages.ts:13-27`.
- When chat data is loaded, `toChatMessage()` parses `messages.metadata` and sets `type` accordingly in `lib/chat/messages.ts:17-26`.
- The frontend renderer then switches on `message.type` in `app/chat/[leadId]/page.tsx:500-535`.

### Component types that exist

- `deal_card` in `lib/chat/components.ts:21-27`
- `document_list` in `lib/chat/components.ts:35-39`
- `pipeline_status` in `lib/chat/components.ts:46-51`
- `kyc_prompt` in `lib/chat/components.ts:53-61`
- These are declared centrally in `lib/chat/components.ts:12-19`.

### Is the component type stored in `messages.metadata`?

- Yes.
- Schema-level storage:
  - `migrations/001_initial_schema.sql:31-39` gives `messages` a `metadata TEXT` column
- Runtime serialization:
  - `lib/db/messages.ts:21-27`
- Runtime parsing:
  - `lib/chat/messages.ts:17-26`
  - `lib/chat/components.ts:196-229`

### Is the agent deciding when to emit components via tool calls, or is the frontend hardcoding them?

- Mixed implementation.
- Model-driven component emission exists:
  - `emit_ui_component` tool in `lib/agent/orchestrator.ts:184-210`
  - tool execution path in `lib/agent/orchestrator.ts:901-919`
  - deal-room prompt instructions explicitly tell Qwen when to call it in `lib/agent/orchestrator.ts:299-307`
- Hardcoded component emission also exists:
  - initial deal-room entry emits `deal_card` and `pipeline_status` via `buildDealRoomWelcomeSequence()` in `lib/agent/orchestrator.ts:953-967`
  - transition into `kyc_intake` auto-emits `pipeline_status` and `kyc_prompt` in `lib/agent/orchestrator.ts:970-995`
  - KYC submission PATCH auto-emits `pipeline_status` directly from the API route in `app/api/kyc/[leadId]/upload/route.ts:136-152`
- The frontend does not decide when to show these components beyond rendering received `message.type`.
  - It renders what the backend persisted in `app/chat/[leadId]/page.tsx:500-535`.

### What is broken or incomplete about the current generative UI implementation?

- It is only partially generative.
  - The biggest components are still emitted by backend code, not chosen by the model:
    - `deal_card` on qualification pass
    - `pipeline_status` on deal-room entry
    - `pipeline_status` on KYC submission
    - `kyc_prompt` on `kyc_intake`
- The model never sees structured component payloads in memory.
  - `getConversationHistory()` only returns `content` text, not `metadata`; see `lib/db/messages.ts:46-53`.
  - Qwen therefore sees `[ui:deal_card] Deal room overview`, not the actual SPV fields or pipeline data.
- Stage/state recovery depends on fallback marker strings.
  - `app/api/chat/[leadId]/route.ts:49-56` infers `deal_room` from strings like `[ui:deal_card]`
  - `app/api/admin/leads/route.ts:173-180` does the same
- Metadata validation is shallow.
  - `parseUIComponentMetadata()` in `lib/chat/components.ts:196-229` only checks `component` is valid and `data` is an object.
  - It does not validate required fields inside `data`.
- `document_list` is prompt-driven but not guaranteed.
  - The system prompt asks Qwen to emit it, but no deterministic server-side guard enforces that after due-diligence answers.
- The pipeline visualization is not aligned with the full stage model.
  - `PIPELINE_STAGES` in `lib/chat/components.ts:75-84` omits `kyc_rejected`, `agreement_signed`, and `disqualified`, even though `LeadStage` in `lib/db/leads.ts:4-15` includes them.
- KYC upload UI state is local-only.
  - `uploadedDocs` exists only in React state at `app/chat/[leadId]/page.tsx:194-195`.
  - Refreshing the page loses the uploaded checkmarks even though `kyc_documents` persist in the database.

## 4. Memory and State

### What persists across sessions and where?

- `leads` table: overall pipeline state and timestamps
  - schema: `migrations/001_initial_schema.sql:7-28`
  - accessors: `lib/db/leads.ts:17-248`
- `messages` table: full chat history plus `metadata`
  - schema: `migrations/001_initial_schema.sql:31-39`
  - accessors: `lib/db/messages.ts:4-54`
- `qualification_answers` table: per-question screening answers
  - schema: `migrations/001_initial_schema.sql:45-57`
  - accessors: `lib/db/qualification.ts:5-62`
- `kyc_documents` table: uploaded document metadata
  - schema: `migrations/001_initial_schema.sql:59-72`
  - write path: `app/api/kyc/[leadId]/upload/route.ts:59-67`
- `audit_events` table: workflow audit trail
  - schema: `migrations/001_initial_schema.sql:74-93`
  - accessors: `lib/db/audit.ts:4-72`
- `otp_codes` table: signing verification codes
  - schema: `migrations/001_initial_schema.sql:111-125`
  - accessors: `lib/db/otp.ts:5-80`
- `offeree_register` table: admin pre-activation registry
  - schema: `migrations/001_initial_schema.sql:95-109`
  - route usage: `app/api/admin/offeree/route.ts:27-90`
- `admin_users` table exists in schema (`migrations/001_initial_schema.sql:127-145`) but no runtime auth/session usage was found in the app code inspected.

### Is conversation history passed back to Qwen on every message?

- For tool-loop stages (`deal_room`, agreement stages): yes.
  - `lib/agent/orchestrator.ts:637-649` loads prior history and includes it in the next Qwen call.
- For `kyc_intake`: yes.
  - `lib/agent/orchestrator.ts:553-563` loads prior history and passes it to `callQwenWithSystemPrompt()`.
- For qualification: no.
  - The current qualification flow does not call Qwen; it operates on saved answers and deterministic prompts in `lib/agent/orchestrator.ts:397-529`.
- Important limitation:
  - conversation history passed to Qwen is text-only, because `lib/db/messages.ts:46-53` drops structured metadata.

### How is lead stage used to route agent behavior?

- Stage routing is centralized in `lib/agent/orchestrator.ts:356-378`.
- Current behavior by stage:
  - `outreach_sent`, `qualifying` -> deterministic qualification flow
  - `disqualified` -> note-interest follow-up flow
  - `deal_room` -> tool loop with KB search and UI emission
  - `kyc_intake` -> plain Qwen guidance
  - `agreement_pending`, `agreement_signed`, `payment_pending`, `closed` -> one shared agreement-stage tool loop
  - `pending_human_review`, `kyc_rejected` -> frozen/static responses via `getFrozenStageMessage()` in `lib/agent/orchestrator.ts:381-395`
- The chat API also mutates stage by inferring it from past messages:
  - `app/api/chat/[leadId]/route.ts:23-81`
  - `app/api/chat/[leadId]/route.ts:127-128`
  - `app/api/chat/[leadId]/route.ts:165-166`

### Gaps where state is lost or not consulted

- Stage reconciliation is brittle and message-derived.
  - `app/api/chat/[leadId]/route.ts:23-81` can rewrite `leads.stage` based on message text or `[ui:...]` fallback markers.
  - `app/api/admin/leads/route.ts:156-193` and `app/api/admin/leads/route.ts:319-340` also infer effective stage from message text.
- Structured UI state is not part of the model memory.
  - `messages.metadata` persists, but `getConversationHistory()` does not expose it to Qwen.
- The UI does not rehydrate uploaded KYC document state from the database.
  - `uploadedDocs` is local-only in `app/chat/[leadId]/page.tsx:194-195` and built only from current-session uploads in `app/chat/[leadId]/page.tsx:330-366`.
- Investor access recovery uses email lookup only.
  - `app/api/chat/access/route.ts:4-28` returns a `leadId` based solely on email; there is no investor authentication or signed-link check.
- Payment commitment is reconstructed from the `ticket_size` qualification answer rather than a dedicated commitment record.
  - `lib/payment.ts:36-56`
- Demo-mode document URLs may persist fake storage paths if blob credentials are absent.
  - `app/api/kyc/[leadId]/upload/route.ts:45-57`

## 5. What needs to be fixed for a credible hackathon demo

### Highest impact

1. Add real admin authentication and remove hardcoded operator identity.
   - `next-auth` is installed in `package.json:20` but unused.
   - The admin dashboard hardcodes operator email values in the client:
     - `app/admin/page.tsx:61-69`
     - `app/admin/page.tsx:113-120`
     - `app/admin/page.tsx:160-166`
     - `app/admin/page.tsx:205-210`
   - The server trusts caller-supplied admin identity with no auth guard:
     - `app/api/admin/offeree/route.ts:14-20`
     - `app/api/admin/kyc/[leadId]/route.ts:13-18`
     - `app/api/admin/payment/[leadId]/route.ts:11-18`
   - A judge reading this will immediately classify the admin side as demo-only.

2. Remove message-text stage inference and rely on explicit state transitions.
   - Chat route stage repair is currently based on strings like `you're in` and `[ui:deal_card]`:
     - `app/api/chat/[leadId]/route.ts:23-81`
   - Admin summary reconstructs stage the same way:
     - `app/api/admin/leads/route.ts:156-193`
   - This already caused real corruption during testing and remains the most fragile part of the state model.

3. Strengthen the qualification engine beyond regex and binary parsing.
   - Runtime qualification is not an LLM-driven reasoning step anymore.
   - It relies on keyword parsing and hardcoded transitions in:
     - `lib/agent/qualification.ts:1-186`
     - `lib/agent/qualification.ts:220-358`
     - `lib/agent/orchestrator.ts:397-529`
   - For a judge asking nuanced eligibility questions, this will feel scripted rather than intelligent.

### High impact

4. Make generative UI genuinely agent-driven instead of half hardcoded.
   - Hardcoded welcome/transition UI:
     - `lib/agent/orchestrator.ts:953-995`
     - `app/api/kyc/[leadId]/upload/route.ts:136-152`
   - Only some UI is genuinely chosen by the model through `emit_ui_component`.
   - If the product claim is "generative UI", the current implementation is not yet defensible end to end.

5. Improve retrieval quality and provenance in the deal room.
   - KB search is a local keyword matcher over two markdown files:
     - `lib/knowledge-base/loader.ts:25-42`
     - `lib/knowledge-base/loader.ts:129-168`
   - No citations are shown to the investor.
   - No document chunk IDs or source links are returned.
   - A serious diligence question could easily expose the limits of the current retrieval.

6. Give the model structured memory instead of fallback UI marker text.
   - Current Qwen history drops metadata:
     - `lib/db/messages.ts:46-53`
   - This means the model cannot reason over actual component payloads, only strings like `[ui:document_list] Investor documents`.
   - It also couples UI memory to brittle string matching.

### Medium impact

7. Rehydrate KYC upload state from the server.
   - UI loses the list of uploaded documents on refresh because `uploadedDocs` is React-only:
     - `app/chat/[leadId]/page.tsx:194-195`
     - `app/chat/[leadId]/page.tsx:330-366`
   - The DB already has `kyc_documents`, so the page should fetch and reflect persisted uploads.

8. Remove or clearly isolate demo-mode storage behavior.
   - KYC uploads silently fall back to fake URLs when `BLOB_READ_WRITE_TOKEN` is absent:
     - `app/api/kyc/[leadId]/upload/route.ts:45-57`
   - Judges tend to ask whether uploads are real; the current answer is "sometimes no."

9. Split the late-stage prompt/tool logic by actual stage.
   - `agreement_pending`, `agreement_signed`, `payment_pending`, and `closed` all share the same handler:
     - `lib/agent/orchestrator.ts:371-375`
     - `lib/agent/orchestrator.ts:571-583`
   - This is likely to produce awkward or inaccurate replies after the agreement is already signed or payment is already pending.

10. Add even a minimal automated test layer.
    - No tests were found in the repository.
    - `package.json:6-12` has no `test` script.
    - Given how stateful the routing is, a few integration tests for stage transitions would materially improve demo confidence.

### Bottom-line demo verdict

- The codebase is past "toy chatbot" stage because it has persisted workflow state, a real tool loop, and some inline UI components.
- It is not yet production-ready.
- For a hackathon demo, the two biggest credibility risks are:
  - the unsecured/admin-trusted surface
  - the brittle state reconstruction from message text
- If those two areas were fixed, the rest of the system would present much more convincingly as a serious investor-onboarding agent rather than a chat wrapper around a scripted flow.
