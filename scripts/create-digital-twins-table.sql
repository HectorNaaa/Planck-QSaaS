-- Create digital_twins table for users to organize and label their quantum simulations
CREATE TABLE IF NOT EXISTS digital_twins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  algorithm TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT digital_twins_name_check CHECK (char_length(name) >= 1 AND char_length(name) <= 100)
);

-- Add digital_twin_id to execution_logs to link executions to their digital twins
ALTER TABLE execution_logs 
ADD COLUMN IF NOT EXISTS digital_twin_id UUID REFERENCES digital_twins(id) ON DELETE SET NULL;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_digital_twins_user_id ON digital_twins(user_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_digital_twin_id ON execution_logs(digital_twin_id);

-- Enable RLS
ALTER TABLE digital_twins ENABLE ROW LEVEL SECURITY;

-- RLS Policies for digital_twins
CREATE POLICY "digital_twins_select_own" ON digital_twins
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "digital_twins_insert_own" ON digital_twins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "digital_twins_update_own" ON digital_twins
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "digital_twins_delete_own" ON digital_twins
  FOR DELETE USING (auth.uid() = user_id);
