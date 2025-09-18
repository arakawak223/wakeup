// Supabase Database Types for Family Voice Message App

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          display_name: string | null
          avatar_url: string | null
          role: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          avatar_url?: string | null
          role?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          avatar_url?: string | null
          role?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      family_connections: {
        Row: {
          id: string
          user1_id: string
          user2_id: string
          status: 'pending' | 'accepted' | 'blocked'
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user1_id: string
          user2_id: string
          status?: 'pending' | 'accepted' | 'blocked'
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user1_id?: string
          user2_id?: string
          status?: 'pending' | 'accepted' | 'blocked'
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      voice_messages: {
        Row: {
          id: string
          sender_id: string
          receiver_id: string
          title: string | null
          audio_url: string
          duration: number | null
          category: string | null
          message_type: string
          request_id: string | null
          is_read: boolean
          audio_metadata: any | null
          emotion_analysis: any | null
          emotion_analyzed_at: string | null
          dominant_emotion: string | null
          emotion_confidence: number | null
          arousal_level: number | null
          valence_level: number | null
          emotion_primary: string | null
          emotion_arousal: number | null
          quality_score: number | null
          transcription: string | null
          transcription_confidence: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sender_id: string
          receiver_id: string
          title?: string | null
          audio_url: string
          duration?: number | null
          category?: string | null
          message_type?: string
          request_id?: string | null
          is_read?: boolean
          audio_metadata?: any | null
          emotion_analysis?: any | null
          emotion_analyzed_at?: string | null
          dominant_emotion?: string | null
          emotion_confidence?: number | null
          arousal_level?: number | null
          valence_level?: number | null
          emotion_primary?: string | null
          emotion_arousal?: number | null
          quality_score?: number | null
          transcription?: string | null
          transcription_confidence?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sender_id?: string
          receiver_id?: string
          title?: string | null
          audio_url?: string
          duration?: number | null
          category?: string | null
          message_type?: string
          request_id?: string | null
          is_read?: boolean
          audio_metadata?: any | null
          emotion_analysis?: any | null
          emotion_analyzed_at?: string | null
          dominant_emotion?: string | null
          emotion_confidence?: number | null
          arousal_level?: number | null
          valence_level?: number | null
          emotion_primary?: string | null
          emotion_arousal?: number | null
          quality_score?: number | null
          transcription?: string | null
          transcription_confidence?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      message_requests: {
        Row: {
          id: string
          requester_id: string
          receiver_id: string
          message: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          requester_id: string
          receiver_id: string
          message: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          requester_id?: string
          receiver_id?: string
          message?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: 'message_received' | 'connection_request' | 'connection_accepted'
          title: string
          message: string
          data: any | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'message_received' | 'connection_request' | 'connection_accepted'
          title: string
          message: string
          data?: any | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'message_received' | 'connection_request' | 'connection_accepted'
          title?: string
          message?: string
          data?: any | null
          is_read?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      family_connection_status: 'pending' | 'accepted' | 'blocked'
      notification_type: 'message_received' | 'connection_request' | 'connection_accepted'
    }
  }
}