/*
 * Quantum Hardware Benchmarks Database
 * Real-world specifications for commercial quantum processors
 * Includes coherence times, gate fidelities, topologies, and native gate sets
 */

#include <iostream>
#include <map>
#include <vector>
#include <string>
#include <cmath>

using namespace std;

// Hardware specifications structure
struct HardwareSpec {
    string name;
    string vendor;
    int num_qubits;
    string topology_type;
    
    // Coherence times (microseconds)
    double t1_mean;           // Relaxation time
    double t1_std;
    double t2_mean;           // Dephasing time
    double t2_std;
    
    // Gate fidelities (0-1)
    double single_qubit_fidelity;
    double two_qubit_fidelity;
    double readout_fidelity;
    
    // Gate times (nanoseconds)
    double single_qubit_gate_time;
    double two_qubit_gate_time;
    double readout_time;
    
    // Native gate set
    vector<string> native_gates_1q;
    vector<string> native_gates_2q;
    
    // Connectivity
    vector<pair<int,int>> coupling_map;
    
    // Advanced metrics
    double quantum_volume;
    double clops;  // Circuit Layer Operations Per Second
    double eplg;   // Error Per Layered Gate
    
    // Latency constraints (milliseconds)
    double min_execution_latency;  // Minimum realistic execution time
    double typical_latency;         // Typical execution latency
};

class QuantumHardwareDatabase {
private:
    map<string, HardwareSpec> hardware_db;

public:
    QuantumHardwareDatabase() {
        initialize_database();
    }

