# application-prep

application-prep is an AI-built study application created from a student's need for another way to train on any course or content. It turns supplied learning material into flashcards and quizzes, giving students a place to practise recall, examine concepts, test assumptions, and prepare for assessments.

The goal is to bring preparation for a course or assessment into one environment that works across devices. Difficulty is selectable, with maximum conceptual depth and edge-case reasoning as the default.

**Built with AI** describes how the application was developed. The current release creates source-based exercises; AI-powered question generation is not connected yet.

[Open the application](https://application-prep.vercel.app)

A Next.js study workspace for your existing v0/Vercel project. Upload readable PDFs, TXT or Markdown, paste course material, or import public HTTPS text pages. Select page ranges independently for flashcards and quizzes. Maximum conceptual and edge-case depth is the default.

Create source-grounded retrieval exercises, review cited passages, run quizzes and timed practice, and track weak topics and review dates. Written reasoning uses a self-assessment rubric. The demo includes worked critical-thinking questions. Source-based generation is deterministic; it does not claim to produce AI-authored worked solutions.

## Run

Use Node 24 and pnpm 11.25.0:

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm dev
pnpm build
```

The predev/prebuild script copies the matching installed PDF.js worker into public. No external worker CDN is required. Scanned PDFs need OCR first.

## Storage and deployment

Study sets and progress are automatically saved in this browser's local storage. Export/import JSON backups to move between devices. Browser storage has limited capacity; export before clearing it. Unsaved changes produce an explicit error and can still be exported. Automatic cloud sync and AI generation are not configured in this version.

Deploy using the existing GitHub-to-Vercel connection and production domain. This repository uses Next.js, not a separate ChatGPT Site runtime. It requires no Cloudflare D1, ChatGPT identity headers, or Sites deployment settings. TypeScript build errors are checked.
