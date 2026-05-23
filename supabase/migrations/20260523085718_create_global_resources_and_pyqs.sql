-- CREATE GLOBAL RESOURCES TABLE
CREATE TABLE IF NOT EXISTS global_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_code TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  semester TEXT NOT NULL,
  branch TEXT NOT NULL,
  accent_color TEXT DEFAULT '#8B5CF6',
  syllabus_url TEXT DEFAULT '',
  notes_url TEXT DEFAULT '',
  pyqs_url TEXT DEFAULT '',
  practice_url TEXT DEFAULT '',
  lab_url TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- CREATE GLOBAL PYQS TABLE
CREATE TABLE IF NOT EXISTS global_pyqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester TEXT NOT NULL,
  year TEXT NOT NULL,
  url TEXT NOT NULL,
  is_latest BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE global_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_pyqs ENABLE ROW LEVEL SECURITY;

-- DROP POLICIES IF THEY EXIST
DROP POLICY IF EXISTS allow_read_all_users ON global_resources;
DROP POLICY IF EXISTS allow_write_admin_users ON global_resources;
DROP POLICY IF EXISTS allow_read_all_users ON global_pyqs;
DROP POLICY IF EXISTS allow_write_admin_users ON global_pyqs;

-- CREATE RLS POLICIES FOR GLOBAL RESOURCES
CREATE POLICY allow_read_all_users ON global_resources 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY allow_write_admin_users ON global_resources 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'cr'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'cr'));

-- CREATE RLS POLICIES FOR GLOBAL PYQS
CREATE POLICY allow_read_all_users ON global_pyqs 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY allow_write_admin_users ON global_pyqs 
  FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'cr'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'cr'));

-- SEED INITIAL DATA FOR GLOBAL RESOURCES (7 SEM II SUBJECTS)
INSERT INTO global_resources (subject_code, subject_name, semester, branch, accent_color, syllabus_url, notes_url, pyqs_url, practice_url, lab_url)
VALUES
  (
    'MAUL201', 'Maths-II', 'Semester II', 'ALL', '#f5c518',
    'https://drive.google.com/file/d/1qdyV_e2GjrcR-IHUpvf6JcNMxaetIVKA/view?usp=drive_link',
    'https://drive.google.com/drive/folders/1NS_ZZXoHub-nZnuKMiAtoGNStFvwF-st?usp=drive_link',
    'https://drive.google.com/drive/folders/1zppyhHOI1W-OtbDUjKLTfO0cEuK0-CC5?usp=drive_link',
    'https://drive.google.com/drive/folders/1kMlhILpkHgZoMqO0OGusEC8R7V3uElZF?usp=drive_link',
    ''
  ),
  (
    'PHUL201', 'Physics', 'Semester II', 'AI/IT/IOT/EC/EE', '#00d4ff',
    'https://drive.google.com/file/d/11FSJy49zAQJ0Zor8vBCcKT-Uv_5lQ5ux/view?usp=drive_link',
    'https://drive.google.com/drive/folders/1NbHemz7SOWMeT8U5673gPIl6sNjzIQ3D?usp=drive_link',
    'https://drive.google.com/drive/folders/1OixliunIYGFW8Fbwn5wpoqV6Z_cB9cKz?usp=drive_link',
    'https://drive.google.com/drive/folders/1bKDkvTtWbLedMyFk7SLTTatTHns_hfwH?usp=drive_link',
    'https://drive.google.com/drive/folders/1OcJXLNRP4ykeO8xkVlMIUXBDQDlTwlG_?usp=drive_link'
  ),
  (
    'HSUL201', 'Communication Skills', 'Semester II', 'AI/IT', '#ff6b6b',
    'https://drive.google.com/file/d/1TwqVZksEHEqVYADCQB-e3vdVUG-sd98L/view?usp=drive_link',
    'https://drive.google.com/drive/folders/137Y6YGBD_AE0nOUzFum5zEsogAuISV-B?usp=drive_link',
    'https://drive.google.com/drive/folders/1nWIYsMZ1hVo8cU5DK8B0PzpOurMiZBaQ?usp=drive_link',
    'https://drive.google.com/drive/folders/1K906rbXYo3_s46N87tU_Shx3m4izVZQJ?usp=drive_link',
    'https://drive.google.com/drive/folders/1elUBZyvR3jR2aH9YV3uxXWRewqBXsE12?usp=drive_link'
  ),
  (
    'HSUL203', 'I & E', 'Semester II', 'ALL', '#a8ff78',
    'https://drive.google.com/file/d/1SQsWKdlaBKCOBlnsTfF12flCfHWC3Dd8/view?usp=drive_link',
    'https://drive.google.com/drive/folders/17xV90CSELGKs-ccdDyWpNmK7moJbziw3?usp=drive_link',
    'https://drive.google.com/drive/folders/1gPkHvCcnkzOY8IBkBGkeiDa8p6GjQET0?usp=drive_link',
    'https://drive.google.com/drive/folders/1k0uXZt-E0D8lOMoO-RX-k_XX3mohF0Q4?usp=drive_link',
    ''
  ),
  (
    'CSUL201', 'OOP / C++', 'Semester II', 'ALL', '#ff9500',
    'https://drive.google.com/file/d/1oMcZULribNrhMRbBj_Rzx_Qd-L_xxrOF/view?usp=drive_link',
    'https://drive.google.com/drive/folders/1qWj6cloqtWFRHkkdOSwCGu3PLSj9Bst-?usp=drive_link',
    'https://drive.google.com/drive/folders/1rdnZDqr1VAwVLVLHHWzOhbokxo9dby_y?usp=drive_link',
    'https://drive.google.com/drive/folders/1GLTJ8vVav108dP9_sxqK6g98tObFeR0B?usp=drive_link',
    'https://drive.google.com/drive/folders/17S4pPwx8q3mGdVr1pnuQ1eOvGxY466Sy?usp=drive_link'
  ),
  (
    'EEUL201', 'BEEE', 'Semester II', 'AI/IT/IOT', '#c0c0c0',
    '',
    'https://drive.google.com/drive/folders/1B_mKubgpalx-hyvPMQy5O9Fvgml9zhtd?usp=drive_link',
    'https://drive.google.com/drive/folders/1Vstni2q9pyRf3lWr5X8NCpL_NccyUTSt?usp=drive_link',
    'https://drive.google.com/drive/folders/1xJlsrT0Mjb-L5H9LHVGr4uqZKxrA40QK?usp=drive_link',
    'https://drive.google.com/drive/folders/1uv5apDx0mxdc2pzinQAitkvBB96zaQDy?usp=drive_link'
  ),
  (
    'NU99.3', 'ITK', 'Semester II', 'AI/IT/IOT/EC/EE', '#70e000',
    'https://drive.google.com/file/d/1NCGKS7haPx_9imhAfDNxIxYZD7WCDjK9/view?usp=drive_link',
    'https://drive.google.com/file/d/1NCGKS7haPx_9imhAfDNxIxYZD7WCDjK9/view?usp=drive_link',
    'https://drive.google.com/drive/folders/1xIwWT_2dQ240TaINVrqP7pVsjwkrBN6F?usp=drive_link',
    '',
    ''
  )
ON CONFLICT DO NOTHING;

-- SEED INITIAL DATA FOR GLOBAL PYQS
INSERT INTO global_pyqs (semester, year, url, is_latest)
VALUES (
  'Semester II', '2025',
  'https://drive.google.com/file/d/1rnX2vsD9iQpas4FPzvy1ei8jYVEr4_YK/view?usp=sharing',
  true
)
ON CONFLICT DO NOTHING;
