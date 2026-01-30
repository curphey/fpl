# Contributing to FPL Insights

Thank you for your interest in contributing to FPL Insights! This document provides guidelines and information for contributors.

## Development Setup

### Prerequisites

- Node.js 20+
- npm 10+
- Git

### Getting Started

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/<your-username>/fpl.git
   cd fpl
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy environment variables:

   ```bash
   cp .env.example .env.local
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

For local development, you'll need:

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `ANTHROPIC_API_KEY` - (Optional) For AI features

## Code Style

### TypeScript

- Use strict mode (enabled in `tsconfig.json`)
- Prefer explicit types over `any`
- Use interfaces for object shapes
- Use type guards for runtime validation

### React

- Use functional components with hooks
- Named exports for components (one per file)
- PascalCase for component filenames
- Keep components focused and composable

### Styling

- Tailwind CSS utility classes
- Custom colors via CSS variables (`--fpl-purple`, `--fpl-green`, etc.)
- Dark theme only (no light mode toggle)
- Mobile-first responsive design

### Imports

- Use `@/` path alias for imports
- Group imports: external packages, internal modules, relative imports
- Sort alphabetically within groups

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Place tests in `__tests__/` directories adjacent to source files
- Use descriptive test names: `it("returns empty array when no fixtures match")`
- Use mock factories for FPL data (see existing tests for examples)
- Aim for high coverage of utility functions and business logic

### Test Structure

```typescript
import { describe, it, expect, vi } from "vitest";

describe("functionName", () => {
  it("describes expected behavior", () => {
    // Arrange
    const input = { ... };

    // Act
    const result = functionName(input);

    // Assert
    expect(result).toEqual(expected);
  });
});
```

## Git Workflow

### Branches

- `main` - Production-ready code
- Feature branches: `feature/short-description`
- Bug fixes: `fix/short-description`
- Docs: `docs/short-description`

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `style` - Code style (formatting, semicolons, etc.)
- `refactor` - Code change that neither fixes a bug nor adds a feature
- `perf` - Performance improvement
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

Examples:

```
feat(captain): add expected points breakdown
fix(live): correct bonus points calculation
docs: update API documentation
test(transfers): add tests for price model
```

### Pre-commit Hooks

The project uses Husky and lint-staged. On every commit:

1. ESLint runs on staged `.ts` and `.tsx` files
2. Prettier formats staged files
3. All tests run

If any step fails, the commit is aborted. Fix the issues and try again.

## Pull Request Process

### Before Submitting

1. Ensure your code follows the style guidelines
2. Write or update tests as needed
3. Update documentation if applicable
4. Run the full test suite: `npm test`
5. Run the linter: `npm run lint`
6. Ensure the build passes: `npm run build`

### PR Guidelines

1. Create a descriptive title (under 70 characters)
2. Fill out the PR template with:
   - Summary of changes
   - Related issue number(s)
   - Test plan
3. Keep PRs focused - one feature or fix per PR
4. Request review from maintainers

### Review Process

- At least one approval required before merge
- Address all review comments
- Keep discussion constructive and focused
- Squash commits when merging

## Project Structure

See the [CLAUDE.md](./CLAUDE.md) file for detailed project structure and architecture documentation.

## Getting Help

- Open an issue for bugs or feature requests
- Check existing issues before creating new ones
- Provide reproduction steps for bugs
- Include relevant error messages and screenshots

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.
