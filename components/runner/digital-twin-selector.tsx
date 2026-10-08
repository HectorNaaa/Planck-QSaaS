"use client"

import { useState, useRef, useEffect } from "react"
import { Plus, Upload, X, Edit2, Check, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface DigitalTwin {
  id: string
  name: string
  description: string | null
  image_url: string | null
  created_at: string
}

interface DigitalTwinSelectorProps {
  selectedTwinId: string | null
  onSelect: (twinId: string | null) => void
}

/** Local cosmetic overrides (name/description/image) for twins not yet confirmed
 *  by a server execution. Twin identity/ownership always comes from the server
 *  list below — this cache only affects display labels, never authorization. */
const PENDING_KEY = "planck_pending_digital_twins"

function readPending(): Record<string, { name: string; description: string | null; image_url: string | null }> {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writePending(map: Record<string, { name: string; description: string | null; image_url: string | null }>) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(map))
  } catch { /* storage unavailable — non-fatal, labels just won't persist */ }
}

export function DigitalTwinSelector({ selectedTwinId, onSelect }: DigitalTwinSelectorProps) {
  const [twins, setTwins] = useState<DigitalTwin[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const loadTwins = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/quantum/digital-twin", { credentials: "include" })
      const data = await res.json()
      const serverTwins: DigitalTwin[] = data.success && Array.isArray(data.digital_twins) ? data.digital_twins : []
      const pending = readPending()
      // Merge: server twins win on name/description once an execution confirms them,
      // but pending-only twins (no execution yet) still show up so they stay selectable.
      const merged = new Map<string, DigitalTwin>()
      for (const [id, p] of Object.entries(pending)) {
        merged.set(id, { id, name: p.name, description: p.description, image_url: p.image_url, created_at: new Date().toISOString() })
      }
      for (const t of serverTwins) {
        const existing = merged.get(t.id)
        merged.set(t.id, { ...t, image_url: existing?.image_url ?? t.image_url ?? null })
      }
      setTwins(Array.from(merged.values()))
    } catch {
      setTwins(Object.entries(readPending()).map(([id, p]) => ({ id, name: p.name, description: p.description, image_url: p.image_url, created_at: new Date().toISOString() })))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTwins()
  }, [])

  const selectedTwin = twins.find((t) => t.id === selectedTwinId) ?? null

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleCreate = () => {
    if (!newName.trim()) return
    const id = crypto.randomUUID()
    const pending = readPending()
    pending[id] = { name: newName.trim(), description: newDesc.trim() || null, image_url: imagePreview }
    writePending(pending)
    setTwins((prev) => [{ id, name: newName.trim(), description: newDesc.trim() || null, image_url: imagePreview, created_at: new Date().toISOString() }, ...prev])
    onSelect(id)
    setIsCreating(false)
    setNewName("")
    setNewDesc("")
    setImagePreview(null)
  }

  const handleUpdateName = (id: string) => {
    if (!editName.trim()) {
      setEditingId(null)
      return
    }
    const pending = readPending()
    const existing = twins.find((t) => t.id === id)
    pending[id] = { name: editName.trim(), description: existing?.description ?? null, image_url: existing?.image_url ?? null }
    writePending(pending)
    setTwins(twins.map((t) => (t.id === id ? { ...t, name: editName.trim() } : t)))
    setEditingId(null)
  }

  const handleDelete = (id: string) => {
    if (!confirm("Remove this digital twin from the selector? Past executions linked to it are kept in your history.")) return
    const pending = readPending()
    delete pending[id]
    writePending(pending)
    setTwins(twins.filter((t) => t.id !== id))
    if (selectedTwinId === id) onSelect(null)
  }

  const handleSelect = (id: string | null) => {
    onSelect(id)
    setIsExpanded(false)
  }

  return (
    <Card className="p-5 shadow-lg border border-primary/15">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-base font-semibold text-foreground">Digital Twin</h3>
        <span className="ml-auto text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-medium">Step 1</span>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Optional — organise runs under a named twin</p>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => { setIsCreating(true); setIsExpanded(true) }}
            size="sm"
            variant="outline"
            className="text-xs h-8 px-3"
          >
            <Plus size={14} className="mr-1" /> New
          </Button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {selectedTwin ? (
              <>
                {selectedTwin.image_url && (
                  <img
                    src={selectedTwin.image_url}
                    alt={selectedTwin.name}
                    className="w-5 h-5 rounded object-cover"
                  />
                )}
                <span className="font-medium text-foreground">{selectedTwin.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{loading ? "Loading…" : "None selected"}</span>
            )}
            <ChevronDown size={14} className={`ml-1 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {isCreating && (
            <div className="p-4 bg-secondary/40 rounded-lg border border-border space-y-3">
              <p className="text-xs font-semibold text-foreground">New digital twin</p>
              <div className="flex gap-3">
                <label className="flex-shrink-0 w-16 h-16 rounded-lg border-2 border-dashed border-border hover:border-primary cursor-pointer overflow-hidden bg-secondary flex items-center justify-center">
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  {imagePreview ? (
                    <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <Upload size={20} className="text-muted-foreground" />
                  )}
                </label>
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    placeholder="Name *"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full px-3 py-1.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreate} size="sm" disabled={!newName.trim()} className="flex-1">
                  Create &amp; select
                </Button>
                <Button
                  onClick={() => {
                    setIsCreating(false)
                    setNewName("")
                    setNewDesc("")
                    setImagePreview(null)
                  }}
                  size="sm"
                  variant="ghost"
                >
                  <X size={14} />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The twin becomes permanent in your history as soon as you run a circuit while it's selected.
              </p>
            </div>
          )}

          {!loading && twins.length === 0 && !isCreating && (
            <p className="text-xs text-muted-foreground">No digital twins yet — click "New" to create one.</p>
          )}

          {twins.map((twin) => (
            <div key={twin.id} className="flex items-center justify-between p-3 bg-secondary/40 rounded-lg border border-border">
              {editingId === twin.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleUpdateName(twin.id)}
                    className="flex-1 px-2 py-1 bg-background border border-border rounded-md text-sm text-foreground"
                    autoFocus
                  />
                  <Check
                    size={16}
                    onClick={() => handleUpdateName(twin.id)}
                    className="ml-2 cursor-pointer text-green-500 hover:text-green-600"
                  />
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-1">
                    {twin.image_url && (
                      <img
                        src={twin.image_url}
                        alt={twin.name}
                        className="w-6 h-6 rounded object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{twin.name}</p>
                      {twin.description && <p className="text-xs text-muted-foreground truncate">{twin.description}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0 ml-2">
                    <button
                      onClick={() => { handleSelect(twin.id) }}
                      className={`px-2 py-1 text-xs rounded ${selectedTwinId === twin.id ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"}`}
                    >
                      Select
                    </button>
                    <button
                      onClick={() => { setEditingId(twin.id); setEditName(twin.name) }}
                      className="p-1 hover:bg-secondary/80 rounded text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(twin.id)} className="p-1 hover:bg-red-500/10 rounded text-muted-foreground hover:text-red-500">
                      <X size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

