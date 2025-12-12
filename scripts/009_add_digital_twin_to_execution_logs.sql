-- Add digital_twin column to execution_logs table to store Digital Twin data
ALTER TABLE execution_logs
ADD COLUMN IF NOT EXISTS digital_twin JSONB;

-- Add index for faster Digital Twin queries
CREATE INDEX IF NOT EXISTS idx_execution_logs_digital_twin 
ON execution_logs USING GIN (digital_twin);

-- Add circuit_data column if it doesn't exist (for storing complete circuit information)
ALTER TABLE execution_logs
ADD COLUMN IF NOT EXISTS circuit_data JSONB;

-- Add index for circuit data queries
CREATE INDEX IF NOT EXISTS idx_execution_logs_circuit_data 
ON execution_logs USING GIN (circuit_data);

-- Add comments
COMMENT ON COLUMN execution_logs.digital_twin IS 'Digital Twin representation for interpretability and simulation';
COMMENT ON COLUMN execution_logs.circuit_data IS 'Complete circuit information including QASM, gates, and metadata';
