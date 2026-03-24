# UIGen — Claude Code Guide

## Project Overview

UIGen is an AI-powered React component generator with live preview. Users describe components in natural language; Claude generates the code, which is rendered in a sandboxed iframe in real time. There is no disk-based file system — everything lives in an in-memory virtual FS serialized to a SQLite database.

## Commands

```bash
npm run dev        # Start dev server (Next.js 15 + Turbopack) at http://localhost:3000
npm run build      # Production build
npm run start      # Start production server
npm run test       # Run Vitest unit tests
npm run lint       # ESLint
npm run setup      # Install deps + generate Prisma client + run migrations
npm run db:reset   # Wipe and recreate the SQLite database
```

## Tech Stack

| Layer         | Technology                                              |
| ------------- | ------------------------------------------------------- |
| Framework     | Next.js 15 (App Router), React 19, TypeScript 5         |
| Styling       | Tailwind CSS v4, shadcn/ui (new-york), Radix UI, Lucide |
| AI            | Vercel AI SDK, `@ai-sdk/anthropic`, Claude Haiku 4.5    |
| Database      | Prisma + SQLite (`prisma/dev.db`)                       |
| Code editor   | Monaco Editor                                           |
| JSX transform | Babel standalone (runtime, in-browser)                  |
| Auth          | JWT via `jose`, bcrypt, HTTP-only cookies               |
| Layout        | react-resizable-panels                                  |
| Testing       | Vitest + Testing Library (jsdom)                        |

## Key Architecture

### Virtual File System

- Implemented in [src/lib/file-system.ts](src/lib/file-system.ts)
- In-memory tree; never touches disk
- Serialized to JSON and stored in the `Project.data` DB column
- Exposed via `FileSystemContext` (`src/lib/contexts/file-system-context.tsx`)

### AI Integration

- API route: [src/app/api/chat/route.ts](src/app/api/chat/route.ts)
- Streams responses via SSE (Vercel AI SDK)
- Claude calls tools to manipulate the virtual FS:
  - `str_replace` — [src/lib/tools/str-replace.ts](src/lib/tools/str-replace.ts)
  - `file_manager` — [src/lib/tools/file-manager.ts](src/lib/tools/file-manager.ts)
- System prompt: [src/lib/prompts/generation.tsx](src/lib/prompts/generation.tsx)
- Max steps: 40 (real) / 4 (mock)

### Preview System

- [src/components/preview/PreviewFrame.tsx](src/components/preview/PreviewFrame.tsx)
- Renders generated code in a sandboxed iframe
- Babel transforms JSX → JS at runtime; import maps resolve modules
- Auto-detects entry point (`App.tsx`, `App.jsx`, `index.tsx`, etc.)

### Authentication

- JWT sessions in HTTP-only cookies (7-day expiry)
- Server actions: [src/actions/index.ts](src/actions/index.ts)
- Supports anonymous users — work is tracked and can be saved on sign-up

### Mock Provider

- When `ANTHROPIC_API_KEY` is absent, [src/lib/provider.ts](src/lib/provider.ts) returns a `MockLanguageModel`
- Mock generates static sample components (Counter, ContactForm, Card)
- Useful for local dev without spending API credits

## Environment Variables

| Variable            | Required | Default                  | Purpose                          |
| ------------------- | -------- | ------------------------ | -------------------------------- |
| `ANTHROPIC_API_KEY` | No       | —                        | If absent, mock provider is used |
| `JWT_SECRET`        | No       | `development-secret-key` | Sign/verify session tokens       |

## Project Structure

```
src/
├── app/                  # Next.js App Router (pages + API routes)
├── components/
│   ├── ui/               # shadcn/ui primitives
│   ├── chat/             # Chat panel (MessageList, MessageInput, …)
│   ├── editor/           # Monaco editor + FileTree
│   ├── preview/          # iframe preview
│   └── auth/             # SignIn / SignUp dialogs
├── lib/
│   ├── file-system.ts    # Virtual FS core
│   ├── contexts/         # FileSystemContext, ChatContext
│   ├── tools/            # AI tool definitions
│   ├── transform/        # JSX → JS pipeline
│   ├── prompts/          # System prompt
│   ├── auth.ts           # JWT helpers
│   └── provider.ts       # Real / mock LLM provider
├── actions/              # Next.js Server Actions (auth, projects)
└── hooks/                # use-auth
prisma/
├── schema.prisma         # User + Project models (SQLite)
└── migrations/
```

## Database Models

- **User**: `id`, `email`, `password` (bcrypt), timestamps
- **Project**: `id`, `name`, `userId` (nullable), `messages` (JSON), `data` (JSON), timestamps

## Testing

Tests live alongside source in `__tests__/` subdirectories. Run with `npm run test`. No snapshot tests — prefer assertion-based tests with Testing Library.

## Path Alias

`@/*` resolves to `src/*` (configured in `tsconfig.json` and Vitest).
