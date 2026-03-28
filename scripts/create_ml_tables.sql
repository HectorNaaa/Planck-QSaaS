-- ML Feature Vectors Table: Stores normalized feature vectors for each execution
CREATE TABLE IF NOT EXISTS ml_feature_vectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES execution_logs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Normalized feature vector (0-1 range)
  features VECTOR(12), -- Using pgvector extension
  
  -- Raw features for debugging
  feature_metadata JSONB,
  
  -- Actual outcomes (for training)
  actual_shots INTEGER,
  actual_backend TEXT,
  actual_runtime_ms NUMERIC,
  actual_success_rate NUMERIC,
  actual_fidelity NUMERIC,
  
  -- Predicted values (before execution)
  predicted_shots INTEGER,
  predicted_backend TEXT,
  predicted_runtime_ms NUMERIC,
  predicted_fidelity NUMERIC,
  
  -- Reward signal for RL
  reward_score NUMERIC, -- Composite score based on fidelity, runtime, cost
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes for fast similarity search
  INDEX idx_ml_vectors_user (user_id),
  INDEX idx_ml_vectors_created (created_at DESC)
);

-- Enable RLS
ALTER TABLE ml_feature_vectors ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY ml_vectors_select_all ON ml_feature_vectors
  FOR SELECT USING (true); -- Allow all users to benefit from network effect

CREATE POLICY ml_vectors_insert_own ON ml_feature_vectors
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ML Model Performance Table: Track model accuracy over time
CREATE TABLE IF NOT EXISTS ml_model_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL, -- 'shots_accuracy', 'backend_accuracy', 'fidelity_error'
  metric_value NUMERIC NOT NULL,
  sample_size INTEGER NOT NULL,
  time_window TEXT NOT NULL, -- '1h', '24h', '7d', '30d'
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_ml_metrics_type_created (metric_type, created_at DESC)
);

-- Enable RLS
ALTER TABLE ml_model_metrics ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read metrics
CREATE POLICY ml_metrics_select_all ON ml_model_metrics
  FOR SELECT USING (auth.role() = 'authenticated');

-- ML Recommendations Cache: Store recent recommendations for fast lookup
CREATE TABLE IF NOT EXISTS ml_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_hash TEXT UNIQUE NOT NULL, -- Hash of feature vector for deduplication
  recommended_shots INTEGER NOT NULL,
  recommended_backend TEXT NOT NULL,
  confidence_score NUMERIC NOT NULL, -- 0-1, how confident the model is
  based_on_executions INTEGER NOT NULL, -- Number of similar historical executions
  
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 hour',
  
  INDEX idx_ml_recommendations_hash (feature_hash),
  INDEX idx_ml_recommendations_expires (expires_at)
);

-- Enable RLS
ALTER TABLE ml_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY ml_recommendations_select_all ON ml_recommendations
  FOR SELECT USING (true);

-- Enable pgvector extension for similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create similarity search function
CREATE OR REPLACE FUNCTION find_similar_executions(
  query_vector VECTOR(12),
  similarity_threshold FLOAT DEFAULT 0.8,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  execution_id UUID,
  similarity FLOAT,
  actual_shots INTEGER,
  actual_backend TEXT,
  actual_runtime_ms NUMERIC,
  actual_success_rate NUMERIC,
  reward_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mfv.execution_id,
    1 - (mfv.features <=> query_vector) AS similarity,
    mfv.actual_shots,
    mfv.actual_backend,
    mfv.actual_runtime_ms,
    mfv.actual_success_rate,
    mfv.reward_score
  FROM ml_feature_vectors mfv
  WHERE 1 - (mfv.features <=> query_vector) >= similarity_threshold
  ORDER BY mfv.features <=> query_vector
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
