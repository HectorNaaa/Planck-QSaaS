-- ml_execution_features: Lightweight aggregate of every execution's circuit
-- features + outcome. Used by the RL engine for network-effect learning.
-- Intentionally stores NO raw QASM / circuit payloads to keep rows small.

CREATE TABLE IF NOT EXISTS ml_execution_features (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id  uuid REFERENCES execution_logs(id) ON DELETE SET NULL,
  user_id       uuid NOT NULL,
  created_at    timestamptz DEFAULT now(),

  -- Circuit features (compact)
  algorithm     text NOT NULL,
  num_qubits    integer NOT NULL,
  circuit_depth integer NOT NULL,
  gate_count    integer NOT NULL,
  data_size     integer DEFAULT 0,
  data_complexity double precision DEFAULT 0.5,

  -- Configuration used
  shots_used        integer NOT NULL,
  backend_used      text NOT NULL,
  error_mitigation  text NOT NULL DEFAULT 'none',
  target_latency_ms double precision DEFAULT 0,

  -- Outcome metrics
  success_rate    double precision NOT NULL,
  runtime_ms      double precision NOT NULL,
  fidelity_score  double precision NOT NULL,
  reward_score    double precision DEFAULT 0,

  -- Normalised feature vector for similarity search
  feature_vector  vector(12)
);

-- Index for fast similarity search (IVFFlat)
-- If pgvector is installed, this dramatically speeds up kNN queries.
-- The list count (100) works well up to ~1M rows.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ml_exec_features_vector
             ON ml_execution_features USING ivfflat (feature_vector vector_cosine_ops)
             WITH (lists = 100)';
  END IF;
END
$$;

-- B-tree indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ml_exec_feat_algo   ON ml_execution_features (algorithm);
CREATE INDEX IF NOT EXISTS idx_ml_exec_feat_qubits ON ml_execution_features (num_qubits);
CREATE INDEX IF NOT EXISTS idx_ml_exec_feat_created ON ml_execution_features (created_at DESC);

-- Function: find similar executions from the mega-table
CREATE OR REPLACE FUNCTION find_similar_execution_features(
  query_vector vector(12),
  similarity_threshold double precision DEFAULT 0.7,
  limit_count integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  algorithm text,
  num_qubits integer,
  circuit_depth integer,
  gate_count integer,
  shots_used integer,
  backend_used text,
  error_mitigation text,
  success_rate double precision,
  runtime_ms double precision,
  fidelity_score double precision,
  reward_score double precision,
  similarity double precision
)
LANGUAGE sql STABLE
AS $$
  SELECT
    f.id,
    f.algorithm,
    f.num_qubits,
    f.circuit_depth,
    f.gate_count,
    f.shots_used,
    f.backend_used,
    f.error_mitigation,
    f.success_rate,
    f.runtime_ms,
    f.fidelity_score,
    f.reward_score,
    1 - (f.feature_vector <=> query_vector) AS similarity
  FROM ml_execution_features f
  WHERE 1 - (f.feature_vector <=> query_vector) >= similarity_threshold
  ORDER BY f.feature_vector <=> query_vector
  LIMIT limit_count;
$$;

-- RLS: all authenticated users can SELECT (network effect requires cross-user learning).
-- INSERT restricted to service_role (admin client from API routes).
ALTER TABLE ml_execution_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY ml_exec_feat_select_all ON ml_execution_features
  FOR SELECT USING (true);

CREATE POLICY ml_exec_feat_insert_service ON ml_execution_features
  FOR INSERT WITH CHECK (true);