    void initialize_database() {
        // IBM Quantum System One (Falcon r5.11L)
        HardwareSpec ibm_falcon;
        ibm_falcon.name = "IBM Falcon r5.11L";
        ibm_falcon.vendor = "IBM";
        ibm_falcon.num_qubits = 27;
        ibm_falcon.topology_type = "heavy-hex";
        ibm_falcon.t1_mean = 180.5;
        ibm_falcon.t1_std = 45.2;
        ibm_falcon.t2_mean = 95.3;
        ibm_falcon.t2_std = 28.7;
        ibm_falcon.single_qubit_fidelity = 0.9996;
        ibm_falcon.two_qubit_fidelity = 0.994;
        ibm_falcon.readout_fidelity = 0.988;
        ibm_falcon.single_qubit_gate_time = 35.6;
        ibm_falcon.two_qubit_gate_time = 347.0;
        ibm_falcon.readout_time = 1456.0;
        ibm_falcon.native_gates_1q = {"id", "rz", "sx", "x"};
        ibm_falcon.native_gates_2q = {"cx", "ecr"};
        ibm_falcon.quantum_volume = 128;
        ibm_falcon.clops = 7800;
        ibm_falcon.eplg = 0.0089;
        ibm_falcon.min_execution_latency = 500.0;  // 500ms minimum for QPU
        ibm_falcon.typical_latency = 800.0;        // Typical latency
        
        // Heavy-hex coupling map (simplified)
        for(int i = 0; i < 26; i++) {
            if(i % 3 == 0) {
                ibm_falcon.coupling_map.push_back({i, i+1});
                if(i + 3 < 27) ibm_falcon.coupling_map.push_back({i, i+3});
            }
        }
        
        hardware_db["ibm_falcon"] = ibm_falcon;

        // Rigetti Aspen-M-3
        HardwareSpec rigetti_aspen;
        rigetti_aspen.name = "Rigetti Aspen-M-3";
        rigetti_aspen.vendor = "Rigetti";
        rigetti_aspen.num_qubits = 80;
        rigetti_aspen.topology_type = "square-octagon";
        rigetti_aspen.t1_mean = 24.8;
        rigetti_aspen.t1_std = 8.3;
        rigetti_aspen.t2_mean = 18.6;
        rigetti_aspen.t2_std = 6.1;
        rigetti_aspen.single_qubit_fidelity = 0.9983;
        rigetti_aspen.two_qubit_fidelity = 0.9645;
        rigetti_aspen.readout_fidelity = 0.954;
        rigetti_aspen.single_qubit_gate_time = 40.0;
        rigetti_aspen.two_qubit_gate_time = 200.0;
        rigetti_aspen.readout_time = 2000.0;
        rigetti_aspen.native_gates_1q = {"rx", "rz"};
        rigetti_aspen.native_gates_2q = {"cz", "xy"};
        rigetti_aspen.quantum_volume = 32;
        rigetti_aspen.clops = 4200;
        rigetti_aspen.eplg = 0.0234;
        rigetti_aspen.min_execution_latency = 600.0;
        rigetti_aspen.typical_latency = 1000.0;
        
        // Octagonal lattice coupling
        for(int i = 0; i < 79; i++) {
            rigetti_aspen.coupling_map.push_back({i, i+1});
            if(i % 8 == 0 && i + 8 < 80) {
                rigetti_aspen.coupling_map.push_back({i, i+8});
            }
        }
        
        hardware_db["rigetti_aspen"] = rigetti_aspen;

        // IonQ Aria
        HardwareSpec ionq_aria;
        ionq_aria.name = "IonQ Aria";
        ionq_aria.vendor = "IonQ";
        ionq_aria.num_qubits = 25;
        ionq_aria.topology_type = "all-to-all";
        ionq_aria.t1_mean = 1000000.0;  // ~1 second for ion traps
        ionq_aria.t1_std = 50000.0;
        ionq_aria.t2_mean = 100000.0;
        ionq_aria.t2_std = 10000.0;
        ionq_aria.single_qubit_fidelity = 0.9993;
        ionq_aria.two_qubit_fidelity = 0.9965;
        ionq_aria.readout_fidelity = 0.997;
        ionq_aria.single_qubit_gate_time = 10000.0;
        ionq_aria.two_qubit_gate_time = 400000.0;  // Much slower but higher fidelity
        ionq_aria.readout_time = 200000.0;
        ionq_aria.native_gates_1q = {"gpi", "gpi2", "rz"};
        ionq_aria.native_gates_2q = {"ms", "zz"};
        ionq_aria.quantum_volume = 524288;  // 2^19
        ionq_aria.clops = 150;
        ionq_aria.eplg = 0.0012;
        ionq_aria.min_execution_latency = 1000.0;  // Ion traps are slower
        ionq_aria.typical_latency = 2000.0;
        
        // Full connectivity
        for(int i = 0; i < 25; i++) {
            for(int j = i+1; j < 25; j++) {
                ionq_aria.coupling_map.push_back({i, j});
            }
        }
        
        hardware_db["ionq_aria"] = ionq_aria;

        // Google Sycamore (for reference)
        HardwareSpec google_sycamore;
        google_sycamore.name = "Google Sycamore";
        google_sycamore.vendor = "Google";
        google_sycamore.num_qubits = 53;
        google_sycamore.topology_type = "planar-grid";
        google_sycamore.t1_mean = 18.2;
        google_sycamore.t1_std = 4.7;
        google_sycamore.t2_mean = 15.8;
        google_sycamore.t2_std = 3.9;
        google_sycamore.single_qubit_fidelity = 0.9993;
        google_sycamore.two_qubit_fidelity = 0.9965;
        google_sycamore.readout_fidelity = 0.974;
        google_sycamore.single_qubit_gate_time = 25.0;
        google_sycamore.two_qubit_gate_time = 32.0;
        google_sycamore.readout_time = 500.0;
        google_sycamore.native_gates_1q = {"sqrt_x", "sqrt_y", "rz"};
        google_sycamore.native_gates_2q = {"sqrt_iswap", "fsim"};
        google_sycamore.quantum_volume = 256;
        google_sycamore.clops = 31250;
        google_sycamore.eplg = 0.0041;
        google_sycamore.min_execution_latency = 400.0;
        google_sycamore.typical_latency = 600.0;
        
        // 2D grid coupling
        int grid_size = 7;
        for(int i = 0; i < grid_size; i++) {
            for(int j = 0; j < grid_size; j++) {
                int qubit = i * grid_size + j;
                if(qubit >= 53) break;
                if(j + 1 < grid_size && qubit + 1 < 53) {
                    google_sycamore.coupling_map.push_back({qubit, qubit + 1});
                }
                if(i + 1 < grid_size && qubit + grid_size < 53) {
                    google_sycamore.coupling_map.push_back({qubit, qubit + grid_size});
                }
            }
        }
        
        hardware_db["google_sycamore"] = google_sycamore;
    }

