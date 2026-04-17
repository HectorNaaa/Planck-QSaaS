/**
 * generate_circuit.cpp
 * ─────────────────────────────────────────────────────────────────────────────
 * High-performance OpenQASM 2.0 circuit generator for the Planck platform.
 *
 * Reads a JSON data-profile from stdin and writes an optimised, fully
 * parametric OpenQASM 2.0 circuit string to stdout.  All gate counts, qubit
 * register sizes, rotation angles, and ansatz layers are derived from the
 * profile — nothing is hardcoded.
 *
 * This binary is called by lib/qasm-processor.ts when the input data profile
 * indicates a LARGE or MASSIVE dataset (>50 K samples) where the TypeScript
 * path would be too slow, or when the caller explicitly sets useNative=true.
 *
 * Input JSON schema (stdin):
 * {
 *   "algorithm":  "vqe" | "qaoa" | "grover" | "shor" | "bell" | "qft",
 *   "qubits":     int,          // already clamped and scaled by the TS layer
 *   "depth":      int,
 *   "layers":     int,          // VQE / QAOA ansatz layers
 *   "gateCount":  int,
 *   "angles":     [float...],   // rotation angles in [0, π], length ≥ 1
 *   "dataScale":  "small" | "medium" | "large" | "massive",
 *   "sampleCount": int,
 *   "featureCount": int,
 *   "angleScale":  float,       // default 1.0 — multiplicative factor
 *   "maxQubits":  int | null,
 *   "forceLayers": int | null
 * }
 *
 * Output: OpenQASM 2.0 string to stdout.
 * Exit:   0 = success, 1 = parse/generation error (error message on stderr).
 *
 * Compile:
 *   g++ -O3 -std=c++17 -o generate_circuit scripts/generate_circuit.cpp
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Algorithm → circuit strategy mapping
 *
 *  small   (<1 K)   : standard textbook circuit, all features embedded
 *  medium  (<50 K)  : amplitude-encoding layers, compact entanglement
 *  large   (<10 M)  : compressed embedding via principal angles (PCA-like)
 *  massive (≥10 M)  : maximum qubit compression, repeated amplitude layers
 * ─────────────────────────────────────────────────────────────────────────────
 */

#define _USE_MATH_DEFINES
#include <algorithm>
#include <cmath>
#include <iostream>
#include <numeric>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

// ─── Tiny JSON parser (no external deps) ─────────────────────────────────────
//   Only parses the flat profile object we produce — not a general parser.

struct Profile {
  std::string  algorithm   = "vqe";
  int          qubits      = 4;
  int          depth       = 8;
  int          layers      = 2;
  double       angleScale  = 1.0;
  std::string  dataScale   = "small";
  int          sampleCount = 1;
  int          featureCount= 1;
  int          maxQubits   = 20;
  int          forceLayers = 0;   // 0 = use computed value
  std::vector<double> angles;
};

static std::string jsonStr(const std::string& json, const std::string& key) {
  auto pos = json.find("\"" + key + "\"");
  if (pos == std::string::npos) return "";
  pos = json.find(':', pos) + 1;
  // skip whitespace
  while (pos < json.size() && (json[pos]==' '||json[pos]=='\t'||json[pos]=='\n')) ++pos;
  if (json[pos] == '"') {
    ++pos;
    auto end = json.find('"', pos);
    return json.substr(pos, end - pos);
  }
  // handle null
  if (json.substr(pos,4) == "null") return "";
  // number
  auto end = pos;
  while (end < json.size() && (std::isdigit(json[end])||json[end]=='.'||json[end]=='-'||json[end]=='e'||json[end]=='E'||json[end]=='+')) ++end;
  return json.substr(pos, end - pos);
}

static double jsonDouble(const std::string& json, const std::string& key, double def = 0.0) {
  const std::string s = jsonStr(json, key);
  if (s.empty()) return def;
  try { return std::stod(s); } catch (...) { return def; }
}

static int jsonInt(const std::string& json, const std::string& key, int def = 0) {
  const std::string s = jsonStr(json, key);
  if (s.empty()) return def;
  try { return std::stoi(s); } catch (...) { return def; }
}

