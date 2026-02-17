"""
Planck SDK Client - Main interface for interacting with Planck Platform

Install with: pip install planck_sdk
"""

import json
import time
import re
import html
from typing import Any, Dict, List, Optional, Union
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from .circuit import QuantumCircuit
from .result import ExecutionResult
from .exceptions import AuthenticationError, APIError, CircuitError, ValidationError


class PlanckUser:
    """
    Main user interface for interacting with the Planck Quantum Digital Twins Platform.
    
    Args:
        api_key: Your Planck API key (found in Settings > API Keys)
        base_url: API base URL (default: https://plancktechnologies.xyz)
        timeout: Request timeout in seconds (default: 60)
    
    Example:
        >>> from planck_sdk import PlanckUser
        >>> user = PlanckUser(api_key="sk_live_xxx")
        >>> result = user.run(data=[1,2,3], algorithm="grover")
        >>> print(result.counts)
    """
    
    DEFAULT_BASE_URL = "https://plancktechnologies.xyz"
    MIN_REQUEST_INTERVAL = 3.0  # Minimum 3 seconds between requests
    MAX_PAYLOAD_SIZE = 1024 * 1024  # 1MB
    
    # Supported algorithms
    SUPPORTED_ALGORITHMS = ["vqe", "grover", "qaoa", "qft", "bell", "shor"]
    
    # Supported backends — must match API (security.ts) and UI (execution-settings.tsx)
    SUPPORTED_BACKENDS = ["auto", "quantum_inspired_gpu", "hpc_gpu", "quantum_qpu"]
    
    # Supported error mitigation levels — must match API (security.ts) and UI (circuit-settings.tsx)
    SUPPORTED_ERROR_MITIGATION = ["none", "low", "medium", "high"]
    
    def __init__(
        self,
        api_key: str,
        base_url: Optional[str] = None,
        timeout: int = 60
    ):
        if not api_key:
            raise AuthenticationError("API key is required. Get yours at https://plancktechnologies.xyz/qsaas/settings")
        
        # Validate API key format (basic check)
        if not self._validate_api_key(api_key):
            raise AuthenticationError("Invalid API key format. API keys should be alphanumeric.")
        
        self.api_key = api_key
        self.base_url = (base_url or self.DEFAULT_BASE_URL).rstrip("/")
        self.timeout = timeout
        self._last_request_time: float = 0.0
    
    @staticmethod
    def _validate_api_key(api_key: str) -> bool:
        """Validate API key format to prevent injection attacks."""
        # API keys should be alphanumeric with underscores/hyphens, 20-100 chars
        if not api_key or len(api_key) < 10 or len(api_key) > 200:
            return False
        # Only allow alphanumeric, underscores, hyphens
        return bool(re.match(r'^[a-zA-Z0-9_-]+$', api_key))
    
    @staticmethod
    def _sanitize_string(value: str, max_length: int = 1000) -> str:
        """Sanitize string input to prevent injection attacks."""
        if not isinstance(value, str):
            return str(value)[:max_length]
        # HTML escape and truncate
        sanitized = html.escape(value)
        return sanitized[:max_length]
    
    @staticmethod
    def _validate_algorithm(algorithm: str) -> str:
        """Validate and normalize algorithm name."""
        if not algorithm:
            return "vqe"
        normalized = algorithm.lower().strip()
        # Map common variations
        algorithm_map = {
            "bell": "Bell",
            "grover": "Grover", 
            "shor": "Shor",
            "vqe": "VQE",
            "qaoa": "QAOA",
            "qft": "QFT",
        }
        return algorithm_map.get(normalized, "VQE")
    
    def _validate_input_data(self, data: Any) -> Any:
        """Validate and sanitize input data."""
        if data is None:
            raise ValidationError("Input data cannot be None")
        
        if isinstance(data, str):
            # If it's a file path, just return it
            return data
        
        if isinstance(data, (list, tuple)):
            # Validate list elements
            if len(data) > 10000:
                raise ValidationError("Input data list too large. Maximum 10,000 elements.")
            return list(data)
        
        if isinstance(data, dict):
            # Validate dict size
            if len(json.dumps(data)) > self.MAX_PAYLOAD_SIZE:
                raise ValidationError("Input data dict too large. Maximum 1MB.")
            return data
        
        raise ValidationError(f"Unsupported data type: {type(data)}. Use list, dict, or file path.")
    
    def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make an HTTP request to the Planck API with security validations."""
        # Rate limiting: Wait at least 3 seconds between requests
        current_time = time.time()
        time_since_last_request = current_time - self._last_request_time
        
        if time_since_last_request < self.MIN_REQUEST_INTERVAL:
            wait_time = self.MIN_REQUEST_INTERVAL - time_since_last_request
            time.sleep(wait_time)
        
        # Validate payload size
        if data:
            payload_str = json.dumps(data)
            payload_size = len(payload_str.encode("utf-8"))
            if payload_size > self.MAX_PAYLOAD_SIZE:
                raise APIError(
                    f"Payload size ({payload_size} bytes) exceeds maximum allowed size "
                    f"({self.MAX_PAYLOAD_SIZE} bytes). Please reduce your input data size."
                )
        
        # Build URL (sanitize endpoint)
        clean_endpoint = re.sub(r'[^\w/-]', '', endpoint)
        url = f"{self.base_url}/api/quantum/{clean_endpoint}"
        
        headers = {
            "Content-Type": "application/json",
            "X-API-Key": self.api_key,
            "X-Planck-SDK": "python/1.0.0",
            "User-Agent": "PlanckSDK/1.0.0 Python",
        }
        
        body = json.dumps(data).encode("utf-8") if data else None
        
        self._last_request_time = time.time()
        
        req = Request(url, data=body, headers=headers, method=method)
        
        try:
            with urlopen(req, timeout=self.timeout) as response:
                response_body = response.read().decode("utf-8")
                return json.loads(response_body)
        except HTTPError as e:
            error_body = e.read().decode("utf-8")
            try:
                error_data = json.loads(error_body)
                message = error_data.get("error", str(e))
            except:
                message = error_body or str(e)
            
            if e.code == 401:
                raise AuthenticationError(f"Authentication failed: {message}. Check your API key.")
            elif e.code == 400:
                raise CircuitError(f"Invalid request: {message}")
            elif e.code == 429:
                retry_after = e.headers.get("Retry-After", "3")
                raise APIError(
                    f"Rate limit exceeded. Please wait {retry_after} seconds before retrying. "
                    f"The API allows 1 request every 3 seconds."
                )
            elif e.code == 413:
                raise APIError(
                    f"Payload too large: {message}. Maximum payload size is 1MB. "
                    f"Please reduce your input data size."
                )
            else:
                raise APIError(f"API error ({e.code}): {message}")
        except URLError as e:
            raise APIError(f"Connection error: {e.reason}. Check your internet connection and API URL.")
        except json.JSONDecodeError as e:
            raise APIError(f"Invalid response from server: {e}")
    
    def run(
        self,
        data: Union[List, Dict, str],
        algorithm: str = "vqe",
        shots: Optional[int] = None,
        backend: str = "auto",
        error_mitigation: str = "medium",
        circuit_name: Optional[str] = None,
        target_latency: Optional[int] = None,
        qubits: Optional[int] = None,
        wait: bool = True
    ) -> ExecutionResult:
        """
        Generate and execute a quantum circuit based on input data.
        
        Args:
            data: Input data (list, dict, or file path to CSV/JSON)
            algorithm: Algorithm type ('vqe', 'grover', 'qaoa', 'qft', 'bell', 'shor')
            shots: Number of measurement shots (1-100000, auto-calculated if None)
            backend: Execution backend ('auto', 'quantum_inspired_gpu', 'hpc_gpu', 'quantum_qpu')
            error_mitigation: Error mitigation level ('none', 'low', 'medium', 'high')
            circuit_name: Optional name for the execution
            target_latency: Target latency in ms (affects backend selection)
            qubits: Number of qubits (1-30, auto-calculated if None)
            wait: Wait for completion (default: True)
        
        Returns:
            ExecutionResult object with counts, fidelity, and metadata
        
        Example:
            >>> result = user.run(
            ...     data=[1.0, 2.0, 3.0, 4.0],
            ...     algorithm="vqe",
            ...     shots=2048
            ... )
            >>> print(result.counts)
            {'0000': 512, '0001': 256, ...}
        """
        # Validate inputs
        validated_data = self._validate_input_data(data)
        validated_algorithm = self._validate_algorithm(algorithm)
        
        # Validate backend
        if backend not in self.SUPPORTED_BACKENDS:
            backend = "auto"
        
        # Validate error mitigation
        if error_mitigation not in self.SUPPORTED_ERROR_MITIGATION:
            error_mitigation = "medium"
        
        # Validate shots
        if shots is not None:
            shots = max(1, min(100000, int(shots)))
        
        # Validate qubits
        if qubits is not None:
            qubits = max(1, min(30, int(qubits)))
        
        # Load data if file path provided
        if isinstance(validated_data, str):
            validated_data = self._load_data_file(validated_data)
        
        # First generate the circuit
        circuit = self.generate_circuit(
            data=validated_data,
            algorithm=validated_algorithm,
            qubits=qubits
        )
        
        # Sanitize circuit name
        safe_circuit_name = circuit_name
        if safe_circuit_name:
            safe_circuit_name = self._sanitize_string(circuit_name, 100)
        else:
            safe_circuit_name = f"SDK-{validated_algorithm}-{int(time.time())}"
        
        # Build payload
        payload = {
            "qasm": circuit.qasm,
            "shots": shots or circuit.recommended_shots,
            "backend": backend,
            "errorMitigation": error_mitigation,
            "circuitName": safe_circuit_name,
            "algorithm": validated_algorithm,
            "executionType": "auto" if shots is None else "manual",
            "qubits": circuit.qubits,
            "inputData": validated_data,
            "depth": circuit.depth,
            "gateCount": circuit.gate_count,
            "targetLatency": target_latency,
        }
        
        response = self._request("POST", "simulate", payload)
        
        if not response.get("success"):
            raise CircuitError(response.get("error", "Execution failed"))
        
        # The API resolves the effective backend via the policy engine.
        effective_backend = response.get("backend", backend)
        
        return ExecutionResult(
            execution_id=response.get("execution_id"),
            counts=response.get("counts", {}),
            success_rate=response.get("successRate", 0),
            runtime_ms=response.get("runtime", 0),
            memory=response.get("memory", []),
            circuit=circuit,
            backend=effective_backend,
            shots=shots or circuit.recommended_shots,
            algorithm=validated_algorithm,
            backend_reason=response.get("backendReason"),
            backend_hint=response.get("backendHint"),
        )
    
    def generate_circuit(
        self,
        data: Union[List, Dict],
        algorithm: str = "vqe",
        qubits: Optional[int] = None
    ) -> QuantumCircuit:
        """
        Generate a quantum circuit from input data without executing.
        
        Args:
            data: Input data (list or dict)
            algorithm: Algorithm type ('vqe', 'grover', 'qaoa', 'qft', 'bell', 'shor')
            qubits: Number of qubits (auto-calculated if None)
        
        Returns:
            QuantumCircuit object with QASM code and metadata
        """
        validated_algorithm = self._validate_algorithm(algorithm)
        
        if qubits is not None:
            qubits = max(1, min(30, int(qubits)))
        
        payload = {
            "inputData": data,
            "algorithm": validated_algorithm,
            "qubits": qubits,
        }
        
        response = self._request("POST", "generate-circuit", payload)
        
        if not response.get("success"):
            raise CircuitError(response.get("error", "Circuit generation failed"))
        
        return QuantumCircuit(
            qasm=response.get("qasm", ""),
            qubits=response.get("qubits", 2),
            depth=response.get("depth", 1),
            gate_count=response.get("gateCount", 0),
            gates=response.get("gates", []),
            algorithm=validated_algorithm,
            recommended_shots=response.get("recommendedShots", 1024)
        )
    
    def transpile(
        self,
        qasm: str,
        backend: str = "quantum_qpu",
        qubits: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Transpile a circuit for a specific backend topology.
        
        Args:
            qasm: OpenQASM 2.0 code
            backend: Target backend
            qubits: Number of qubits
        
        Returns:
            Dict with transpiled QASM and metadata
        """
        if not qasm or not isinstance(qasm, str):
            raise ValidationError("QASM code is required")
        
        if qubits is not None:
            qubits = max(1, min(30, int(qubits)))
        
        payload = {
            "qasm": qasm,
            "backend": backend,
            "qubits": qubits or self._extract_qubit_count(qasm),
        }
        
        response = self._request("POST", "transpile", payload)
        
        if not response.get("success"):
            raise CircuitError(response.get("error", "Transpilation failed"))
        
        return {
            "transpiled_qasm": response.get("transpiledQASM", ""),
            "swap_count": response.get("swapCount", 0),
            "mapped_qubits": response.get("mappedQubits", []),
            "depth": response.get("depth", 0),
        }
    
    def visualize(self, qasm: str) -> Dict[str, Any]:
        """
        Generate an SVG visualization of a quantum circuit.
        
        Args:
            qasm: OpenQASM 2.0 code
        
        Returns:
            Dict with SVG image data and stats
        """
        if not qasm or not isinstance(qasm, str):
            raise ValidationError("QASM code is required")
        
        payload = {"qasm": qasm}
        
        response = self._request("POST", "visualize", payload)
        
        if not response.get("success"):
            raise CircuitError(response.get("error", "Visualization failed"))
        
        return {
            "image_data": response.get("image_data", ""),
            "format": response.get("format", "svg"),
            "stats": response.get("stats", {}),
            "width": response.get("width", 800),
            "height": response.get("height", 200),
        }
    
    def get_digital_twin(
        self,
        algorithm: str,
        circuit_info: Dict[str, Any],
        execution_results: Dict[str, Any],
        backend_config: Optional[Dict[str, Any]] = None,
        input_data: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Generate AI-powered insights about circuit execution.
        
        Args:
            algorithm: Algorithm type used
            circuit_info: Circuit metadata (qubits, gates, depth)
            execution_results: Results from execution (probabilities, counts)
            backend_config: Backend configuration used
            input_data: Original input data
        
        Returns:
            Dict with digital twin insights and recommendations
        """
        validated_algorithm = self._validate_algorithm(algorithm)
        
        payload = {
            "algorithm": validated_algorithm,
            "inputData": input_data,
            "circuitInfo": circuit_info,
            "executionResults": execution_results,
            "backendConfig": backend_config or {},
        }
        
        response = self._request("POST", "digital-twin", payload)
        
        if not response.get("success"):
            raise APIError(response.get("error", "Digital twin generation failed"))
        
        return response.get("digital_twin", {})
    
    def get_recommendations(
        self,
        qubits: int,
        depth: int,
        gate_count: int,
        algorithm: str,
        data_size: int
    ) -> Dict[str, Any]:
        """
        Get ML-powered recommendations for shots and backend.
        
        Args:
            qubits: Number of qubits
            depth: Circuit depth
            gate_count: Number of gates
            algorithm: Algorithm type
            data_size: Size of input data
        
        Returns:
            Dict with recommended shots, backend, and confidence
        """
        validated_algorithm = self._validate_algorithm(algorithm)
        
        # Validate numeric inputs
        qubits = max(1, min(30, int(qubits)))
        depth = max(1, min(1000, int(depth)))
        gate_count = max(1, min(10000, int(gate_count)))
        data_size = max(1, min(100000, int(data_size)))
        
        payload = {
            "qubits": qubits,
            "depth": depth,
            "gateCount": gate_count,
            "algorithm": validated_algorithm,
            "dataSize": data_size,
        }
        
        response = self._request("POST", "ml-recommend", payload)
        
        if not response.get("success"):
            raise APIError(response.get("error", "ML recommendation failed"))
        
        return {
            "recommended_shots": response.get("recommendedShots", 1024),
            "recommended_backend": response.get("recommendedBackend", "quantum_inspired_gpu"),
            "recommended_error_mitigation": response.get("recommendedErrorMitigation", "medium"),
            "confidence": response.get("confidence", 0.5),
            "reasoning": response.get("reasoning", ""),
            "based_on_executions": response.get("basedOnExecutions", 0)
        }
    
    def _load_data_file(self, file_path: str) -> Union[List, Dict]:
        """Load data from a file path."""
        import os
        
        # Validate file path (basic security check)
        if ".." in file_path or file_path.startswith("/etc") or file_path.startswith("/sys"):
            raise ValidationError("Invalid file path")
        
        if not os.path.exists(file_path):
            raise CircuitError(f"File not found: {file_path}")
        
        # Check file size
        file_size = os.path.getsize(file_path)
        if file_size > self.MAX_PAYLOAD_SIZE:
            raise ValidationError(f"File too large ({file_size} bytes). Maximum is 1MB.")
        
        ext = os.path.splitext(file_path)[1].lower()
        
        with open(file_path, "r") as f:
            if ext == ".json":
                return json.load(f)
            elif ext == ".csv":
                lines = f.readlines()
                if not lines:
                    return []
                # Simple CSV parsing
                data = []
                for line in lines[1:]:  # Skip header
                    values = line.strip().split(",")
                    try:
                        data.append([float(v) for v in values if v])
                    except ValueError:
                        data.append(values)
                return data
            else:
                # Try to parse as JSON
                content = f.read()
                try:
                    return json.loads(content)
                except:
                    # Return as list of lines
                    return content.strip().split("\n")
    
    @staticmethod
    def _extract_qubit_count(qasm: str) -> int:
        """Extract qubit count from QASM code."""
        match = re.search(r'qreg\s+\w+\[(\d+)\]', qasm)
        return int(match.group(1)) if match else 4
    
    def health_check(self) -> Dict[str, Any]:
        """
        Full health check against the API, returns status details.
        
        Returns:
            Dict with keys like 'status', 'version', 'timestamp', etc.
        
        Raises:
            APIError: If the health endpoint is unreachable.
        """
        response = self._request("POST", "health", {"ping": True})
        return response

    def ping(self) -> bool:
        """
        Quick connectivity test. Returns True if the API responds, False otherwise.
        """
        try:
            resp = self.health_check()
            return resp.get("success", False)
        except Exception:
            return False
    
    def simulate(
        self,
        qasm: str,
        shots: int = 1024,
        backend: str = "auto",
        error_mitigation: str = "medium",
        circuit_name: Optional[str] = None,
        algorithm: str = "vqe",
        qubits: Optional[int] = None,
    ) -> ExecutionResult:
        """
        Execute a raw QASM circuit directly (skip generate-circuit step).
        
        Args:
            qasm: OpenQASM 2.0 code to execute
            shots: Number of measurement shots (1-100000)
            backend: Execution backend ('auto', 'quantum_inspired_gpu', 'hpc_gpu', 'quantum_qpu')
            error_mitigation: Error mitigation level ('none', 'low', 'medium', 'high')
            circuit_name: Optional name for the execution
            algorithm: Algorithm label for logging ('vqe', 'grover', 'qaoa', 'qft', 'bell', 'shor')
            qubits: Number of qubits (auto-extracted from QASM if None)
        
        Returns:
            ExecutionResult with counts, fidelity, and metadata.
        
        Example:
            >>> result = user.simulate(
            ...     qasm='OPENQASM 2.0;\\ninclude "qelib1.inc";\\nqreg q[2];\\ncreg c[2];\\nh q[0];\\ncx q[0],q[1];\\nmeasure q -> c;',
            ...     shots=2048,
            ... )
            >>> print(result.counts)
        """
        if not qasm or not isinstance(qasm, str):
            raise ValidationError("QASM code is required")
        
        if backend not in self.SUPPORTED_BACKENDS:
            backend = "auto"
        if error_mitigation not in self.SUPPORTED_ERROR_MITIGATION:
            error_mitigation = "medium"
        
        shots = max(1, min(100000, int(shots)))
        detected_qubits = qubits or self._extract_qubit_count(qasm)
        validated_algorithm = self._validate_algorithm(algorithm)
        safe_name = self._sanitize_string(circuit_name, 100) if circuit_name else f"SDK-simulate-{int(time.time())}"
        
        payload = {
            "qasm": qasm,
            "shots": shots,
            "backend": backend,
            "errorMitigation": error_mitigation,
            "circuitName": safe_name,
            "algorithm": validated_algorithm,
            "executionType": "manual",
            "qubits": detected_qubits,
        }
        
        response = self._request("POST", "simulate", payload)
        
        if not response.get("success"):
            raise CircuitError(response.get("error", "Simulation failed"))
        
        effective_backend = response.get("backend", backend)
        
        return ExecutionResult(
            execution_id=response.get("execution_id"),
            counts=response.get("counts", {}),
            success_rate=response.get("successRate", 0),
            runtime_ms=response.get("runtime", 0),
            memory=response.get("memory", []),
            circuit=None,
            backend=effective_backend,
            shots=shots,
            algorithm=validated_algorithm,
            backend_reason=response.get("backendReason"),
            backend_hint=response.get("backendHint"),
        )
    
    def list_executions(
        self,
        limit: int = 20,
        offset: int = 0,
        status: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        List past executions for this user.
        
        Args:
            limit: Maximum number of executions to return (1-100, default 20)
            offset: Pagination offset (default 0)
            status: Filter by status ('completed', 'failed', 'running')
        
        Returns:
            Dict with 'executions' list, 'total' count, 'limit', 'offset'.
        """
        limit = max(1, min(100, int(limit)))
        offset = max(0, int(offset))
        
        qs = f"limit={limit}&offset={offset}"
        if status and status in ("completed", "failed", "running"):
            qs += f"&status={status}"
        
        url = f"{self.base_url}/api/quantum/executions?{qs}"
        
        headers = {
            "Content-Type": "application/json",
            "X-API-Key": self.api_key,
            "X-Planck-SDK": "python/1.0.0",
            "User-Agent": "PlanckSDK/1.0.0 Python",
        }
        
        from urllib.request import Request, urlopen
        from urllib.error import HTTPError
        
        req = Request(url, headers=headers, method="GET")
        
        try:
            with urlopen(req, timeout=self.timeout) as resp:
                body = resp.read().decode("utf-8")
                return json.loads(body)
        except HTTPError as e:
            error_body = e.read().decode("utf-8")
            try:
                error_data = json.loads(error_body)
                message = error_data.get("error", str(e))
            except Exception:
                message = error_body or str(e)
            
            if e.code == 401:
                raise AuthenticationError(f"Authentication failed: {message}")
            raise APIError(f"API error ({e.code}): {message}")
    
    def __repr__(self) -> str:
        return f"PlanckUser(base_url='{self.base_url}')"
