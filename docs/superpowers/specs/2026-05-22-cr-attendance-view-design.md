# Design Spec: CR Section Attendance Overview

This specification describes the implementation of the aggregate section attendance overview for the Class Representative (CR) within the CR Command Center. This feature integrates student overall attendance percentages directly into the existing "Section Members" list with advanced sorting, filtering, and high-fidelity, color-coded visual feedback.

---

## 1. Data Strategy & Architecture

### Backend & Permissions
No database schema changes or RLS migrations are required. The current Row-Level Security (RLS) policies on the `attendance_records` table already permit any user with the `cr` role to query the attendance rows of all members belonging to their section:
```sql
-- Existing policy in docs/schema.sql
create policy "Section members read attendance"
on public.attendance_records for select to authenticated
using (
  user_id = (select auth.uid()) or exists (
    select 1
    from public.users u
    join public.subjects s on s.section_id = u.section_id
    where u.id = attendance_records.user_id
      and s.id = attendance_records.subject_id
      and public.is_cr_for_section(u.section_id)
  )
);
```

### Global Query Integration (`useSectionAttendance`)
To support this view efficiently and prevent N+1 query bottlenecks, a dedicated react-query hook will be introduced in `src/hooks/useSupabaseQuery.ts`:

```typescript
export interface StudentAttendanceAggregate {
  userId: string;
  totalPresent: number;
  totalHeld: number;
  overallPercentage: number | null;
}

export function useSectionAttendance() {
  const { role, sectionId, isAuthLoading } = useAuthContext();
  const isCR = role === 'cr';

  return useQuery<Record<string, StudentAttendanceAggregate>>({
    queryKey: ['section_attendance', sectionId],
    enabled: !!sectionId && !isAuthLoading && isCR,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    queryFn: async () => {
      // Securely fetch all attendance records for the section
      const { data, error } = await supabase
        .from('attendance_records')
        .select('user_id, present, od, makeup, absent');
      
      if (error) throw error;

      const aggregates: Record<string, StudentAttendanceAggregate> = {};
      
      (data ?? []).forEach(r => {
        // ERP-consistent calculations:
        // Total = present + od + makeup + absent
        // Attended = present + od + makeup
        const total = r.present + r.od + r.makeup + r.absent;
        const attended = r.present + r.od + r.makeup;
        
        if (!aggregates[r.user_id]) {
          aggregates[r.user_id] = {
            userId: r.user_id,
            totalPresent: 0,
            totalHeld: 0,
            overallPercentage: null
          };
        }
        
        aggregates[r.user_id].totalPresent += attended;
        aggregates[r.user_id].totalHeld += total;
      });

      // Calculate final aggregate percentages
      Object.values(aggregates).forEach(agg => {
        if (agg.totalHeld > 0) {
          agg.overallPercentage = (agg.totalPresent / agg.totalHeld) * 100;
        }
      });

      return aggregates;
    }
  });
}
```

---

## 2. UI / UX Design & Interactions

The Section Members panel inside `src/pages/app/CRCommandPage.tsx` will be upgraded from a generic directory list into an interactive cockpit for attendance oversight.

### A. Executive Summary Strip
At the top of the expanded card, the CR receives high-level intelligence about their section's health:
*   **Section Average**: The mean percentage of all students who have uploaded data.
*   **At Debarment Risk**: A count of students who are currently below the critical 75% threshold.

### B. Controls & Filters (Mobile-Optimized)
A sleek, horizontal layout will house the search, filters, and sort options:
*   **Filters**: Horizontal pill buttons with smooth hover transitions:
    *   `All` (Total student count)
    *   `Below 75%` (Count of at-risk students, styled with a soft red badge on selection)
    *   `75%+` (Count of safe students, styled with a soft emerald badge on selection)
*   **Sort Options**: A clean dropdown menu with three settings:
    *   `Roll Number` (default, sorted numerically using class roll suffix extraction)
    *   `Low Attendance First` (critical risk students sorted to the top, putting `N/A` at the absolute bottom)
    *   `High Attendance First`

### C. Visual Attendance Status Pills
Instead of standard role labels, the list renders tailored attendance pills:
1.  **Grey Pill (`N/A`)**: Shown when `overallPercentage` is `null` (student has not imported database records yet). Avoids false alarms.
2.  **Red Pill (`< 75%`)**: Critical debarment warning. Color matches `var(--status-critical)` with background `var(--status-critical-bg)` and a subtle glow.
3.  **Green Pill (`>= 75%`)**: Safe standing. Color matches `var(--status-safe)` with background `var(--status-safe-bg)`.

---

## 3. Implementation Details & Algorithms

### Sorting Mechanism
```typescript
const getRollNumber = (roll: string) => parseInt(roll.replace('P-', ''), 10);

const sortedMembers = [...filteredMembers].sort((a, b) => {
  if (sortBy === 'attendance_asc') {
    if (a.overallPercentage === null) return 1;
    if (b.overallPercentage === null) return -1;
    return a.overallPercentage - b.overallPercentage;
  }
  if (sortBy === 'attendance_desc') {
    if (a.overallPercentage === null) return 1;
    if (b.overallPercentage === null) return -1;
    return b.overallPercentage - a.overallPercentage;
  }
  
  // Default: Roll number sort
  const rollA = a.classRoll ? getRollNumber(a.classRoll) : 999;
  const rollB = b.classRoll ? getRollNumber(b.classRoll) : 999;
  return rollA - rollB;
});
```

---

## 4. Verification Plan

### Automated Verification
*   Verify that `npm run build` succeeds without compilation errors.
*   Ensure that unit tests (`npm test`) execute correctly.

### Manual Verification
*   **Summary Stats**: Check that "Section Average" and "At Debarment Risk" match the mathematical average and count of the underlying student rows.
*   **Filters**: Select "Below 75%" and verify that only students with $<75\%$ are rendered. Select "75%+" and verify only students $\ge 75\%$ are rendered.
*   **Sorting**: Select "Low Attendance First" and confirm that students with lower percentages appear first, followed by higher percentages, and `N/A` students appear at the very bottom.
*   **Null Data Handling**: Verify that a newly joined student with 0 attendance classes renders as a clean grey `N/A` pill instead of failing or showing a red `0.0%`.
