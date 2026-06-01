export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acknowledgments: {
        Row: {
          acknowledged_at: string
          announcement_id: string
          id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          announcement_id: string
          id?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          announcement_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acknowledgments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acknowledgments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_comments: {
        Row: {
          announcement_id: string
          author_id: string
          content: string
          created_at: string
          id: string
          is_verified: boolean
        }
        Insert: {
          announcement_id: string
          author_id: string
          content: string
          created_at?: string
          id?: string
          is_verified?: boolean
        }
        Update: {
          announcement_id?: string
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          is_verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "announcement_comments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_reactions: {
        Row: {
          announcement_id: string
          created_at: string
          emoji: string
          id: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          created_at?: string
          emoji: string
          id?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          created_at?: string
          emoji?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reactions_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_thread_mutes: {
        Row: {
          announcement_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_thread_mutes_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_thread_mutes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          author_id: string | null
          created_at: string
          deadline_at: string | null
          expires_at: string | null
          id: string
          is_pinned: boolean
          is_template: boolean
          message_content: string
          notification_sent: boolean
          nudge_sent: boolean
          priority: Database["public"]["Enums"]["announcement_priority"]
          section_id: string
          title: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          deadline_at?: string | null
          expires_at?: string | null
          id?: string
          is_pinned?: boolean
          is_template?: boolean
          message_content: string
          notification_sent?: boolean
          nudge_sent?: boolean
          priority?: Database["public"]["Enums"]["announcement_priority"]
          section_id: string
          title: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          deadline_at?: string | null
          expires_at?: string | null
          id?: string
          is_pinned?: boolean
          is_template?: boolean
          message_content?: string
          notification_sent?: boolean
          nudge_sent?: boolean
          priority?: Database["public"]["Enums"]["announcement_priority"]
          section_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_sets: {
        Row: {
          assignment_id: string
          description: string
          id: string
          page_numbers: string | null
          pdf_url: string | null
          roll_end: number
          roll_start: number
          set_label: string
        }
        Insert: {
          assignment_id: string
          description: string
          id?: string
          page_numbers?: string | null
          pdf_url?: string | null
          roll_end: number
          roll_start: number
          set_label: string
        }
        Update: {
          assignment_id?: string
          description?: string
          id?: string
          page_numbers?: string | null
          pdf_url?: string | null
          roll_end?: number
          roll_start?: number
          set_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_sets_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string
          id: string
          nudge_sent: boolean
          section_id: string
          subject_id: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date: string
          id?: string
          nudge_sent?: boolean
          section_id: string
          subject_id: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string
          id?: string
          nudge_sent?: boolean
          section_id?: string
          subject_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          announcement_id: string | null
          assignment_id: string | null
          created_at: string
          file_size: number
          file_type: string
          filename: string
          id: string
          section_id: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          announcement_id?: string | null
          assignment_id?: string | null
          created_at?: string
          file_size: number
          file_type: string
          filename: string
          id?: string
          section_id: string
          storage_path: string
          uploaded_by: string
        }
        Update: {
          announcement_id?: string | null
          assignment_id?: string | null
          created_at?: string
          file_size?: number
          file_type?: string
          filename?: string
          id?: string
          section_id?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          absent: number
          id: string
          makeup: number
          od: number
          percentage: number | null
          present: number
          subject_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          absent?: number
          id?: string
          makeup?: number
          od?: number
          percentage?: number | null
          present?: number
          subject_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          absent?: number
          id?: string
          makeup?: number
          od?: number
          percentage?: number | null
          present?: number
          subject_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cr_transfer_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          note: string | null
          section_id: string
          target_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          note?: string | null
          section_id: string
          target_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          note?: string | null
          section_id?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cr_transfer_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cr_transfer_log_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cr_transfer_log_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_overrides: {
        Row: {
          created_by: string | null
          exam_id: string
          id: string
          room: string | null
          seating_plan_path: string | null
          section_id: string
          updated_at: string | null
        }
        Insert: {
          created_by?: string | null
          exam_id: string
          id?: string
          room?: string | null
          seating_plan_path?: string | null
          section_id: string
          updated_at?: string | null
        }
        Update: {
          created_by?: string | null
          exam_id?: string
          id?: string
          room?: string | null
          seating_plan_path?: string | null
          section_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_overrides_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_overrides_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          created_at: string | null
          created_by: string | null
          end_time: string
          exam_date: string
          exam_type: string
          id: string
          max_marks: number | null
          room: string | null
          seating_plan_path: string | null
          semester: number
          start_time: string
          subject_code: string
          subject_name: string
          syllabus_pdf_path: string | null
          syllabus_units: string[] | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          end_time: string
          exam_date: string
          exam_type: string
          id?: string
          max_marks?: number | null
          room?: string | null
          seating_plan_path?: string | null
          semester: number
          start_time: string
          subject_code: string
          subject_name: string
          syllabus_pdf_path?: string | null
          syllabus_units?: string[] | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          end_time?: string
          exam_date?: string
          exam_type?: string
          id?: string
          max_marks?: number | null
          room?: string | null
          seating_plan_path?: string | null
          semester?: number
          start_time?: string
          subject_code?: string
          subject_name?: string
          syllabus_pdf_path?: string | null
          syllabus_units?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "exams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_reports: {
        Row: {
          created_at: string | null
          description: string
          developer_notes: string | null
          device_info: Json
          id: string
          status: string
          title: string
          type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          developer_notes?: string | null
          device_info: Json
          id?: string
          status?: string
          title: string
          type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          developer_notes?: string | null
          device_info?: Json
          id?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      global_pyqs: {
        Row: {
          created_at: string | null
          id: string
          is_latest: boolean | null
          semester: string
          url: string
          year: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_latest?: boolean | null
          semester: string
          url: string
          year: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_latest?: boolean | null
          semester?: string
          url?: string
          year?: string
        }
        Relationships: []
      }
      global_resources: {
        Row: {
          accent_color: string | null
          branch: string
          id: string
          lab_url: string | null
          notes_url: string | null
          practice_url: string | null
          pyqs_url: string | null
          semester: string
          subject_code: string
          subject_name: string
          syllabus_url: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          accent_color?: string | null
          branch: string
          id?: string
          lab_url?: string | null
          notes_url?: string | null
          practice_url?: string | null
          pyqs_url?: string | null
          semester: string
          subject_code: string
          subject_name: string
          syllabus_url?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          accent_color?: string | null
          branch?: string
          id?: string
          lab_url?: string | null
          notes_url?: string | null
          practice_url?: string | null
          pyqs_url?: string | null
          semester?: string
          subject_code?: string
          subject_name?: string
          syllabus_url?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "global_resources_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          error_message: string | null
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          read_at: string | null
          recipient_id: string | null
          section_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          target_id: string | null
          target_table: string | null
          title: string | null
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          read_at?: string | null
          recipient_id?: string | null
          section_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          target_id?: string | null
          target_table?: string | null
          title?: string | null
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          read_at?: string | null
          recipient_id?: string | null
          section_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          target_id?: string | null
          target_table?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_options: {
        Row: {
          id: string
          label: string
          poll_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          label: string
          poll_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          label?: string
          poll_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          allow_multiple: boolean
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          poll_type: Database["public"]["Enums"]["poll_type"]
          question_text: string
          section_id: string
        }
        Insert: {
          allow_multiple?: boolean
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          poll_type?: Database["public"]["Enums"]["poll_type"]
          question_text: string
          section_id: string
        }
        Update: {
          allow_multiple?: boolean
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          poll_type?: Database["public"]["Enums"]["poll_type"]
          question_text?: string
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          college: string
          created_at: string
          created_by: string | null
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          college?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invite_code: string
          name: string
        }
        Update: {
          college?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      student_exam_prep: {
        Row: {
          exam_id: string
          id: string
          is_prepared: boolean
          unit_index: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          exam_id: string
          id?: string
          is_prepared?: boolean
          unit_index: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          exam_id?: string
          id?: string
          is_prepared?: boolean
          unit_index?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_exam_prep_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_exam_prep_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          accent: string
          code: string
          created_at: string
          id: string
          name: string
          section_id: string
          semester: number
        }
        Insert: {
          accent?: string
          code: string
          created_at?: string
          id?: string
          name: string
          section_id: string
          semester: number
        }
        Update: {
          accent?: string
          code?: string
          created_at?: string
          id?: string
          name?: string
          section_id?: string
          semester?: number
        }
        Relationships: [
          {
            foreignKeyName: "subjects_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          assignment_id: string
          cr_verified: boolean
          id: string
          nudge_sent: boolean
          status: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submission_link: string | null
          submitted_at: string | null
        }
        Insert: {
          assignment_id: string
          cr_verified?: boolean
          id?: string
          nudge_sent?: boolean
          status?: Database["public"]["Enums"]["submission_status"]
          student_id: string
          submission_link?: string | null
          submitted_at?: string | null
        }
        Update: {
          assignment_id?: string
          cr_verified?: boolean
          id?: string
          nudge_sent?: boolean
          status?: Database["public"]["Enums"]["submission_status"]
          student_id?: string
          submission_link?: string | null
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      timetable_slots: {
        Row: {
          created_at: string
          created_by: string | null
          day_of_week: number
          end_time: string
          id: string
          room: string | null
          section_id: string
          start_time: string
          subject_id: string | null
          teacher: string | null
          type: Database["public"]["Enums"]["slot_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          day_of_week: number
          end_time: string
          id?: string
          room?: string | null
          section_id: string
          start_time: string
          subject_id?: string | null
          teacher?: string | null
          type?: Database["public"]["Enums"]["slot_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          room?: string | null
          section_id?: string
          start_time?: string
          subject_id?: string | null
          teacher?: string | null
          type?: Database["public"]["Enums"]["slot_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_slots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_slots_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_gpa_data: {
        Row: {
          gpa_state: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          gpa_state?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          gpa_state?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_gpa_data_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          cr_rank: string | null
          created_at: string
          day_scholar: boolean
          email: string
          id: string
          is_developer: boolean
          name: string
          notifications_enabled: boolean
          role: Database["public"]["Enums"]["user_role"]
          section_id: string | null
          section_roll: string | null
          university_roll: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          cr_rank?: string | null
          created_at?: string
          day_scholar?: boolean
          email: string
          id: string
          is_developer?: boolean
          name: string
          notifications_enabled?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          section_id?: string | null
          section_roll?: string | null
          university_roll?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          cr_rank?: string | null
          created_at?: string
          day_scholar?: boolean
          email?: string
          id?: string
          is_developer?: boolean
          name?: string
          notifications_enabled?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          section_id?: string | null
          section_roll?: string | null
          university_roll?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          anonymous_token: string | null
          id: string
          option_id: string
          poll_id: string
          student_id: string | null
          voted_at: string
        }
        Insert: {
          anonymous_token?: string | null
          id?: string
          option_id: string
          poll_id: string
          student_id?: string | null
          voted_at?: string
        }
        Update: {
          anonymous_token?: string | null
          id?: string
          option_id?: string
          poll_id?: string
          student_id?: string | null
          voted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      batch_poll_results: {
        Args: { target_polls: string[] }
        Returns: {
          option_id: string
          poll_id: string
          votes: number
        }[]
      }
      batch_poll_voter_counts: {
        Args: { target_polls: string[] }
        Returns: {
          poll_id: string
          voter_count: number
        }[]
      }
      calculate_anonymous_token: {
        Args: { poll_id: string; user_id: string }
        Returns: string
      }
      create_section_hub: {
        Args: {
          class_roll: string
          invite: string
          section_name: string
          uni_roll: string
        }
        Returns: {
          college: string
          created_at: string
          created_by: string | null
          id: string
          invite_code: string
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "sections"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      current_user_section_id: { Args: never; Returns: string }
      delete_own_account: { Args: never; Returns: undefined }
      delete_section_hub: {
        Args: { target_section_id: string }
        Returns: undefined
      }
      demote_co_cr: { Args: { target_user_id: string }; Returns: undefined }
      is_cr_for_section: { Args: { target_section: string }; Returns: boolean }
      is_primary_cr_for_section: {
        Args: { target_section: string }
        Returns: boolean
      }
      is_skit_email: { Args: { email: string }; Returns: boolean }
      join_section: {
        Args: { class_roll: string; invite: string; uni_roll: string }
        Returns: {
          avatar_url: string | null
          cr_rank: string | null
          created_at: string
          day_scholar: boolean
          email: string
          id: string
          is_developer: boolean
          name: string
          notifications_enabled: boolean
          role: Database["public"]["Enums"]["user_role"]
          section_id: string | null
          section_roll: string | null
          university_roll: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "users"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      poll_results: {
        Args: { target_poll: string }
        Returns: {
          label: string
          option_id: string
          percentage: number
          votes: number
        }[]
      }
      promote_to_co_cr: { Args: { target_user_id: string }; Returns: undefined }
      resign_as_cr: { Args: never; Returns: undefined }
      transfer_primary_cr: {
        Args: { new_primary_id: string; old_cr_action?: string }
        Returns: undefined
      }
    }
    Enums: {
      announcement_priority: "general" | "critical"
      notification_kind:
        | "critical_announcement"
        | "ack_nudge"
        | "assignment_reminder"
        | "general_announcement"
        | "new_assignment"
        | "new_poll"
        | "custom"
        | "qa_verified"
        | "qa_reply"
        | "qa_question_agg"
      notification_status: "queued" | "sent" | "failed"
      poll_type: "general" | "actionable"
      slot_type: "lecture" | "lab" | "tutorial" | "other"
      submission_status: "pending" | "submitted"
      user_role: "student" | "cr" | "developer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      announcement_priority: ["general", "critical"],
      notification_kind: [
        "critical_announcement",
        "ack_nudge",
        "assignment_reminder",
        "general_announcement",
        "new_assignment",
        "new_poll",
        "custom",
        "qa_verified",
        "qa_reply",
        "qa_question_agg",
      ],
      notification_status: ["queued", "sent", "failed"],
      poll_type: ["general", "actionable"],
      slot_type: ["lecture", "lab", "tutorial", "other"],
      submission_status: ["pending", "submitted"],
      user_role: ["student", "cr", "developer"],
    },
  },
} as const
