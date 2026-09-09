import React from 'react';
import { AlertTriangle, Award, Calendar, Coffee, Megaphone } from 'lucide-react';
import type { Announcement } from '../../../store/appStore';

export interface CategoryInfo {
  name: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}

export function getAnnouncementCategory(title: string, priority: 'critical' | 'general'): CategoryInfo {
  const t = (title || '').toLowerCase();
  
  if (priority === 'critical' || t.includes('urgent') || t.includes('attention') || t.includes('alert') || t.includes('important')) {
    return {
      name: 'Immediate Alert',
      icon: <AlertTriangle size={14} color="#f87171" />,
      color: '#f87171',
      bgColor: 'rgba(239, 68, 68, 0.08)',
      borderColor: 'rgba(239, 68, 68, 0.2)',
    };
  }
  
  if (t.includes('exam') || t.includes('test') || t.includes('quiz') || t.includes('midterm') || t.includes('practical') || t.includes('mst') || t.includes('assessment') || t.includes('viva')) {
    return {
      name: 'Academic Exam',
      icon: <Award size={14} color="#a78bfa" />,
      color: '#a78bfa',
      bgColor: 'rgba(167, 139, 250, 0.08)',
      borderColor: 'rgba(167, 139, 250, 0.2)',
    };
  }
  
  if (t.includes('schedule') || t.includes('class') || t.includes('timing') || t.includes('timetable') || t.includes('slot') || t.includes('rescheduled') || t.includes('postponed')) {
    return {
      name: 'Schedule Change',
      icon: <Calendar size={14} color="#34d399" />,
      color: '#34d399',
      bgColor: 'rgba(52, 211, 153, 0.08)',
      borderColor: 'rgba(52, 211, 153, 0.2)',
    };
  }
  
  if (t.includes('holiday') || t.includes('leave') || t.includes('cancel') || t.includes('closed') || t.includes('break') || t.includes('vacation')) {
    return {
      name: 'Campus Holiday',
      icon: <Coffee size={14} color="#fbbf24" />,
      color: '#fbbf24',
      bgColor: 'rgba(251, 191, 36, 0.08)',
      borderColor: 'rgba(251, 191, 36, 0.2)',
    };
  }
  
  return {
    name: 'General Announcement',
    icon: <Megaphone size={14} color="#60a5fa" />,
    color: '#60a5fa',
    bgColor: 'rgba(96, 165, 250, 0.08)',
    borderColor: 'rgba(96, 165, 250, 0.15)',
  };
}

export type AnnouncementWithAck = Announcement & { isAcknowledged: boolean };

export interface GroupedAnnouncements {
  thisWeek: AnnouncementWithAck[];
  lastWeek: AnnouncementWithAck[];
  older: AnnouncementWithAck[];
}

export function groupByTimeline(items: AnnouncementWithAck[], nowTimestamp: number): GroupedAnnouncements {
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS = 7 * ONE_DAY;
  const FOURTEEN_DAYS = 14 * ONE_DAY;

  const thisWeek: AnnouncementWithAck[] = [];
  const lastWeek: AnnouncementWithAck[] = [];
  const older: AnnouncementWithAck[] = [];

  items.forEach(item => {
    const itemTime = new Date(item.postedAt).getTime();
    const diff = nowTimestamp - itemTime;

    if (diff < SEVEN_DAYS) {
      thisWeek.push(item);
    } else if (diff < FOURTEEN_DAYS) {
      lastWeek.push(item);
    } else {
      older.push(item);
    }
  });

  return { thisWeek, lastWeek, older };
}
