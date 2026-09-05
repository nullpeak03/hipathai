-- HiPath AI Database Schema
-- Initial migration for all core tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends Clerk user)
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clerk_id TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    avatar_url TEXT,
    theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    timezone TEXT DEFAULT 'UTC',
    learning_goals TEXT[] DEFAULT '{}',
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Onboarding responses table
CREATE TABLE onboarding_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    career_goal TEXT NOT NULL,
    learning_objective TEXT NOT NULL,
    skill_level TEXT NOT NULL CHECK (skill_level IN ('beginner', 'intermediate', 'advanced')),
    hours_per_week TEXT NOT NULL CHECK (hours_per_week IN ('light', 'moderate', 'intensive')),
    content_format TEXT[] NOT NULL,
    topics_of_interest TEXT[] NOT NULL,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    generated_roadmap_id UUID
);

-- Roadmaps table
CREATE TABLE roadmaps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
    current_phase INTEGER DEFAULT 1,
    version INTEGER DEFAULT 1,
    parent_roadmap_id UUID REFERENCES roadmaps(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roadmap phases table
CREATE TABLE roadmap_phases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    roadmap_id UUID NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL,
    estimated_hours INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roadmap modules table
CREATE TABLE roadmap_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phase_id UUID NOT NULL REFERENCES roadmap_phases(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL,
    estimated_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lessons table
CREATE TABLE lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id UUID NOT NULL REFERENCES roadmap_modules(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('video', 'article', 'interactive', 'quiz', 'project')),
    content_data JSONB DEFAULT '{}',
    order_index INTEGER NOT NULL,
    estimated_minutes INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quizzes table
CREATE TABLE quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('multiple-choice', 'code', 'short-answer')),
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    spaced_repetition_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Questions table
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('multiple-choice', 'code', 'short-answer')),
    prompt TEXT NOT NULL,
    options TEXT[],
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    concept_tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lesson progress table
CREATE TABLE lesson_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT FALSE,
    time_spent INTEGER DEFAULT 0, -- in seconds
    last_position INTEGER DEFAULT 0, -- for video/audio position
    completed_at TIMESTAMPTZ,
    UNIQUE(user_id, lesson_id)
);

-- Quiz attempts table
CREATE TABLE quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    score DECIMAL(5,2) NOT NULL, -- percentage 0-100
    answers JSONB NOT NULL,
    time_spent INTEGER DEFAULT 0, -- in seconds
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    weakness_analysis JSONB
);

-- User concepts table (for spaced repetition and mastery tracking)
CREATE TABLE user_concepts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    concept TEXT NOT NULL,
    mastery_level DECIMAL(5,2) DEFAULT 0, -- 0-100
    last_reviewed TIMESTAMPTZ,
    next_review TIMESTAMPTZ,
    total_attempts INTEGER DEFAULT 0,
    correct_attempts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, concept)
);

-- Study sessions table
CREATE TABLE study_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    roadmap_id UUID REFERENCES roadmaps(id) ON DELETE SET NULL,
    lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
    duration INTEGER NOT NULL, -- in seconds
    activity_type TEXT NOT NULL CHECK (activity_type IN ('lesson', 'quiz', 'review', 'ai-tutor', 'reading')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat sessions table
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    roadmap_id UUID REFERENCES roadmaps(id) ON DELETE SET NULL,
    lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    tool_calls JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Study groups table
CREATE TABLE study_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    invite_code TEXT UNIQUE NOT NULL DEFAULT substring(md5(random()::text || clock_timestamp()::text) from 1 for 8),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group members table
CREATE TABLE group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- Shared roadmaps table
CREATE TABLE shared_roadmaps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
    roadmap_id UUID NOT NULL REFERENCES roadmaps(id) ON DELETE CASCADE,
    permission TEXT NOT NULL CHECK (permission IN ('view', 'edit', 'admin')) DEFAULT 'view',
    shared_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, roadmap_id)
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('reminder', 'streak', 'group-invite', 'group-activity', 'achievement', 'review-due')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_profiles_clerk_id ON profiles(clerk_id);
CREATE INDEX idx_onboarding_responses_user_id ON onboarding_responses(user_id);
CREATE INDEX idx_roadmaps_user_id ON roadmaps(user_id);
CREATE INDEX idx_roadmaps_status ON roadmaps(status);
CREATE INDEX idx_roadmap_phases_roadmap_id ON roadmap_phases(roadmap_id);
CREATE INDEX idx_roadmap_modules_phase_id ON roadmap_modules(phase_id);
CREATE INDEX idx_lessons_module_id ON lessons(module_id);
CREATE INDEX idx_quizzes_lesson_id ON quizzes(lesson_id);
CREATE INDEX idx_questions_quiz_id ON questions(quiz_id);
CREATE INDEX idx_lesson_progress_user_id ON lesson_progress(user_id);
CREATE INDEX idx_lesson_progress_lesson_id ON lesson_progress(lesson_id);
CREATE INDEX idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX idx_user_concepts_user_id ON user_concepts(user_id);
CREATE INDEX idx_user_concepts_next_review ON user_concepts(next_review);
CREATE INDEX idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX idx_study_sessions_created_at ON study_sessions(created_at);
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
CREATE INDEX idx_shared_roadmaps_group_id ON shared_roadmaps(group_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Profiles: Users can only access their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid()::text = clerk_id);
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid()::text = clerk_id);
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid()::text = clerk_id);

