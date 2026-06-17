-- Database migration to add teacher write policies on timetable_slots table

-- Allow teachers to insert slots for their assigned subjects/sections
DROP POLICY IF EXISTS "Teachers insert slots for their subjects" ON public.timetable_slots;
CREATE POLICY "Teachers insert slots for their subjects" ON public.timetable_slots
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = (SELECT auth.uid())
        AND st.section_id = timetable_slots.section_id
        AND st.subject_id = timetable_slots.subject_id
    )
  );

-- Allow teachers to update slots for their assigned subjects/sections
DROP POLICY IF EXISTS "Teachers update slots for their subjects" ON public.timetable_slots;
CREATE POLICY "Teachers update slots for their subjects" ON public.timetable_slots
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = (SELECT auth.uid())
        AND st.section_id = timetable_slots.section_id
        AND st.subject_id = timetable_slots.subject_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = (SELECT auth.uid())
        AND st.section_id = timetable_slots.section_id
        AND st.subject_id = timetable_slots.subject_id
    )
  );

-- Allow teachers to delete slots for their assigned subjects/sections
DROP POLICY IF EXISTS "Teachers delete slots for their subjects" ON public.timetable_slots;
CREATE POLICY "Teachers delete slots for their subjects" ON public.timetable_slots
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.teacher_id = (SELECT auth.uid())
        AND st.section_id = timetable_slots.section_id
        AND st.subject_id = timetable_slots.subject_id
    )
  );
