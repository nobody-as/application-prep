# application-prep

A study workspace for bringing the readings, notes, and selected textbook pages for an assessment into one place. It keeps the original cream, blue, and coral visual direction and replaces the starter’s fixed sample output with working generation and study sessions.

## What works

- Course and assessment organization, date, and assessment scope.
- Multiple PDF, Markdown, text, and public web-page sources. PDF text extraction runs in the browser. Choose page ranges such as `1-5, 8, 12-14`; use separate sources or ranges for flashcards and quizzes.
- Four challenge levels; **Cross-examine** is the default. It emphasizes assumptions, boundary conditions, counterexamples, and transfer rather than obscure trivia.
- Source-based generation from the actual selected material. Every item links back to a source page and an exact excerpt.
- Optional server-side AI generation with structured output, worked answers, scenario questions, and citation validation.
- Flashcards with hidden answers, multiple-choice checking, written-answer rubrics, timed quizzes, and weak-spot retries.
- Cloud workspaces and completed-review progress under the visitor’s ChatGPT sign-in. D1 writes use revisions to reject stale-device overwrites.
- JSON backup export/import and a device-local recovery copy for unsaved work.

## Generation modes and limits

**Source-based mode works without an AI key.** It extracts source statements, produces retrieval exercises, and adds reasoning prompts and rubrics at higher levels. Open-answer anchors are quotations, not worked conceptual solutions. Written reasoning and flashcards are explicitly self-assessed. Recall quizzes use fill-the-gap choices where sufficient distinct source terms exist; otherwise they use written retrieval.

**AI mode requires a server-side `OPENAI_API_KEY`.** Configure it through the hosting provider’s runtime secret settings, never in browser code or a tracked file. `OPENAI_MODEL` is optional and defaults to `gpt-4.1`. The hosted setup uses the OpenAI Developers connection for key provisioning. The app uses the Responses API with strict JSON schema, `store: false`, a 100-second timeout, and a per-user limit of 12 generation attempts per hour. The source text and assessment scope are sent to OpenAI only when AI mode is selected. No API key is included in client bundles.

AI citations are verified as verbatim excerpts of selected pages and checked against source roles. This validates evidence provenance; it does **not** prove that every generated answer is correct. Review answers against official course material.

Limits: 12 sources per set, 20 MB per upload, 300 pages per PDF, 60,000 characters per page, 100,000 selected characters per generation pass, 4–40 requested items per mode. Short material may produce fewer items. PDF images and diagrams are not extracted, and scanned PDFs need OCR. Public-page import cannot bypass sign-in walls or reconstruct JavaScript-only content.

## Development

Node.js 22.13+ and pnpm are required.

```sh
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm build
```

The app retains the React App Router source organization and runs on **Vinext / Vite with Cloudflare Workers**, enabling the hosted D1 storage and ChatGPT sign-in. `pnpm build` produces a Worker artifact, not a Vercel Next.js deployment. Hosting declarations live in `.openai/hosting.json`. The original Next.js starter config is retained for reference; the active build uses `vite.config.ts` and the maintained Sites integration.

For local development, use the portable execution profile and the starter’s mock ChatGPT sign-in. Start at `/signin-with-chatgpt?return_to=/`. Hosted identity is supplied by the platform; client-supplied identity must never be trusted on an unprotected standalone deployment.

Generate migrations with `pnpm db:generate`. For local D1, build first, then apply each unapplied migration using:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_aromatic_guardian.sql
```

Hosted publication applies migrations automatically. Never replay applied migrations or modify their history.

## Storage and progress

Sources, study sets, and completed review attempts are stored in a user-owned D1 record. Browser storage holds only pending recovery copies; it is not cross-device synchronization. Saving while a different device has updated the workspace returns a conflict. Export the recovery copy or reload the saved workspace, then recover local additions. Backup imports preserve existing set IDs and add new sets and review attempts.

A latest **Again** rating is due immediately, **Hard** is due in one day, and **Got it** is due in three days. “Secure” is a review rating, not a prediction of exam performance. Completed reviews persist; an in-progress answer and session timer remain local to the open session.

## Verification

`pnpm test` covers page ranges, separate source roles, source-grounded generation, cognitive difficulty, citation rejection, malformed backups, demo correctness, review scheduling, URL guards, real SQLite migration compatibility, storage isolation, and optimistic save conflicts. `pnpm typecheck` checks application types; `pnpm build` validates the deployable Worker and PDF worker assets. Browser interaction QA and live AI generation require their corresponding environment capabilities.
