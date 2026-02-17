# Guide to Developing FPL Insights

This guide covers how to develop FPL Insights using Claude Code, the Superpowers TDD workflow, and Ralph Loops.

---

## Prerequisites

- **Node.js 20+** — [download](https://nodejs.org/)
- **Claude Code** — Anthropic's CLI for AI-assisted development
- **Docker** (optional) — [download](https://www.docker.com/products/docker-desktop/) for containerized development

---

## Getting Started

```bash
# Clone the repository
git clone https://github.com/yourusername/fpl.git
cd fpl

# Install dependencies
npm install

# Copy environment template (optional — app works without it)
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For full installation options (Docker, environment variables, etc.), see [INSTALL.md](./INSTALL.md).

---

## Setting Up Claude Code

### Installing Claude Code

Follow the official instructions at [docs.anthropic.com/claude-code](https://docs.anthropic.com/en/docs/claude-code) to install Claude Code.

### Plugins (Auto-Configured)

This repo includes a `.claude/settings.json` that pre-configures two plugin marketplaces and enables their plugins automatically. When you first open the repo in Claude Code, you'll be prompted to trust the project settings. Once accepted, the following are available immediately:

**Superpowers** (obra/superpowers-marketplace):

- **Brainstorming** — structured ideation before implementation
- **TDD** — enforces RED-GREEN-REFACTOR discipline (see below)
- **Code Review** — automated review between tasks
- **Git Worktrees** — parallel branch development

**VoltAgent Subagents** (VoltAgent/awesome-claude-code-subagents):

- 127+ specialized subagents organized by domain: frontend, backend, testing, security, infrastructure, data/AI, and more
- Claude automatically selects the right subagent for the task (e.g., `react-specialist` for React work, `typescript-pro` for type system questions)
- Subagents run in isolated context windows, protecting your main conversation from excessive output

No manual plugin installation is needed. If you want to verify the plugins are active, run `/plugin list` in Claude Code.

> **Manual install (only if auto-configuration doesn't work):**
>
> ```
> /plugin marketplace add obra/superpowers-marketplace
> /plugin install superpowers@superpowers-marketplace
> /plugin marketplace add VoltAgent/awesome-claude-code-subagents
> /plugin install voltagent-lang@awesome-claude-code-subagents
> ```

### Running Claude Code in YOLO Mode

YOLO mode skips permission prompts for tool calls, letting Claude work faster without asking you to approve each file read, edit, or command execution.

```bash
# Start Claude Code with all permissions skipped
claude --dangerously-skip-permissions
```

Alternatively, you can configure permission allowlists in your Claude Code settings so that specific tools (file reads, test runs, etc.) are auto-approved while destructive operations still require confirmation.

**When to use YOLO mode:**

- You trust the current task scope and want faster iteration
- You're running in a sandboxed environment or disposable branch
- You're working on a well-tested codebase with CI/CD as a safety net

**When NOT to use YOLO mode:**

- Working directly on `main` without a safety branch
- Running commands that affect external services (deployments, API calls)
- When you're unfamiliar with what Claude might do

---

## The Superpowers TDD Workflow

TDD (Test-Driven Development) is **mandatory** for all code changes in this project. The Superpowers plugin enforces this automatically, but here's what it means in practice.

### Why TDD?

Tests written _after_ code prove nothing — they pass immediately, so you never know if they actually catch bugs. Writing the test first guarantees that:

1. Your test can actually fail (it catches real problems)
2. You write only the code you need (no over-engineering)
3. You have a safety net before refactoring

### The RED-GREEN-REFACTOR Cycle

#### RED: Write a Failing Test

Write a test for the behavior you want. Run it. **It must fail.** If it passes, either your test is wrong or the behavior already exists.

```typescript
// Example: testing a new utility function
describe("calculateExpectedPoints", () => {
  it("returns higher score for players with good fixtures", () => {
    const player = createMockPlayer({ form: "7.5" });
    const fixtures = [createMockFixture({ difficulty: 2 })];

    const result = calculateExpectedPoints(player, fixtures);

    expect(result).toBeGreaterThan(5);
  });
});
```

Run: `npm test` — this test should fail because `calculateExpectedPoints` doesn't exist yet.

#### GREEN: Make It Pass

Write the **simplest** code that makes the test pass. Don't optimize. Don't handle edge cases you haven't tested for. Just make the red test turn green.

```typescript
export function calculateExpectedPoints(
  player: Player,
  fixtures: Fixture[],
): number {
  const form = parseFloat(player.form);
  const avgDifficulty =
    fixtures.reduce((sum, f) => sum + f.difficulty, 0) / fixtures.length;
  return form * (6 - avgDifficulty);
}
```

Run: `npm test` — the test should pass now.

#### REFACTOR: Clean Up

With a passing test as your safety net, improve the code. Extract helpers, rename variables, remove duplication. **All tests must still pass after refactoring.**

### How Superpowers Enforces TDD

When the Superpowers plugin is active:

- It auto-activates the TDD skill during implementation tasks
- It will reject code written before tests and ask you to start over
- It blocks common excuses: "too simple to test", "I already tested manually", "I'll add tests later"
- It runs code review between tasks to catch TDD violations

---

## Using Ralph Loops for Development

### What is a Ralph Loop?

A Ralph Loop is an autonomous development loop where Claude works iteratively on tasks. Claude reads requirements, executes a task, checks its work, and moves to the next task — repeating until completion. Think of it as putting Claude in a focused work session.

### How to Start a Ralph Loop

In Claude Code, use the slash command:

```
/ralph-loop
```

Claude will then:

1. Read the current requirements or task list
2. Pick up the next task
3. Execute using TDD (write test → make it pass → refactor)
4. Verify the work (run tests, check types)
5. Move to the next task
6. Repeat until all tasks are complete

### When to Use Ralph Loops

- **Building multi-step features** — e.g., "Add a new page with API route, model, and components"
- **Implementing a PRD** — Give Claude a specification and let it work through the implementation
- **Working through a backlog** — Process multiple small tasks in sequence
- **Refactoring across files** — Systematic changes that follow a pattern

### Best Practices

1. **Write clear requirements first** — The better your task descriptions, the better Ralph's output
2. **Monitor the first few iterations** — Make sure Claude understands the pattern before walking away
3. **Set reasonable scope** — Ralph works best with well-defined boundaries
4. **Let TDD guide quality** — Ralph uses TDD for each implementation step, so tests act as your quality gate

### How Ralph + TDD Work Together

Each iteration of a Ralph Loop follows the TDD cycle:

1. Ralph picks up a task
2. Writes a failing test for the expected behavior
3. Implements the minimal code to pass
4. Refactors if needed
5. Runs the full test suite
6. Moves to the next task

This means every piece of code Ralph produces has test coverage by design.

---

## Project Conventions

See [CLAUDE.md](./CLAUDE.md) for the full list of project conventions, including:

- Import patterns (`@/` path alias)
- Component structure (named exports, PascalCase)
- Styling (Tailwind utilities, CSS variables, dark-only theme)
- Data fetching (client hooks, API proxy with caching)
- Testing patterns (Vitest, `__tests__/` directories, mock factories)
- API validation (Zod schemas)
- Null/undefined handling semantics

---

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run a specific test file
npx vitest run lib/fpl/__tests__/captain-model.test.ts
```

Tests live in `__tests__/` directories adjacent to the source files they test.

---

## Common Development Tasks

### Adding a New Page

1. Create `app/<page-name>/page.tsx` with the page component
2. Add navigation entry in `components/layout/nav-items.ts`
3. Create components in `components/<page-name>/`
4. Write tests in `components/<page-name>/__tests__/`

### Adding a New API Route

1. Create `app/api/<route-name>/route.ts`
2. Add Zod validation schema in `lib/api/validation.ts`
3. Use `validationErrorResponse()` for error formatting
4. Add rate limiting tier if needed
5. Write tests for the route handler

### Adding a New Model/Algorithm

1. Create `lib/fpl/<model-name>.ts` with the pure logic
2. Write comprehensive tests in `lib/fpl/__tests__/<model-name>.test.ts` first (TDD!)
3. Create a hook in `lib/fpl/hooks/` if the UI needs it
4. Add types in `lib/fpl/types.ts`

### Adding a Claude AI Feature

1. Add types in `lib/claude/types.ts` or `lib/claude/simulator-types.ts`
2. Add the API client function in `lib/claude/client.ts` or `lib/claude/simulator-client.ts`
3. Create the API route in `app/api/<feature>/route.ts`
4. Add a React hook in `lib/claude/hooks.ts` or `lib/claude/simulator-hooks.ts`
5. Build the UI component

---

## Further Reading

- **[CLAUDE.md](./CLAUDE.md)** — Full project structure, conventions, and API reference
- **[INSTALL.md](./INSTALL.md)** — Installation guide (Docker and local)
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — Git workflow, PR process, commit conventions
- **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)** — Production deployment and CI/CD
