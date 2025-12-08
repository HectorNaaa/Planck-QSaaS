import { type NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import path from "path"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { qasm } = body

    if (!qasm) {
      return NextResponse.json({ success: false, error: "Missing QASM code" }, { status: 400 })
    }

    // Execute Python visualization script
    const result = await new Promise<any>((resolve, reject) => {
      const pythonProcess = spawn("python3", [path.join(process.cwd(), "scripts", "circuit_visualizer.py"), qasm])

      let stdout = ""
      let stderr = ""

      pythonProcess.stdout.on("data", (data) => {
        stdout += data.toString()
      })

      pythonProcess.stderr.on("data", (data) => {
        stderr += data.toString()
      })

      pythonProcess.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Python process exited with code ${code}: ${stderr}`))
        } else {
          try {
            resolve(JSON.parse(stdout))
          } catch (e) {
            reject(new Error(`Failed to parse Python output: ${stdout}`))
          }
        }
      })
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[v0] Visualization error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to generate circuit visualization",
      },
      { status: 500 },
    )
  }
}