-- Onboarding responses: Users can only access their own
CREATE POLICY "Users can view own onboarding" ON onboarding_responses
    FOR SELECT USING (user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text));
CREATE POLICY "Users can insert own onboarding" ON onboarding_responses
    FOR INSERT WITH CHECK (user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text));

-- Roadmaps: Users can only access their own
CREATE POLICY "Users can view own roadmaps" ON roadmaps
    FOR SELECT USING (user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text));
CREATE POLICY "Users can insert own roadmaps" ON roadmaps
    FOR INSERT WITH CHECK (user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text));
CREATE POLICY "Users can update own roadmaps" ON roadmaps
    FOR UPDATE USING (user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text));
CREATE POLICY "Users can delete own roadmaps" ON roadmaps
    FOR DELETE USING (user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text));

-- Roadmap phases: Access through roadmap ownership
CREATE POLICY "Users can view phases of own roadmaps" ON roadmap_phases
    FOR SELECT USING (roadmap_id IN (SELECT id FROM roadmaps WHERE user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text)));
CREATE POLICY "Users can insert phases to own roadmaps" ON roadmap_phases
    FOR INSERT WITH CHECK (roadmap_id IN (SELECT id FROM roadmaps WHERE user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text)));
CREATE POLICY "Users can update phases of own roadmaps" ON roadmap_phases
    FOR UPDATE USING (roadmap_id IN (SELECT id FROM roadmaps WHERE user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text)));

-- Roadmap modules: Access through phase ownership
CREATE POLICY "Users can view modules of own roadmaps" ON roadmap_modules
    FOR SELECT USING (phase_id IN (SELECT id FROM roadmap_phases WHERE roadmap_id IN (SELECT id FROM roadmaps WHERE user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text))));
CREATE POLICY "Users can insert modules to own roadmaps" ON roadmap_modules
    FOR INSERT WITH CHECK (phase_id IN (SELECT id FROM roadmap_phases WHERE roadmap_id IN (SELECT id FROM roadmaps WHERE user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text))));
CREATE POLICY "Users can update modules of own roadmaps" ON roadmap_modules
    FOR UPDATE USING (phase_id IN (SELECT id FROM roadmap_phases WHERE roadmap_id IN (SELECT id FROM roadmaps WHERE user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text))));

-- Lessons: Access through module ownership
CREATE POLICY "Users can view lessons of own roadmaps" ON lessons
    FOR SELECT USING (module_id IN (SELECT id FROM roadmap_modules WHERE phase_id IN (SELECT id FROM roadmap_phases WHERE roadmap_id IN (SELECT id FROM roadmaps WHERE user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text)))));
CREATE POLICY "Users can insert lessons to own roadmaps" ON lessons
    FOR INSERT WITH CHECK (module_id IN (SELECT id FROM roadmap_modules WHERE phase_id IN (SELECT id FROM roadmap_phases WHERE roadmap_id IN (SELECT id FROM roadmaps WHERE user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text)))));
CREATE POLICY "Users can update lessons of own roadmaps" ON lessons
    FOR UPDATE USING (module_id IN (SELECT id FROM roadmap_modules WHERE phase_id IN (SELECT id FROM roadmap_phases WHERE roadmap_id IN (SELECT id FROM roadmaps WHERE user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text)))));

-- Quizzes: Access through lesson ownership
CREATE POLICY "Users can view quizzes of own roadmaps" ON quizzes
    FOR SELECT USING (lesson_id IN (SELECT id FROM lessons WHERE module_id IN (SELECT id FROM roadmap_modules WHERE phase_id IN (SELECT id FROM roadmap_phases WHERE roadmap_id IN (SELECT id FROM roadmaps WHERE user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text))))));
CREATE POLICY "Users can insert quizzes to own roadmaps" ON quizzes
    FOR INSERT WITH CHECK (lesson_id IN (SELECT id FROM lessons WHERE module_id IN (SELECT id FROM roadmap_modules WHERE phase_id IN (SELECT id FROM roadmap_phases WHERE roadmap_id IN (SELECT id FROM roadmaps WHERE user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text))))));