    HardwareSpec get_hardware(const string& name) const {
        auto it = hardware_db.find(name);
        if(it != hardware_db.end()) {
            return it->second;
        }
        throw runtime_error("Hardware not found: " + name);
    }

    double calculate_circuit_error_rate(const string& hardware_name, int num_gates_1q, int num_gates_2q) const {
        HardwareSpec hw = get_hardware(hardware_name);
        
        double error_1q = 1.0 - hw.single_qubit_fidelity;
        double error_2q = 1.0 - hw.two_qubit_fidelity;
        
        // Accumulate errors (simplified model)
        double total_error = 1.0 - pow(1.0 - error_1q, num_gates_1q) * pow(1.0 - error_2q, num_gates_2q);
        
        return total_error;
    }

    double estimate_circuit_time(const string& hardware_name, int num_gates_1q, int num_gates_2q, int depth) const {
        HardwareSpec hw = get_hardware(hardware_name);
        
        // Rough estimate based on critical path
        double avg_gate_time = (hw.single_qubit_gate_time * num_gates_1q + 
                                hw.two_qubit_gate_time * num_gates_2q) / 
                               (num_gates_1q + num_gates_2q + 1e-6);
        
        return depth * avg_gate_time + hw.readout_time;
    }

    void print_hardware_summary(const string& hardware_name) const {
        HardwareSpec hw = get_hardware(hardware_name);
        
        cout << "=== " << hw.name << " (" << hw.vendor << ") ===" << endl;
        cout << "Qubits: " << hw.num_qubits << endl;
        cout << "Topology: " << hw.topology_type << endl;
        cout << "T1 (mean): " << hw.t1_mean << " μs" << endl;
        cout << "T2 (mean): " << hw.t2_mean << " μs" << endl;
        cout << "1Q Fidelity: " << hw.single_qubit_fidelity * 100 << "%" << endl;
        cout << "2Q Fidelity: " << hw.two_qubit_fidelity * 100 << "%" << endl;
        cout << "Readout Fidelity: " << hw.readout_fidelity * 100 << "%" << endl;
        cout << "Quantum Volume: " << hw.quantum_volume << endl;
        cout << "CLOPS: " << hw.clops << endl;
        cout << "EPLG: " << hw.eplg << endl;
        cout << "Native 1Q Gates: ";
        for(const auto& gate : hw.native_gates_1q) cout << gate << " ";
        cout << endl;
        cout << "Native 2Q Gates: ";
        for(const auto& gate : hw.native_gates_2q) cout << gate << " ";
        cout << endl;
        cout << "Connectivity: " << hw.coupling_map.size() << " edges" << endl;
        cout << "Minimum Execution Latency: " << hw.min_execution_latency << " ms" << endl;
        cout << "Typical Latency: " << hw.typical_latency << " ms" << endl;
    }
};

int main(int argc, char* argv[]) {
    QuantumHardwareDatabase db;
    
    if(argc < 2) {
        cout << "Usage: " << argv[0] << " <hardware_name>" << endl;
        cout << "Available hardware: ibm_falcon, rigetti_aspen, ionq_aria, google_sycamore" << endl;
        return 1;
    }
    
    string hardware_name = argv[1];
    
    try {
        db.print_hardware_summary(hardware_name);
        
        // Example: Calculate error for a circuit
        double error = db.calculate_circuit_error_rate(hardware_name, 10, 5);
        cout << "\nExample circuit error (10x1Q + 5x2Q): " << error * 100 << "%" << endl;
        
        double time = db.estimate_circuit_time(hardware_name, 10, 5, 8);
        cout << "Estimated circuit time: " << time << " ns" << endl;
        
    } catch(const exception& e) {
        cerr << "Error: " << e.what() << endl;
        return 1;
    }
    
    return 0;
}
