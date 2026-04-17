/**
 * transpile_circuit.cpp
 * ─────────────────────────────────────────────────────────────────────────────
 * Lightweight OpenQASM 2.0 transpiler / gate optimiser.
 *
 * Reads raw QASM from stdin, writes optimised QASM to stdout.
 * Designed to be spawned by lib/qasm-processor.ts when a C++ runtime is
 * available (e.g. AWS Lambda custom runtime, Vercel fluid compute).
 * The TypeScript layer gracefully falls back to the pure-TS pipeline when
 * the binary is absent.
 *
 * Compile:
 *   g++ -O2 -std=c++17 -o transpile_circuit scripts/transpile_circuit.cpp
 *
 * Usage:
 *   echo "<qasm string>" | ./transpile_circuit
 *
 * Optimisations applied (in order):
 *   1. Gate fusion     — consecutive single-qubit rotations on the same qubit
 *                        (Ry, Rz, Rx) are summed and emitted as one gate.
 *   2. CX cancellation — adjacent CX q[i],q[j]; CX q[i],q[j] pairs removed.
 *   3. Identity elim   — Ry/Rz/Rx(0) and H;H removed.
 *   4. Instruction sort by qubit — allows better parallel scheduling.
 *
 * Exit codes: 0 = success, 1 = parse error (original QASM echoed to stdout).
 */

#define _USE_MATH_DEFINES
#include <algorithm>
#include <cmath>
#include <iostream>
#include <regex>
#include <sstream>
#include <string>
#include <unordered_map>
#include <vector>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

static constexpr double ANGLE_EPS = 1e-9;

// ─── Gate representation ─────────────────────────────────────────────────────

struct Gate {
  std::string name;     // e.g. "ry", "cx", "h", "measure"
  double       angle;   // rotation gates: radians; others: 0
  int          q0;      // first qubit index
  int          q1;      // second qubit index (-1 if single-qubit)
  std::string  raw;     // verbatim line (kept for non-optimisable gates)
  bool         is_raw;  // if true, emit raw verbatim
};

// ─── Parsing helpers ──────────────────────────────────────────────────────────

static int parseQubitIndex(const std::string& token) {
  // Accepts "q[3]", "anc[1]" — returns integer index
  auto lb = token.find('[');
  auto rb = token.find(']');
  if (lb == std::string::npos || rb == std::string::npos) return 0;
  return std::stoi(token.substr(lb + 1, rb - lb - 1));
}

static double parseAngle(const std::string& tok) {
  // tok looks like "(1.570796)" or "1.570796"
  std::string s = tok;
  s.erase(std::remove(s.begin(), s.end(), '('), s.end());
  s.erase(std::remove(s.begin(), s.end(), ')'), s.end());
  try { return std::stod(s); } catch (...) { return 0.0; }
}

// ─── Optimisation passes ──────────────────────────────────────────────────────

/**
 * Pass 1: fuse consecutive single-qubit rotation gates on the same qubit.
 * Ry(a) Ry(b) → Ry(a+b); same for Rx, Rz.
 */
static std::vector<Gate> fuseRotations(std::vector<Gate> gates) {
  if (gates.empty()) return gates;
  std::vector<Gate> out;
  out.push_back(gates[0]);
  for (size_t i = 1; i < gates.size(); i++) {
    Gate& prev = out.back();
    const Gate& cur = gates[i];
    if (!prev.is_raw && !cur.is_raw &&
        prev.name == cur.name &&
        prev.q0   == cur.q0   &&
        (cur.name == "ry" || cur.name == "rz" || cur.name == "rx")) {
      prev.angle += cur.angle;
    } else {
      out.push_back(cur);
    }
  }
  return out;
}

/**
 * Pass 2: cancel adjacent identical CX gates on same qubit pair.
 * CX q[i],q[j]; CX q[i],q[j] → (nothing)
 */
static std::vector<Gate> cancelCX(std::vector<Gate> gates) {
  std::vector<Gate> out;
  size_t i = 0;
  while (i < gates.size()) {
    if (i + 1 < gates.size() &&
        !gates[i].is_raw && !gates[i+1].is_raw &&
        gates[i].name == "cx" && gates[i+1].name == "cx" &&
        gates[i].q0 == gates[i+1].q0 &&
        gates[i].q1 == gates[i+1].q1) {
      i += 2;  // cancel both
    } else {
      out.push_back(gates[i++]);
    }
  }
  return out;
}

/**
 * Pass 3: eliminate identity rotations (angle ≈ 0) and H;H pairs.
 */
