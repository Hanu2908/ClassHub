insert into public.sections (id, college, name, invite_code)
values ('00000000-0000-4000-8000-000000000001', 'SKIT Jaipur', 'P2', 'P2WXYZ')
on conflict (invite_code) do nothing;

insert into public.subjects (section_id, code, name, semester, accent)
values
  ('00000000-0000-4000-8000-000000000001', 'CSUL201', 'Problem Solving Using OOP', 2, '#4A9EFF'),
  ('00000000-0000-4000-8000-000000000001', 'DBMS201', 'Database Management Systems', 2, '#34C97B'),
  ('00000000-0000-4000-8000-000000000001', 'OSL201', 'Operating Systems Lab', 2, '#FFB547'),
  ('00000000-0000-4000-8000-000000000001', 'CHEM101', 'Engineering Chemistry', 2, '#FF4444')
on conflict (section_id, code) do nothing;
