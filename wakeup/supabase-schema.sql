-- Family Voice Message Ap1111

p Database Schema

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types (enums)
CREATE TYPE family_connection_status AS ENUM ('pending', 'accepted', 'blocked');
CREATE TYPE notification_type AS ENUM ('message_received', 'connection_request', 'connection_accepted');

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Family connections table (bidirectional relationships)
CREATE TABLE family_connections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user1_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user2_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status family_connection_status DEFAULT 'pending',
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user1_id, user2_id),
  CHECK(user1_id != user2_id),
  CHECK(user1_id < user2_id) -- Ensure consistent ordering
);


-- Message requests table
CREATE TABLE message_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  requester_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Voice messages table
CREATE TABLE voice_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  audio_url TEXT NOT NULL,
  duration INTEGER, -- in seconds
  category TEXT,
  message_type TEXT DEFAULT 'direct',
  request_id UUID REFERENCES message_requests(id),
  is_read BOOLEAN DEFAULT FALSE,
  -- Audio metadata
  audio_metadata JSONB, -- File size, format, sample rate, etc.
  -- Emotion analysis data
  emotion_analysis JSONB, -- Stores EmotionAnalysisResult
  emotion_analyzed_at TIMESTAMPTZ,
  dominant_emotion TEXT,
  emotion_confidence DECIMAL(3,2), -- 0.00 to 1.00
  arousal_level DECIMAL(3,2), -- 0.00 to 1.00
  valence_level DECIMAL(3,2), -- 0.00 to 1.00
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_family_connections_user1 ON family_connections(user1_id);
CREATE INDEX idx_family_connections_user2 ON family_connections(user2_id);
CREATE INDEX idx_family_connections_status ON family_connections(status);
CREATE INDEX idx_message_requests_requester ON message_requests(requester_id);
CREATE INDEX idx_message_requests_receiver ON message_requests(receiver_id);
CREATE INDEX idx_message_requests_status ON message_requests(status);
CREATE INDEX idx_voice_messages_sender ON voice_messages(sender_id);
CREATE INDEX idx_voice_messages_receiver ON voice_messages(receiver_id);
CREATE INDEX idx_voice_messages_created ON voice_messages(created_at DESC);
CREATE INDEX idx_voice_messages_emotion ON voice_messages(dominant_emotion);
CREATE INDEX idx_voice_messages_analyzed ON voice_messages(emotion_analyzed_at);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);

-- Row Level Security (RLS) policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (TRUE);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Family connections policies
CREATE POLICY "Users can view their family connections" ON family_connections FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users can create family connections" ON family_connections FOR INSERT
  WITH CHECK (auth.uid() = created_by AND (auth.uid() = user1_id OR auth.uid() = user2_id));
CREATE POLICY "Users can update family connections they're involved in" ON family_connections FOR UPDATE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Message requests policies
CREATE POLICY "Users can view their message requests" ON message_requests FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can create message requests" ON message_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Users can update message requests they're involved in" ON message_requests FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

-- Voice messages policies
CREATE POLICY "Users can view voice messages they're involved in" ON voice_messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can create messages as sender" ON voice_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update messages they received (mark as read)" ON voice_messages FOR UPDATE
  USING (auth.uid() = receiver_id);


-- Notifications policies
CREATE POLICY "Users can view their notifications" ON notifications FOR SELECT 
  USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON notifications FOR INSERT 
  WITH CHECK (TRUE); -- Will be handled by triggers/functions
CREATE POLICY "Users can update their notifications" ON notifications FOR UPDATE 
  USING (auth.uid() = user_id);

-- Functions for automatic profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_family_connections_updated_at BEFORE UPDATE ON family_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_message_requests_updated_at BEFORE UPDATE ON message_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_voice_messages_updated_at BEFORE UPDATE ON voice_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();