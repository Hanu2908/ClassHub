# Spec: Dynamic Hero Card Selection (Chronological Proximity)

This specification outlines the logic updates to dynamically choose whether the dashboard's right hero panel displays the **Next Deadline** card or the **Next Exam** card.

## Problem Statement
Currently, if any exam is scheduled within the next 7 days, the dashboard's right panel is locked to display the exam card. This hides any pending assignment, poll, or announcement deadlines, even if they are due within a few hours.

## Proposed Changes

### 1. Dynamic Selector Logic
Instead of a hardcoded 7-day threshold (`isExamSoon`), the card display will be decided using a simple chronological priority. 

We will compute the remaining time relative to the current timestamp:
- **Exam time**: `examTime = closestExam ? new Date(`${closestExam.examDate}T${closestExam.startTime}`).getTime() : Infinity`
- **Deadline time**: `deadlineTime = primaryDeadline ? new Date(primaryDeadline.dueDate).getTime() : Infinity`

The widget displays:
- **Next Exam Card**: If `closestExam` exists AND `examTime < deadlineTime`.
- **Next Deadline Card**: If `primaryDeadline` exists AND `deadlineTime <= examTime`.
- **Empty State**: If neither exists.

### 2. Component Refinement
- **DashboardPage.tsx**: Update the conditional rendering branch in the `hero-panel-right` container to implement the new logic.

---

## Verification Plan

### Automated Tests
- Run `npm run build` to verify there are no compilation errors.
- Run `npm run lint` to verify that there are no style or code standard violations.

### Manual Verification
- Verify that if a deadline is closer in time than an exam, the deadline card is shown.
- Verify that once the deadline is submitted or expires, the panel dynamically switches to show the exam.
