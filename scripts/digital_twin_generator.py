#!/usr/bin/env python3
"""
Digital Twin Generator for Quantum Circuit Interpretability
Generates interpretable models from quantum execution results
"""

import json
import sys
import numpy as np
from typing import Dict, List, Any
import base64


def analyze_probability_distribution(counts: Dict[str, int], shots: int) -> Dict[str, Any]:
    """Analyze probability distribution from measurement outcomes"""
    probabilities = {state: count / shots for state, count in counts.items()}
    
    # Calculate entropy
    entropy = -sum(p * np.log2(p) if p > 0 else 0 for p in probabilities.values())
    
    # Find dominant states
    sorted_probs = sorted(probabilities.items(), key=lambda x: x[1], reverse=True)
    dominant_states = sorted_probs[:5]
    
    # Calculate statistical metrics
    prob_values = list(probabilities.values())
    mean_prob = np.mean(prob_values)
    std_prob = np.std(prob_values)
    
    return {
        "entropy": float(entropy),
        "dominant_states": dominant_states,
        "mean_probability": float(mean_prob),
        "std_probability": float(std_prob),
        "unique_states": len(counts),
        "probability_distribution": probabilities
    }


def generate_circuit_insights(algorithm: str, input_data: Dict, results: Dict) -> Dict[str, Any]:
    """Generate interpretable insights based on algorithm and results"""
    
    insights = {
        "algorithm": algorithm,
        "interpretation": "",
        "key_findings": [],
        "data_patterns": [],
        "recommendations": []
    }
    
    if algorithm == "Bell":
        insights["interpretation"] = "Bell state analysis reveals quantum entanglement patterns"
        insights["key_findings"].append(
            f"Entanglement fidelity: {results['analysis']['entropy']:.2f} bits"
        )
        if results['analysis']['dominant_states']:
            state = results['analysis']['dominant_states'][0][0]
            prob = results['analysis']['dominant_states'][0][1]
            insights["key_findings"].append(
                f"Primary entangled state |{state}⟩ with probability {prob:.1%}"
            )
        
    elif algorithm == "Grover":
        insights["interpretation"] = "Grover search optimization identifies target states in unstructured data"
        search_space_size = 2 ** input_data.get('qubits', 4)
        insights["key_findings"].append(
            f"Search space: {search_space_size} states"
        )
        if results['analysis']['dominant_states']:
            target = results['analysis']['dominant_states'][0][0]
            prob = results['analysis']['dominant_states'][0][1]
            insights["key_findings"].append(
                f"Found target state |{target}⟩ with {prob:.1%} probability"
            )
            insights["key_findings"].append(
                f"Quantum speedup: O(√N) vs classical O(N)"
            )
        
    elif algorithm == "Shor":
        insights["interpretation"] = "Shor's algorithm factorizes numbers using quantum period finding"
        if 'number' in input_data:
            insights["key_findings"].append(
                f"Target number for factorization: {input_data['number']}"
            )
        insights["key_findings"].append(
            "Quantum Fourier Transform enables exponential speedup"
        )
        insights["recommendations"].append(
            "Increase qubits for larger number factorization"
        )
        
    elif algorithm == "VQE":
        insights["interpretation"] = "Variational Quantum Eigensolver finds ground state energy"
        insights["key_findings"].append(
            f"Energy landscape explored with {results['analysis']['unique_states']} configurations"
        )
        insights["key_findings"].append(
            f"Solution variance: {results['analysis']['std_probability']:.4f}"
        )
        insights["recommendations"].append(
            "Consider adaptive error mitigation for improved convergence"
        )
        
    elif algorithm == "QAOA":
        insights["interpretation"] = "Quantum Approximate Optimization finds near-optimal solutions"
        insights["key_findings"].append(
            f"Optimization landscape entropy: {results['analysis']['entropy']:.2f} bits"
        )
        if results['analysis']['dominant_states']:
            best_solution = results['analysis']['dominant_states'][0][0]
            quality = results['analysis']['dominant_states'][0][1]
            insights["key_findings"].append(
                f"Best solution: |{best_solution}⟩ with quality {quality:.1%}"
            )
        insights["recommendations"].append(
            "Tune QAOA parameters (p-layers) for better approximation"
        )
    
    # Analyze data patterns from input
    if 'data' in input_data:
        data = input_data['data']
        if isinstance(data, list):
            insights["data_patterns"].append(
                f"Input data dimensionality: {len(data)} features"
            )
            if all(isinstance(x, (int, float)) for x in data):
                insights["data_patterns"].append(
                    f"Data range: [{min(data):.2f}, {max(data):.2f}]"
                )
    
    return insights