-- Questions: Access through quiz ownership
CREATE POLICY "Users can view questions of own roadmaps" ON questions
    FOR SELECT USING (quiz_id IN (SELECT id FROM quizzes WHERE lesson_id IN (SELECT id FROM lessons WHERE module_id IN (SELECT id FROM roadmap_modules WHERE phase_id IN (SELECT id FROM roadmap_phases WHERE roadmap_id IN (SELECT id FROM roadmaps WHERE user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text)))))));

-- Lesson progress: Users can only access their own
CREATE POLICY "Users can view own lesson progress" ON lesson_progress
    FOR SELECT USING (user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text));
CREATE POLICY "Users can insert own lesson progress" ON lesson_progress
    FOR INSERT WITH CHECK (user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text));
CREATE POLICY "Users can update own lesson progress" ON lesson_progress
    FOR UPDATE USING (user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text));

-- Quiz attempts: Users can only access their own
CREATE POLICY "Users can view own quiz attempts" ON quiz_attempts
    FOR SELECT USING (user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text));
CREATE POLICY "Users can insert own quiz attempts" ON quiz_attempts
    FOR INSERT WITH CHECK (user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text));

-- User concepts: Users can only access their own
CREATE POLICY "Users can view own concepts" ON user_concepts
    FOR SELECT USING (user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text));
CREATE POLICY "Users can insert own concepts" ON user_concepts
    FOR INSERT WITH CHECK (user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text));
CREATE POLICY "Users can update own concepts" ON user_concepts
    FOR UPDATE USING (user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text));

-- Study sessions: Users can only access their own
CREATE POLICY "Users can view own study sessions" ON study_sessions
    FOR SELECT USING (user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text));
CREATE POLICY "Users can insert own study sessions" ON study_sessions
    FOR INSERT WITH CHECK (user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text));

-- Chat sessions: Users can only access their own
CREATE POLICY "Users can view own chat sessions" ON chat_sessions
    FOR SELECT USING (user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text));
CREATE POLICY "Users can insert own chat sessions" ON chat_sessions
    FOR INSERT WITH CHECK (user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text));
CREATE POLICY "Users can update own chat sessions" ON chat_sessions
    FOR UPDATE USING (user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text));

-- Chat messages: Users can only access messages in their own sessions
CREATE POLICY "Users can view messages in own chat sessions" ON chat_messages
    FOR SELECT USING (session_id IN (SELECT id FROM chat_sessions WHERE user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text)));
CREATE POLICY "Users can insert messages in own chat sessions" ON chat_messages
    FOR INSERT WITH CHECK (session_id IN (SELECT id FROM chat_sessions WHERE user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text)));

-- Study groups: Users can view groups they're members of, owners can manage
CREATE POLICY "Users can view groups they belong to" ON study_groups
    FOR SELECT USING (id IN (SELECT group_id FROM group_members WHERE user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text)));
CREATE POLICY "Users can create groups" ON study_groups
    FOR INSERT WITH CHECK (owner_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text));
CREATE POLICY "Owners can update their groups" ON study_groups
    FOR UPDATE USING (owner_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text));

-- Group members: Users can view members of groups they belong to
CREATE POLICY "Users can view members of own groups" ON group_members
    FOR SELECT USING (group_id IN (SELECT group_id FROM group_members WHERE user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text)));
CREATE POLICY "Users can join groups" ON group_members
    FOR INSERT WITH CHECK (user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text));
CREATE POLICY "Admins can manage group members" ON group_members
    FOR ALL USING (group_id IN (SELECT group_id FROM group_members WHERE user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text) AND role IN ('owner', 'admin')));

-- Shared roadmaps: Users can view shared roadmaps in their groups
CREATE POLICY "Users can view shared roadmaps in own groups" ON shared_roadmaps
    FOR SELECT USING (group_id IN (SELECT group_id FROM group_members WHERE user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text)));
CREATE POLICY "Group admins can share roadmaps" ON shared_roadmaps
    FOR INSERT WITH CHECK (group_id IN (SELECT group_id FROM group_members WHERE user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text) AND role IN ('owner', 'admin')));

-- Notifications: Users can only access their own
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text));
CREATE POLICY "Users can insert own notifications" ON notifications
    FOR INSERT WITH CHECK (user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text));
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text));

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_roadmaps_updated_at BEFORE UPDATE ON roadmaps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_roadmap_phases_updated_at BEFORE UPDATE ON roadmap_phases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_roadmap_modules_updated_at BEFORE UPDATE ON roadmap_modules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lessons_updated_at BEFORE UPDATE ON lessons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quizzes_updated_at BEFORE UPDATE ON quizzes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_concepts_updated_at BEFORE UPDATE ON user_concepts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_study_groups_updated_at BEFORE UPDATE ON study_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();