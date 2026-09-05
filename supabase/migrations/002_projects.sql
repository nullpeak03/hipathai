CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  color TEXT NOT NULL DEFAULT 'violet',
  target_date DATE,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects(user_id);
CREATE INDEX IF NOT EXISTS project_milestones_project_id_idx ON project_milestones(project_id);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (
  user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text)
);
CREATE POLICY "Users can insert own projects" ON projects FOR INSERT WITH CHECK (
  user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text)
);
CREATE POLICY "Users can update own projects" ON projects FOR UPDATE USING (
  user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text)
);
CREATE POLICY "Users can delete own projects" ON projects FOR DELETE USING (
  user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text)
);
CREATE POLICY "Users can view own project milestones" ON project_milestones FOR SELECT USING (
  project_id IN (SELECT id FROM projects WHERE user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text))
);
CREATE POLICY "Users can manage own project milestones" ON project_milestones FOR ALL USING (
  project_id IN (SELECT id FROM projects WHERE user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text))
) WITH CHECK (
  project_id IN (SELECT id FROM projects WHERE user_id IN (SELECT id FROM profiles WHERE clerk_id = auth.uid()::text))
);