def create_digital_twin(
    algorithm: str,
    input_data: Dict,
    circuit_info: Dict,
    execution_results: Dict,
    backend_config: Dict
) -> Dict[str, Any]:
    """
    Create a Digital Twin representation of the quantum execution
    for interpretability, simulation, and analysis
    """
    
    # Analyze probability distribution
    analysis = analyze_probability_distribution(
        execution_results['counts'],
        execution_results['shots']
    )
    
    # Generate insights
    insights = generate_circuit_insights(
        algorithm,
        input_data,
        {"analysis": analysis, "results": execution_results}
    )
    
    # Create digital twin structure
    digital_twin = {
        "version": "1.0",
        "created_at": execution_results.get('timestamp'),
        "algorithm": {
            "name": algorithm,
            "type": "quantum",
            "qubits": circuit_info.get('qubits', 4),
            "depth": circuit_info.get('depth', 0),
            "gates": circuit_info.get('gates', [])
        },
        "input_state": {
            "data": input_data,
            "encoding": "amplitude" if algorithm in ["VQE", "QAOA"] else "basis",
            "preprocessing": "normalized"
        },
        "quantum_execution": {
            "backend": backend_config.get('backend'),
            "shots": execution_results['shots'],
            "error_mitigation": backend_config.get('error_mitigation'),
            "transpiled": backend_config.get('transpiled', False),
            "fidelity": execution_results.get('success_rate', 0)
        },
        "output_state": {
            "measurement_basis": "computational",
            "probability_distribution": analysis['probability_distribution'],
            "dominant_states": analysis['dominant_states'],
            "entropy": analysis['entropy']
        },
        "statistical_analysis": {
            "mean_probability": analysis['mean_probability'],
            "std_probability": analysis['std_probability'],
            "unique_outcomes": analysis['unique_states'],
            "convergence": "high" if analysis['entropy'] < 2.0 else "medium" if analysis['entropy'] < 3.5 else "low"
        },
        "insights": insights,
        "interpretability": {
            "state_visualization": "probability_histogram",
            "feature_importance": extract_feature_importance(
                algorithm,
                input_data,
                analysis['dominant_states']
            ),
            "decision_boundaries": identify_decision_patterns(
                analysis['probability_distribution'],
                circuit_info.get('qubits', 4)
            )
        },
        "simulation_parameters": {
            "can_replay": True,
            "noise_model": backend_config.get('noise_model', 'ideal'),
            "circuit_fidelity": execution_results.get('success_rate', 0),
            "estimated_runtime_ms": execution_results.get('runtime_ms', 0)
        },
        "metadata": {
            "execution_id": execution_results.get('execution_id'),
            "user_id": execution_results.get('user_id'),
            "runtime_ms": execution_results.get('runtime_ms'),
            "backend_used": backend_config.get('backend')
        }
    }
    
    return digital_twin


def extract_feature_importance(algorithm: str, input_data: Dict, dominant_states: List) -> Dict[str, float]:
    """Extract which input features most influenced the quantum results"""
    feature_importance = {}
    
    if 'data' in input_data and isinstance(input_data['data'], list):
        data = input_data['data']
        num_features = len(data)
        
        # Heuristic: features with larger values typically influence more qubits
        normalized = np.array(data) / (max(abs(x) for x in data) if data else 1)
        
        for i, val in enumerate(normalized):
            feature_importance[f"feature_{i}"] = float(abs(val))
    
    return feature_importance


def identify_decision_patterns(prob_dist: Dict[str, float], num_qubits: int) -> List[Dict]:
    """Identify patterns in the decision space from probability distribution"""
    patterns = []
    
    # Group by Hamming weight (number of 1s in bitstring)
    hamming_groups = {}
    for state, prob in prob_dist.items():
        hamming_weight = state.count('1')
        if hamming_weight not in hamming_groups:
            hamming_groups[hamming_weight] = []
        hamming_groups[hamming_weight].append((state, prob))
    
    # Identify patterns
    for weight, states in hamming_groups.items():
        total_prob = sum(p for _, p in states)
        if total_prob > 0.1:  # Significant pattern
            patterns.append({
                "type": "hamming_weight",
                "weight": weight,
                "probability": float(total_prob),
                "interpretation": f"{weight}/{num_qubits} qubits in |1⟩ state"
            })
    
    return patterns


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Missing input JSON"}))
        sys.exit(1)
    
    try:
        # Parse input
        input_json = json.loads(sys.argv[1])
        
        algorithm = input_json.get('algorithm', 'Unknown')
        input_data = input_json.get('input_data', {})
        circuit_info = input_json.get('circuit_info', {})
        execution_results = input_json.get('execution_results', {})
        backend_config = input_json.get('backend_config', {})
        
        # Generate Digital Twin
        digital_twin = create_digital_twin(
            algorithm,
            input_data,
            circuit_info,
            execution_results,
            backend_config
        )
        
        # Output result
        print(json.dumps({
            "success": True,
            "digital_twin": digital_twin
        }, indent=2))
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
