import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const routeTitles: Record<string, string> = {
  '/': 'Sign In',
  '/onboarding/choice': 'Join or Create Section',
  '/onboarding/join': 'Join Section Hub',
  '/onboarding/create': 'Create Section Hub',
  '/app/home': 'Dashboard',
  '/app/schedule': 'Class Timetable',
  '/app/polls': 'Polls & Bunks',
  '/app/profile': 'My Profile',
  '/app/resource-hub': 'Resource Hub',
  '/app/announcements': 'Announcements',
  '/app/assignments': 'Assignments',
  '/app/attendance': 'Attendance Predictor',
  '/app/cr-command': 'CR Command Center',
  '/app/cr/subjects': 'Manage Subjects',
  '/app/pdf-viewer': 'PDF Viewer',
  '/app/exams': 'Exam Schedule',
  '/app/gpa': 'GPA Calculator',
  '/app/dev-console': 'Developer Console',
  '/app/members': 'Section Directory',
  '/app/teacher-dashboard': 'Teacher Dashboard',
  '/app/counsellor': 'Counsellor Console',
  '/share-intake': 'Share Target Intake',
  '/legal': 'Terms & Privacy'
};

export default function PageTitleManager() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const title = routeTitles[path] || 'Academic Management PWA';
    document.title = `${title} | ClassHub`;
  }, [location]);

  return null;
}
