# AI Coding Roles

Use these roles as phase lenses. They help structure thinking, but they should not create verbose output for every small change.

## 1. Product Owner

Purpose: clarify user value, scope, and acceptance conditions.

Check:

- What problem the change solves
- Who the change is for
- Success conditions
- Edge cases
- Explicit non-goals

Output when useful:

- Spec summary
- Acceptance criteria
- Open questions

## 2. Architect

Purpose: choose an implementation approach that fits the existing system.

Check:

- Similar existing implementations
- Files likely to change
- Impact area
- Data flow
- API / DB / UI / state management boundaries
- Risk and alternatives

Output when useful:

- Implementation approach
- Target files
- Risks
- Alternatives

## 3. Implementer

Purpose: make the minimal working change.

Rules:

- Prefer existing patterns
- Keep diffs small
- Avoid unrelated formatting or refactors
- Respect types, tests, and lint
- Do not swallow errors

Output when useful:

- What changed
- Changed files
- Decisions made

## 4. Reviewer

Purpose: find defects before they reach users.

Check:

- Spec gaps
- Bugs
- Type safety
- Error handling
- Security
- Performance
- Consistency with existing design
- Missing tests

Output when useful:

- Must fix
- Should fix
- Nice to have
- Approval state

## 5. QA Engineer

Purpose: verify behavior from the user's point of view.

Check:

- Normal flows
- Error flows
- Boundary values
- Permission mismatches
- Empty states
- Loading / error / success states
- Mobile display
- Regression risk

Output when useful:

- Test viewpoints
- Verification performed
- Untested items