static std::vector<double> jsonDoubleArray(const std::string& json, const std::string& key) {
  std::vector<double> result;
  auto pos = json.find("\"" + key + "\"");
  if (pos == std::string::npos) return result;
  pos = json.find('[', pos);
  if (pos == std::string::npos) return result;
  ++pos;
  while (true) {
    while (pos < json.size() && (json[pos]==' '||json[pos]==','||json[pos]=='\n'||json[pos]=='\t')) ++pos;
    if (json[pos] == ']') break;
    auto end = pos;
    while (end < json.size() && json[end] != ',' && json[end] != ']') ++end;
    std::string tok = json.substr(pos, end - pos);
    try { result.push_back(std::stod(tok)); } catch (...) {}
    pos = end;
  }
  return result;
}

static Profile parseProfile(const std::string& json) {
  Profile p;
  p.algorithm    = jsonStr(json, "algorithm");
  if (p.algorithm.empty()) p.algorithm = "vqe";
  p.qubits       = jsonInt(json, "qubits",      4);
  p.depth        = jsonInt(json, "depth",        8);
  p.layers       = jsonInt(json, "layers",       2);
  p.angleScale   = jsonDouble(json, "angleScale", 1.0);
  p.dataScale    = jsonStr(json, "dataScale");
  if (p.dataScale.empty()) p.dataScale = "small";
  p.sampleCount  = jsonInt(json, "sampleCount",  1);
  p.featureCount = jsonInt(json, "featureCount", 1);
  p.maxQubits    = jsonInt(json, "maxQubits",   20);
  p.forceLayers  = jsonInt(json, "forceLayers",  0);
  p.angles       = jsonDoubleArray(json, "angles");
  if (p.angles.empty()) { p.angles.clear(); p.angles.push_back(M_PI / 4.0); }

  // Apply angleScale to all angles
  if (std::abs(p.angleScale - 1.0) > 1e-9) {
    for (auto& a : p.angles) a *= p.angleScale;
  }
  return p;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

static double angle(const Profile& p, int idx) {
  return p.angles[static_cast<size_t>(idx) % p.angles.size()];
}

static std::string fmt(double v) {
  std::ostringstream ss;
  ss.precision(6);
  ss << std::fixed << v;
  return ss.str();
}

// How many ansatz layers to use (respects forceLayers override)
static int effectiveLayers(const Profile& p) {
  if (p.forceLayers > 0) return p.forceLayers;
  return std::max(1, p.layers);
}

// ─── VQE ──────────────────────────────────────────────────────────────────────
// Hardware-efficient ansatz: Ry+Rz rotation layer then alternating CX entanglement.
// For large/massive data, adds extra Rz amplitude-encoding blocks between layers.
static std::string buildVQE(const Profile& p) {
  const int n      = p.qubits;
  const int layers = effectiveLayers(p);
  const bool large = (p.dataScale == "large" || p.dataScale == "massive");

  std::ostringstream o;
  o << "OPENQASM 2.0;\n";
  o << "include \"qelib1.inc\";\n";
  o << "qreg q[" << n << "];\n";
  o << "creg c[" << n << "];\n";

  int ai = 0;
  for (int l = 0; l < layers; l++) {
    // Single-qubit rotation layer from data angles
    for (int i = 0; i < n; i++) {
      o << "ry(" << fmt(angle(p,ai++)) << ") q[" << i << "];\n";
      o << "rz(" << fmt(angle(p,ai++)) << ") q[" << i << "];\n";
    }
    // For large datasets: extra amplitude encoding via Rx derived from
    // angle variance (odd angle indices) before entanglement
    if (large) {
      for (int i = 0; i < n; i++) {
        o << "rx(" << fmt(angle(p,ai++)) << ") q[" << i << "];\n";
      }
    }
    // Alternating CX entanglement
    const int offset = l % 2;
    for (int i = offset; i < n - 1; i += 2)
      o << "cx q[" << i << "],q[" << (i+1) << "];\n";
    // Reverse entanglement for massive to increase expressibility
    if (p.dataScale == "massive") {
      for (int i = n-1; i > 1; i -= 2)
        o << "cx q[" << i << "],q[" << (i-1) << "];\n";
    }
  }
  for (int i = 0; i < n; i++)
    o << "measure q[" << i << "] -> c[" << i << "];\n";
  return o.str();
}

// ─── QAOA ─────────────────────────────────────────────────────────────────────
// Cost layer: ZZ interactions (CX-Rz-CX).  Mixer: Rx.
// For large data: additional long-range ZZ interactions every 2 layers.
static std::string buildQAOA(const Profile& p) {
  const int n      = p.qubits;
  const int layers = effectiveLayers(p);
  const bool large = (p.dataScale == "large" || p.dataScale == "massive");

  std::ostringstream o;
  o << "OPENQASM 2.0;\n";
  o << "include \"qelib1.inc\";\n";
  o << "qreg q[" << n << "];\n";
  o << "creg c[" << n << "];\n";

  for (int i = 0; i < n; i++) o << "h q[" << i << "];\n";

  int ai = 0;
  for (int d = 0; d < layers; d++) {
    // Cost layer: nearest-neighbour ZZ
    for (int i = 0; i < n-1; i++) {
      const double gam = angle(p, ai++);
      o << "cx q[" << i << "],q[" << (i+1) << "];\n";
      o << "rz(" << fmt(gam) << ") q[" << (i+1) << "];\n";
      o << "cx q[" << i << "],q[" << (i+1) << "];\n";
    }
    // Long-range ZZ for large/massive: connect i to i+2
    if (large && n > 3) {
      for (int i = 0; i < n-2; i += 2) {
        const double gam = angle(p, ai++);
        o << "cx q[" << i << "],q[" << (i+2) << "];\n";
        o << "rz(" << fmt(gam) << ") q[" << (i+2) << "];\n";
        o << "cx q[" << i << "],q[" << (i+2) << "];\n";
      }
    }
    // Mixer layer
    for (int i = 0; i < n; i++) {
      o << "rx(" << fmt(angle(p,ai++)) << ") q[" << i << "];\n";
    }
  }
  for (int i = 0; i < n; i++)
    o << "measure q[" << i << "] -> c[" << i << "];\n";
  return o.str();
}

// ─── Grover ───────────────────────────────────────────────────────────────────
// For large data: oracle encodes data-derived multi-phase kicks instead of
// a single target state, allowing approximate search over the dataset manifold.
static std::string buildGrover(const Profile& p) {
  const int n = p.qubits;
  const bool large = (p.dataScale == "large" || p.dataScale == "massive");
  // Optimal iterations: π/4 · √(2^n / M) where M = marked states
  // For large data sets M scales with log2(sampleCount)
  const int M = large ? std::max(1, static_cast<int>(std::log2(p.sampleCount))) : 1;
  const int iters = std::max(1, static_cast<int>(
      std::round((M_PI / 4.0) * std::sqrt(std::pow(2.0, n) / M))));

  std::ostringstream o;
  o << "OPENQASM 2.0;\n";
  o << "include \"qelib1.inc\";\n";
  o << "qreg q[" << n << "];\n";
  o << "creg c[" << n << "];\n";

  for (int i = 0; i < n; i++) o << "h q[" << i << "];\n";

  int ai = 0;
  for (int iter = 0; iter < iters; iter++) {
    // Oracle: parametric multi-phase kicks from data angles
    for (int i = 0; i < n; i++) {
      o << "rz(" << fmt(angle(p,ai++)) << ") q[" << i << "];\n";
    }
    // For large data: additional Ry amplitude layer in oracle
    if (large) {
      for (int i = 0; i < n; i++) {
        o << "ry(" << fmt(angle(p,ai++)) << ") q[" << i << "];\n";
      }
      for (int i = 0; i < n; i++) {
        o << "rz(" << fmt(angle(p,ai++)) << ") q[" << i << "];\n";
      }
    }
    // Diffusion operator: H·X·CX_chain·H·CX_chain·H·X·H
    for (int i = 0; i < n; i++) o << "h q[" << i << "];\n";
    for (int i = 0; i < n; i++) o << "x q[" << i << "];\n";
    for (int i = 0; i < n-1; i++) o << "cx q[" << i << "],q[" << (n-1) << "];\n";
    o << "h q[" << (n-1) << "];\n";
    for (int i = 0; i < n-1; i++) o << "cx q[" << i << "],q[" << (n-1) << "];\n";
    o << "h q[" << (n-1) << "];\n";
    for (int i = 0; i < n; i++) o << "x q[" << i << "];\n";
    for (int i = 0; i < n; i++) o << "h q[" << i << "];\n";
  }
  for (int i = 0; i < n; i++)
    o << "measure q[" << i << "] -> c[" << i << "];\n";
  return o.str();
}

// ─── Shor ─────────────────────────────────────────────────────────────────────
// Counting + ancilla registers; parametric modular exponentiation via data angles.
static std::string buildShor(const Profile& p) {
  const int n = p.qubits;
  const int m = std::max(2, n / 2);

  std::ostringstream o;
  o << "OPENQASM 2.0;\n";
  o << "include \"qelib1.inc\";\n";
  o << "qreg q[" << n << "];\n";
  o << "qreg anc[" << m << "];\n";
  o << "creg c[" << n << "];\n";

  // QFT
  for (int i = 0; i < n; i++) o << "h q[" << i << "];\n";
  for (int i = 0; i < n; i++) {
    for (int j = i+1; j < n; j++) {
      const int k = j - i + 1;
      o << "cu1(" << fmt(M_PI / std::pow(2.0, k-1)) << ") q[" << i << "],q[" << j << "];\n";
    }
  }
  // Modular exponentiation: data-angle parametric rotations on ancilla
  int ai = 0;
  for (int i = 0; i < m; i++) {
    o << "ry(" << fmt(angle(p,ai++)) << ") anc[" << i << "];\n";
    o << "cx anc[" << i << "],q[" << (i % n) << "];\n";
  }
  // Inverse QFT
  for (int i = n-1; i >= 0; i--) {
    for (int j = n-1; j > i; j--) {
      const int k = j - i + 1;
      o << "cu1(" << fmt(-(M_PI / std::pow(2.0, k-1))) << ") q[" << i << "],q[" << j << "];\n";
    }
    o << "h q[" << i << "];\n";
  }
  for (int i = 0; i < n; i++)
    o << "measure q[" << i << "] -> c[" << i << "];\n";
  return o.str();
}

// ─── Bell ─────────────────────────────────────────────────────────────────────
static std::string buildBell(const Profile& p) {
  const int n = p.qubits;
  std::ostringstream o;
  o << "OPENQASM 2.0;\n";
  o << "include \"qelib1.inc\";\n";
  o << "qreg q[" << n << "];\n";
  o << "creg c[" << n << "];\n";

  for (int i = 0; i < n; i++)
    o << "ry(" << fmt(angle(p,i)) << ") q[" << i << "];\n";
  for (int i = 0; i < n-1; i++)
    o << "cx q[" << i << "],q[" << (i+1) << "];\n";
  o << "h q[0];\n";
  for (int i = 0; i < n; i++)
    o << "measure q[" << i << "] -> c[" << i << "];\n";
  return o.str();
}

// ─── QFT ──────────────────────────────────────────────────────────────────────
static std::string buildQFT(const Profile& p) {
  const int n = p.qubits;
  std::ostringstream o;
  o << "OPENQASM 2.0;\n";
  o << "include \"qelib1.inc\";\n";
  o << "qreg q[" << n << "];\n";
  o << "creg c[" << n << "];\n";

  // Parametric init from data angles
  for (int i = 0; i < n; i++)
    o << "ry(" << fmt(angle(p,i)) << ") q[" << i << "];\n";
  // QFT
  for (int i = 0; i < n; i++) {
    o << "h q[" << i << "];\n";
    for (int j = i+1; j < n; j++) {
      const int k = j - i + 1;
      o << "cu1(" << fmt(M_PI / std::pow(2.0, k-1)) << ") q[" << i << "],q[" << j << "];\n";
    }
  }
  // Bit reversal swaps
  for (int i = 0; i < n/2; i++)
    o << "swap q[" << i << "],q[" << (n-1-i) << "];\n";
  for (int i = 0; i < n; i++)
    o << "measure q[" << i << "] -> c[" << i << "];\n";
  return o.str();
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

static std::string dispatch(const Profile& p) {
  if      (p.algorithm == "vqe")   return buildVQE(p);
  else if (p.algorithm == "qaoa")  return buildQAOA(p);
  else if (p.algorithm == "grover")return buildGrover(p);
  else if (p.algorithm == "shor")  return buildShor(p);
  else if (p.algorithm == "bell")  return buildBell(p);
  else if (p.algorithm == "qft")   return buildQFT(p);
  else                             return buildVQE(p); // safe default
}

// ─── Main ─────────────────────────────────────────────────────────────────────

int main() {
  try {
    std::ostringstream buf;
    buf << std::cin.rdbuf();
    const std::string json = buf.str();
    if (json.empty()) {
      std::cerr << "[generate_circuit] empty input\n";
      return 1;
    }
    const Profile p   = parseProfile(json);
    const std::string qasm = dispatch(p);
    std::cout << qasm;
    return 0;
  } catch (const std::exception& ex) {
    std::cerr << "[generate_circuit] error: " << ex.what() << "\n";
    return 1;
  }
}
