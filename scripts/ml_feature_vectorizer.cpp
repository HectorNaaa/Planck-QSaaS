/*
 * ML Feature Vectorizer - High-performance C++ implementation
 * Converts quantum circuit parameters into normalized feature vectors
 * for reinforcement learning and similarity search
 */

#include <iostream>
#include <vector>
#include <string>
#include <cmath>
#include <algorithm>
#include <sstream>
#include <map>

using namespace std;

struct CircuitFeatures {
    int qubits;
    int depth;
    int gates;
    string algorithm;
    int data_size;
    double complexity_score;
    double target_latency;
    string backend_preference;
};

class FeatureVectorizer {
private:
    // Normalization constants (based on typical ranges)
    const double MAX_QUBITS = 100.0;
    const double MAX_DEPTH = 1000.0;
    const double MAX_GATES = 10000.0;
    const double MAX_DATA_SIZE = 1000000.0;
    const double MAX_LATENCY = 10000.0;
    
    map<string, double> algorithm_encoding = {
        {"bell", 0.1},
        {"grover", 0.3},
        {"shor", 0.5},
        {"vqe", 0.7},
        {"qaoa", 0.9}
    };
    
    map<string, double> backend_encoding = {
        {"classical", 0.0},
        {"hpc", 0.5},
        {"quantum", 1.0}
    };

public:
    vector<double> vectorize(const CircuitFeatures& features) {
        vector<double> vec(12, 0.0);
        
        // Feature 0-2: Circuit structure (normalized)
        vec[0] = min(1.0, features.qubits / MAX_QUBITS);
        vec[1] = min(1.0, features.depth / MAX_DEPTH);
        vec[2] = min(1.0, features.gates / MAX_GATES);
        
        // Feature 3: Algorithm type (categorical encoding)
        vec[3] = algorithm_encoding.count(features.algorithm) ? 
                 algorithm_encoding[features.algorithm] : 0.5;
        
        // Feature 4-5: Data characteristics
        vec[4] = min(1.0, features.data_size / MAX_DATA_SIZE);
        vec[5] = min(1.0, features.complexity_score);
        
        // Feature 6: Target latency (normalized, log scale)
        vec[6] = features.target_latency > 0 ? 
                 min(1.0, log(features.target_latency + 1) / log(MAX_LATENCY)) : 0.5;
        
        // Feature 7: Backend preference
        vec[7] = backend_encoding.count(features.backend_preference) ?
                 backend_encoding[features.backend_preference] : 0.5;
        
        // Feature 8-11: Derived features
        vec[8] = vec[2] / (vec[1] + 1e-6);  // Gate density
        vec[9] = vec[0] * vec[1];            // Circuit complexity
        vec[10] = vec[3] * vec[5];           // Algorithm-data match
        vec[11] = vec[6] * vec[7];           // Latency-backend compatibility
        
        return vec;
    }
    
    double cosine_similarity(const vector<double>& v1, const vector<double>& v2) {
        if(v1.size() != v2.size()) return 0.0;
        
        double dot = 0.0, mag1 = 0.0, mag2 = 0.0;
        for(size_t i = 0; i < v1.size(); i++) {
            dot += v1[i] * v2[i];
            mag1 += v1[i] * v1[i];
            mag2 += v2[i] * v2[i];
        }
        
        double denom = sqrt(mag1) * sqrt(mag2);
        return denom > 1e-9 ? dot / denom : 0.0;
    }
};

// Parse command line JSON-like input
CircuitFeatures parse_features(const string& input) {
    CircuitFeatures features;
    features.qubits = 2;
    features.depth = 10;
    features.gates = 20;
    features.algorithm = "bell";
    features.data_size = 100;
    features.complexity_score = 0.5;
    features.target_latency = 1000.0;
    features.backend_preference = "classical";
    
    // Simple parsing (in production, use JSON library)
    size_t pos = 0;
    if((pos = input.find("\"qubits\":")) != string::npos) {
        features.qubits = stoi(input.substr(pos + 9));
    }
    if((pos = input.find("\"depth\":")) != string::npos) {
        features.depth = stoi(input.substr(pos + 8));
    }
    if((pos = input.find("\"gates\":")) != string::npos) {
        features.gates = stoi(input.substr(pos + 8));
    }
    if((pos = input.find("\"data_size\":")) != string::npos) {
        features.data_size = stoi(input.substr(pos + 12));
    }
    if((pos = input.find("\"complexity_score\":")) != string::npos) {
        features.complexity_score = stod(input.substr(pos + 19));
    }
    if((pos = input.find("\"target_latency\":")) != string::npos) {
        features.target_latency = stod(input.substr(pos + 17));
    }
    
    return features;
}

int main(int argc, char* argv[]) {
    if(argc < 2) {
        cerr << "Usage: " << argv[0] << " <features_json>" << endl;
        return 1;
    }
    
    string input = argv[1];
    CircuitFeatures features = parse_features(input);
    
    FeatureVectorizer vectorizer;
    vector<double> vec = vectorizer.vectorize(features);
    
    // Output as JSON array
    cout << "[";
    for(size_t i = 0; i < vec.size(); i++) {
        cout << vec[i];
        if(i < vec.size() - 1) cout << ",";
    }
    cout << "]" << endl;
    
    return 0;
}