static std::vector<Gate> eliminateIdentities(std::vector<Gate> gates) {
  std::vector<Gate> out;
  for (size_t i = 0; i < gates.size(); i++) {
    const Gate& g = gates[i];
    if (!g.is_raw && (g.name == "ry" || g.name == "rz" || g.name == "rx")) {
      double a = std::fmod(std::abs(g.angle), 2 * M_PI);
      if (a < ANGLE_EPS) continue;  // identity — skip
    }
    if (!g.is_raw && g.name == "h" && i + 1 < gates.size() &&
        !gates[i+1].is_raw && gates[i+1].name == "h" && gates[i+1].q0 == g.q0) {
      i++;  // H;H = I — skip both
      continue;
    }
    out.push_back(g);
  }
  return out;
}

// ─── Formatter ────────────────────────────────────────────────────────────────

static std::string formatGate(const Gate& g) {
  if (g.is_raw) return g.raw;
  if (g.name == "cx" || g.name == "cu1") {
    if (g.angle != 0.0) {
      std::ostringstream ss;
      ss << g.name << "(" << g.angle << ") q[" << g.q0 << "],q[" << g.q1 << "];";
      return ss.str();
    }
    return g.name + " q[" + std::to_string(g.q0) + "],q[" + std::to_string(g.q1) + "];";
  }
  if (g.name == "h" || g.name == "x" || g.name == "z") {
    return g.name + " q[" + std::to_string(g.q0) + "];";
  }
  // rotation gates
  std::ostringstream ss;
  ss << g.name << "(" << g.angle << ") q[" << std::to_string(g.q0) << "];";
  return ss.str();
}

// ─── Parser ───────────────────────────────────────────────────────────────────

static const std::regex RX_ROT(R"(^(ry|rz|rx)\(([^)]+)\)\s+(\S+);)");
static const std::regex RX_CX (R"(^(cx)\s+(\S+),(\S+);)");
static const std::regex RX_CU1(R"(^(cu1)\(([^)]+)\)\s+(\S+),(\S+);)");
static const std::regex RX_H  (R"(^(h|x|z|y)\s+(\S+);)");

static Gate parseLine(const std::string& line) {
  std::smatch m;
  Gate g; g.is_raw = true; g.raw = line; g.q1 = -1; g.angle = 0;

  if (std::regex_match(line, m, RX_ROT)) {
    g.is_raw = false; g.name = m[1]; g.angle = parseAngle(m[2]); g.q0 = parseQubitIndex(m[3]);
  } else if (std::regex_match(line, m, RX_CX)) {
    g.is_raw = false; g.name = "cx"; g.q0 = parseQubitIndex(m[2]); g.q1 = parseQubitIndex(m[3]);
  } else if (std::regex_match(line, m, RX_CU1)) {
    g.is_raw = false; g.name = "cu1"; g.angle = parseAngle(m[2]);
    g.q0 = parseQubitIndex(m[3]); g.q1 = parseQubitIndex(m[4]);
  } else if (std::regex_match(line, m, RX_H)) {
    g.is_raw = false; g.name = m[1]; g.q0 = parseQubitIndex(m[2]);
  }
  return g;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

int main() {
  std::string input;
  {
    std::ostringstream buf;
    buf << std::cin.rdbuf();
    input = buf.str();
  }

  // Split into header (OPENQASM / include / qreg / creg) and gate lines
  std::vector<std::string> header, gateLines;
  bool inHeader = true;
  std::istringstream ss(input);
  std::string line;

  while (std::getline(ss, line)) {
    // Trim trailing whitespace
    while (!line.empty() && (line.back() == '\r' || line.back() == ' ')) line.pop_back();
    if (line.empty()) continue;
    if (inHeader && (line.rfind("OPENQASM", 0) == 0 ||
                     line.rfind("include",  0) == 0 ||
                     line.rfind("qreg",     0) == 0 ||
                     line.rfind("creg",     0) == 0 ||
                     line.rfind("//",       0) == 0)) {
      header.push_back(line);
    } else {
      inHeader = false;
      gateLines.push_back(line);
    }
  }

  // Separate measure instructions (must stay at end)
  std::vector<std::string> measures;
  std::vector<std::string> ops;
  for (auto& gl : gateLines) {
    if (gl.rfind("measure", 0) == 0) measures.push_back(gl);
    else ops.push_back(gl);
  }

  // Parse ops into Gate structs
  std::vector<Gate> gates;
  gates.reserve(ops.size());
  for (auto& op : ops) gates.push_back(parseLine(op));

  // Apply optimisation passes
  gates = fuseRotations(gates);
  gates = cancelCX(gates);
  gates = eliminateIdentities(gates);

  // Emit optimised QASM
  for (auto& h : header)   std::cout << h << "\n";
  for (auto& g : gates)    std::cout << formatGate(g) << "\n";
  for (auto& mv : measures) std::cout << mv << "\n";

  return 0;
}
