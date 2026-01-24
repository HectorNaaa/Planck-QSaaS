"""
Planck SDK Client - Main interface for interacting with Planck Platform
"""

import json
import time
from typing import Any, Dict, List, Optional, Union
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from .circuit import QuantumCircuit
from .result import ExecutionResult
from .exceptions import AuthenticationError, APIError, CircuitError


class PlanckClient:
    """
    Main client for interacting with the Planck Quantum Digital Twins Platform.
    
    Args:
        api_key: Your Planck API key (found in Settings > API Keys)
        base_url: API base URL (default: https://planck.plancktechnologies.xyz)
        timeout: Request timeout in seconds (default: 60)
    
    Example:
        >>> client = PlanckClient(api_key="sk_live_xxx")
        >>> result = client.run(data=[1,2,3], algorithm="grover")
        >>> print(result.counts)
    """
    
    DEFAULT_BASE_URL = "https://planck.plancktechnologies.xyz"
    MIN_REQUEST_INTERVAL = 3.0  # Minimum 3 seconds between requests
    MAX_PAYLOAD_SIZE = 1024 * 1024  # 1MB
    
    def __init__(
        self,
        api_key: str,
        base_url: Optional[str] = None,
        timeout: int = 60
    ):
        if not api_key:
            raise AuthenticationError("API key is required")
        
        self.api_key = api_key
        self.base_url = (base_url or self.DEFAULT_BASE_URL).rstrip("/")
        self.timeout = timeout
        self._session_token: Optional[str] = None
        self._last_request_time: float = 0.0
    
    def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make an HTTP request to the Planck API."""
        # Rate limiting: Wait at least 3 seconds between requests
        current_time = time.time()
        time_since_last_request = current_time - self._last_request_time
        
        if time_since_last_request < self.MIN_REQUEST_INTERVAL:
            wait_time = self.MIN_REQUEST_INTERVAL - time_since_last_request
            time.sleep(wait_time)
        
        # Validate payload size
        if data:
            payload_size = len(json.dumps(data).encode("utf-8"))
            if payload_size > self.MAX_PAYLOAD_SIZE:
                raise APIError(
                    f"Payload size ({payload_size} bytes) exceeds maximum allowed size "
                    f"({self.MAX_PAYLOAD_SIZE} bytes). Please reduce your input data size."
                )
        
        url = f"{self.base_url}/api/quantum/{endpoint}"
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "X-Planck-SDK": "python/0.9.0",
        }
        
        body = json.dumps(data).encode("utf-8") if data else None
        
        self._last_request_time = time.time()
        
        req = Request(url, data=body, headers=headers, method=method)
        
        try:
            with urlopen(req, timeout=self.timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as e:
            error_body = e.read().decode("utf-8")
            try:
                error_data = json.loads(error_body)
                message = error_data.get("error", str(e))
            except:
                message = error_body or str(e)
            
            if e.code == 401:
                raise AuthenticationError(f"Authentication failed: {message}")
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
            raise APIError(f"Connection error: {e.reason}")
    
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
            algorithm: Algorithm type ('vqe', 'grover', 'qaoa', 'qft', 'bell')
            shots: Number of measurement shots (auto-calculated if None)
            backend: Execution backend ('auto', 'classical', 'hpc', 'quantum_qpu')
            error_mitigation: Error mitigation level ('none', 'low', 'medium', 'high')
            circuit_name: Optional name for the execution
            target_latency: Target latency in ms (affects backend selection)
            qubits: Number of qubits (auto-calculated if None)
            wait: Wait for completion (default: True)
        
        Returns:
            ExecutionResult object with counts, fidelity, and metadata
        
        Example:
            >>> result = client.run(
            ...     data=[1.0, 2.0, 3.0, 4.0],
            ...     algorithm="vqe",
            ...     shots=2048
            ... )
            >>> print(result.counts)
            {'0000': 512, '0001': 256, ...}
        """
        # Load data if file path provided
        if isinstance(data, str):
            data = self._load_data_file(data)
        
        # First generate the circuit
        circuit = self.generate_circuit(
            data=data,
            algorithm=algorithm,
            qubits=qubits
        )
        
        # Then simulate/execute
        payload = {
            "qasm": circuit.qasm,
            "shots": shots or circuit.recommended_shots,
            "backend": backend,
            "errorMitigation": error_mitigation,
            "circuitName": circuit_name or f"SDK-{algorithm}-{int(time.time())}",
            "algorithm": algorithm,
            "executionType": "auto" if shots is None else "manual",
            "qubits": circuit.qubits,
            "inputData": data,
            "depth": circuit.depth,
            "gateCount": circuit.gate_count,
            "targetLatency": target_latency,
        }
        
        response = self._request("POST", "simulate", payload)
        
        if not response.get("success"):
            raise CircuitError(response.get("error", "Execution failed"))
        
        return ExecutionResult(
            execution_id=response.get("execution_id"),
            counts=response.get("counts", {}),
            success_rate=response.get("successRate", 0),
            runtime_ms=response.get("runtime", 0),
            memory=response.get("memory", []),
            circuit=circuit,
            backend=backend,
            shots=shots or circuit.recommended_shots,
            algorithm=algorithm
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
            algorithm: Algorithm type
            qubits: Number of qubits (auto-calculated if None)
        
        Returns:
            QuantumCircuit object with QASM code and metadata
        """
        payload = {
            "inputData": data,
            "algorithm": algorithm,
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
            algorithm=algorithm,
            recommended_shots=response.get("recommendedShots", 1024)
        )
    
    def get_execution(self, execution_id: str) -> ExecutionResult:
        """
        Retrieve a previous execution by ID.
        
        Args:
            execution_id: The execution ID returned from run()
        
        Returns:
            ExecutionResult object
        """
        response = self._request("GET", f"executions/{execution_id}", None)
        
        return ExecutionResult(
            execution_id=execution_id,
            counts=response.get("counts", {}),
            success_rate=response.get("success_rate", 0),
            runtime_ms=response.get("runtime_ms", 0),
            memory=response.get("memory", []),
            circuit=None,
            backend=response.get("backend", "unknown"),
            shots=response.get("shots", 0),
            algorithm=response.get("algorithm", "unknown")
        )
    
    def list_executions(
        self,
        limit: int = 10,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        List recent executions.
        
        Args:
            limit: Maximum number of results (default: 10)
            offset: Offset for pagination (default: 0)
        
        Returns:
            List of execution summaries
        """
        response = self._request(
            "GET",
            f"executions?limit={limit}&offset={offset}",
            None
        )
        
        return response.get("executions", [])
    
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
        payload = {
            "qubits": qubits,
            "depth": depth,
            "gateCount": gate_count,
            "algorithm": algorithm,
            "dataSize": data_size,
        }
        
        response = self._request("POST", "ml-recommend", payload)
        
        return {
            "recommended_shots": response.get("recommendedShots", 1024),
            "recommended_backend": response.get("recommendedBackend", "classical"),
            "recommended_error_mitigation": response.get("recommendedErrorMitigation", "medium"),
            "confidence": response.get("confidence", 0.5),
            "based_on_executions": response.get("basedOnExecutions", 0)
        }
    
    def _load_data_file(self, file_path: str) -> Union[List, Dict]:
        """Load data from a file path."""
        import os
        
        if not os.path.exists(file_path):
            raise CircuitError(f"File not found: {file_path}")
        
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
    
    def ask(
        self,
        question: str,
        include_history: bool = True
    ) -> str:
        """
        Ask the Planck AI assistant a question about quantum computing or your executions.
        
        Args:
            question: Your question about quantum computing or past executions
            include_history: Include your execution history for context (default: True)
        
        Returns:
            AI assistant's response as string
        
        Example:
            >>> answer = client.ask("What is VQE and when should I use it?")
            >>> print(answer)
            
            >>> answer = client.ask("What was my average runtime in the last 10 executions?")
            >>> print(answer)
        """
        payload = {
            "messages": [
                {"role": "user", "content": question}
            ],
            "includeHistory": include_history
        }
        
        response = self._request("POST", "assistant", payload)
        
        if not response.get("success"):
            raise APIError(response.get("error", "AI assistant request failed"))
        
        return response.get("response", "")
    
    def ping(self) -> bool:
        """Test API connectivity."""
        try:
            self._request("GET", "health", None)
            return True
        except:
            return False
    
    def __repr__(self) -> str:
        return f"PlanckClient(base_url='{self.base_url}')"
