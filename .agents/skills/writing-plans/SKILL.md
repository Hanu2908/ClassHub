---
name: writing-plans
description: "Generate a detailed implementation plan from a validated design or spec. Use after brainstorming and design approval, before writing code."
---

# Writing Plans Skill

This skill produces a concrete implementation plan for a feature after the design has been validated and approved.

## When to Use

- After a design has been finalized and the user has approved it
- When the next step is to move from design into implementation
- When the goal is to break a feature into actionable development tasks, file changes, and validation checks

## What It Does

- Reads the approved design or spec document
- Identifies the existing code area, files, components, and hooks that will change
- Maps the feature to data dependencies and UI behavior
- Defines the implementation sequence in logical phases
- Includes loading, error, and empty state handling
- Lists acceptance criteria and validation checks

## Process

1. Read the validated design/spec and confirm the target scope.
2. Identify the relevant files, data hooks, components, and UI modules.
3. Break the work into discrete, ordered tasks:
   - setup and structure changes
   - new components or helpers
   - data mapping and state handling
   - user interaction and navigation
   - visual/polish adjustments
   - testing and validation
4. Keep the plan specific to the current project stack and file patterns.
5. Avoid writing any code or changing implementation details at this stage.

## Output Format

Produce a plan with:

- A short overview of the feature and goal
- A prioritized sequence of implementation steps
- The exact files likely to change
- Key UI/UX and behavior requirements
- Data hook and state handling notes
- Validation criteria for completion

## Quality Criteria

- Plan is actionable and easy to follow
- Tasks are ordered from foundational to polish
- No vague or generic items like "improve UI"
- Each task references concrete app boundaries and existing patterns
- The plan is scoped to a single feature or variant
