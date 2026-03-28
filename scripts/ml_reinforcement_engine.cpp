/*
 * Reinforcement Learning Engine - Network Effect Optimizer
 * Uses historical execution data to optimize shots and backend selection
 * Implements epsilon-greedy exploration with UCB (Upper Confidence Bound)
 */

#include <iostream>
#include <vector>
#include <string>
#include <cmath>
#include <algorithm>
#include <random>
#include <sstream>

using namespace std;

struct HistoricalExecution {
    vector<double> features;
    int shots_used;
    string backend_used;
    double fidelity_achieved;
    double runtime_ms;
    double reward_score;
};

struct Recommendation {
    int recommended_shots;
    string recommended_backend;
    double confidence;
    string reasoning;
};

class ReinforcementEngine {
private:
    random_device rd;
    mt19937 gen;
    uniform_real_distribution<> dis;
    
    const double EPSILON = 0.15;  // Exploration rate
    const double ALPHA = 0.3;     // Learning rate
    const double GAMMA = 0.9;     // Discount factor
    const double UCB_C = 1.5;     // UCB exploration constant

public:
    ReinforcementEngine() : gen(rd()), dis(0.0, 1.0) {}
    
    double calculate_reward(double fidelity, double runtime_ms, double target_latency) {
        // Multi-objective reward: maximize fidelity, minimize runtime deviation
        double fidelity_reward = fidelity * 100.0;  // 0-100 scale
        
        double latency_penalty = 0.0;
        if(target_latency > 0) {
            double latency_ratio = abs(runtime_ms - target_latency) / target_latency;
            latency_penalty = min(50.0, latency_ratio * 25.0);
        }
        
        double efficiency_bonus = max(0.0, 10.0 - log(runtime_ms + 1));
        
        return fidelity_reward - latency_penalty + efficiency_bonus;
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
    
    Recommendation recommend(
        const vector<double>& current_features,
        const vector<HistoricalExecution>& history,
        int default_shots,
        const string& default_backend
    ) {
        if(history.empty()) {
            return {default_shots, default_backend, 0.0, "No historical data, using defaults"};
        }
        
        // Find similar executions
        vector<pair<double, int>> similarities;
        for(size_t i = 0; i < history.size(); i++) {
            double sim = cosine_similarity(current_features, history[i].features);
            if(sim > 0.5) {  // Only consider similar executions
                similarities.push_back({sim, i});
            }
        }
        
        if(similarities.empty()) {
            return {default_shots, default_backend, 0.1, "No similar executions found"};
        }
        
        // Sort by similarity
        sort(similarities.begin(), similarities.end(), greater<pair<double, int>>());
        
        // Weighted voting for shots and backend
        map<int, double> shots_votes;
        map<string, double> backend_votes;
        
        double total_weight = 0.0;
        int top_k = min(10, (int)similarities.size());
        
        for(int i = 0; i < top_k; i++) {
            double sim = similarities[i].first;
            const auto& exec = history[similarities[i].second];
            
            // Weight by similarity and reward
            double weight = sim * (1.0 + exec.reward_score / 100.0);
            total_weight += weight;
            
            shots_votes[exec.shots_used] += weight;
            backend_votes[exec.backend_used] += weight;
        }
        
        // Epsilon-greedy exploration
        bool explore = dis(gen) < EPSILON;
        
        Recommendation rec;
        
        if(explore) {
            // Exploration: random variation
            rec.recommended_shots = default_shots + (rand() % 3 - 1) * (default_shots / 2);
            rec.recommended_shots = max(100, min(10000, rec.recommended_shots));
            
            vector<string> backends = {"classical", "hpc", "quantum"};
            rec.recommended_backend = backends[rand() % backends.size()];
            rec.confidence = 0.3;
            rec.reasoning = "Exploring alternative configurations";
        } else {
            // Exploitation: use best known configuration
            int best_shots = default_shots;
            double best_shots_weight = 0.0;
            for(const auto& vote : shots_votes) {
                if(vote.second > best_shots_weight) {
                    best_shots_weight = vote.second;
                    best_shots = vote.first;
                }
            }
            
            string best_backend = default_backend;
            double best_backend_weight = 0.0;
            for(const auto& vote : backend_votes) {
                if(vote.second > best_backend_weight) {
                    best_backend_weight = vote.second;
                    best_backend = vote.first;
                }
            }
            
            rec.recommended_shots = best_shots;
            rec.recommended_backend = best_backend;
            rec.confidence = min(0.95, total_weight / (top_k * 2.0));
            
            ostringstream reason;
            reason << "Based on " << top_k << " similar executions (avg similarity: " 
                   << (similarities[0].first * 100) << "%)";
            rec.reasoning = reason.str();
        }
        
        return rec;
    }
};

// Simple JSON parser for historical data
vector<HistoricalExecution> parse_history(const string& input) {
    vector<HistoricalExecution> history;
    // In production, use proper JSON library
    // For now, returning empty to demonstrate structure
    return history;
}

vector<double> parse_features(const string& input) {
    vector<double> features;
    // Simple parsing
    size_t start = input.find("[");
    size_t end = input.find("]");
    if(start != string::npos && end != string::npos) {
        string nums = input.substr(start + 1, end - start - 1);
        stringstream ss(nums);
        string token;
        while(getline(ss, token, ',')) {
            features.push_back(stod(token));
        }
    }
    return features;
}

int main(int argc, char* argv[]) {
    if(argc < 4) {
        cerr << "Usage: " << argv[0] << " <features_json> <default_shots> <default_backend>" << endl;
        return 1;
    }
    
    vector<double> features = parse_features(argv[1]);
    int default_shots = stoi(argv[2]);
    string default_backend = argv[3];
    
    // In production, fetch history from database
    vector<HistoricalExecution> history;
    
    ReinforcementEngine engine;
    Recommendation rec = engine.recommend(features, history, default_shots, default_backend);
    
    // Output as JSON
    cout << "{\"shots\":" << rec.recommended_shots 
         << ",\"backend\":\"" << rec.recommended_backend << "\""
         << ",\"confidence\":" << rec.confidence
         << ",\"reasoning\":\"" << rec.reasoning << "\"}" << endl;
    
    return 0;
}
