## Description
Provide a concise explanation of what this pull request changes and why.

## Related issue
Fixes #(issue number) or relates to #(issue number).

## Type of change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to change)
- [ ] Code refactoring or performance improvement
- [ ] Documentation update
- [ ] Test addition or test fix

## Verification and test results
Describe the tests you ran to verify your changes. Include commands and test outputs.

```bash
# Example
npm test -- --run
npm run build
npm run lint
```

## Security and architectural compliance
- [ ] Every database query on section-scoped tables includes a `section_id` filter
- [ ] No third-party ERP credentials or passwords are requested or stored
- [ ] No changes bypass Supabase Row-Level Security (RLS) policies
- [ ] TypeScript strict mode is satisfied with no `any` types

## Checklist
- [ ] My code follows the code style and guidelines in `CONTRIBUTING.md`
- [ ] I have performed a self-review of my own code
- [ ] I have commented complex or non-obvious algorithms
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] All new and existing tests passed (`npm test`)
- [ ] The build succeeded without TypeScript errors (`npm run build`)
- [ ] Linter checks passed with 0 errors (`npm run lint`)
- [ ] For UI changes, I have attached screenshots or screen recordings below

## Screenshots or screen recordings (if applicable)
Add UI visual verification here.
