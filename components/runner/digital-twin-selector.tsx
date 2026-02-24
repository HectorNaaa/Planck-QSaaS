"use client"

import { useState, useEffect, useRef } from "react"
import { Plus, Upload, X, Edit2, Check, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

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

export function DigitalTwinSelector({ selectedTwinId, onSelect }: DigitalTwinSelectorProps) {
  const [twins, setTwins] = useState<DigitalTwin[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const selectedTwin = twins.find((t) => t.id === selectedTwinId) ?? null

  useEffect(() => {
    loadTwins()
  }, [])

  const loadTwins = async () => {
    try {
      setFetchError(null)
      const supabase = createClient()

      // Ensure user is authenticated before querying
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from("digital_twins")
        .select("id, name, description, image_url, created_at")
        .order("created_at", { ascending: false })

      if (error) {
        if (error.code === "42P01") {
          // Table not created yet — silently skip
          return
        }
        throw error
      }
      setTwins(data ?? [])
    } catch (err: any) {
      setFetchError(err?.message ?? "Failed to load digital twins")
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setLoading(true)
    try {
      const supabase = createClient()

      // Verify auth
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) throw new Error("Not authenticated")

      let imageUrl: string | null = null

      if (imageFile) {
        const ext = imageFile.name.split(".").pop() ?? "jpg"
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from("digital-twin-images")
          .upload(path, imageFile, { upsert: true })

        if (upErr) {
          // Non-critical — proceed without image
          console.warn("[DT] Image upload failed:", upErr.message)
        } else {
          const { data: urlData } = supabase.storage
            .from("digital-twin-images")
            .getPublicUrl(path)
          imageUrl = urlData.publicUrl
        }
      }

      const { data, error } = await supabase
        .from("digital_twins")
        .insert({
          name: newName.trim(),
          description: newDesc.trim() || null,
          image_url: imageUrl,
          user_id: user.id,
        })
        .select("id, name, description, image_url, created_at")
        .single()

      if (error) throw error

      setTwins([data, ...twins])
      onSelect(data.id)
      setIsCreating(false)
      setNewName("")
      setNewDesc("")
      setImageFile(null)
      setImagePreview(null)
    } catch (err: any) {
      alert(`Could not create digital twin: ${err?.message ?? "Unknown error"}`)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateName = async (id: string) => {
    if (!editName.trim()) { setEditingId(null); return }
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("digital_twins")
        .update({ name: editName.trim() })
        .eq("id", id)
      if (error) throw error
      setTwins(twins.map((t) => (t.id === id ? { ...t, name: editName.trim() } : t)))
    } catch (err: any) {
      console.error("[DT] update name failed:", err?.message)
    } finally {
      setEditingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this digital twin? Linked executions will be unlinked.")) return
    try {
      const supabase = createClient()
      const { error } = await supabase.from("digital_twins").delete().eq("id", id)
      if (error) throw error
      setTwins(twins.filter((t) => t.id !== id))
      if (selectedTwinId === id) onSelect(null)
    } catch (err: any) {
      console.error("[DT] delete failed:", err?.message)
    }
  }

  const handleSelect = (id: string | null) => {
    onSelect(id)
    setIsExpanded(false)
  }

  return (
    <Card className="p-5 shadow-lg">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Digital Twin</h3>
          <p className="text-xs text-muted-foreground">Optional — organise runs under a named twin</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => { setIsCreating(true); setIsExpanded(true) }}
            size="sm" variant="outline"
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
                  <img src={selectedTwin.image_url} alt={selectedTwin.name} className="w-5 h-5 rounded object-cover" />
                )}
                <span className="font-medium text-foreground">{selectedTwin.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground">None selected</span>
            )}
            <ChevronDown size={14} className={`ml-1 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {fetchError && (
        <p className="mt-2 text-xs text-red-400 bg-red-400/10 px-3 py-1.5 rounded border border-red-400/20">
          {fetchError}
        </p>
      )}

      {/* Expanded panel */}
      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Create form */}
          {isCreating && (
            <div className="p-4 bg-secondary/40 rounded-lg border border-border space-y-3">
              <p className="text-xs font-semibold text-foreground">New digital twin</p>
              <div className="flex gap-3">
                {/* Image picker */}
                <label
                  className="flex-shrink-0 w-16 h-16 rounded-lg border-2 border-dashed border-border hover:border-primary cursor-pointer overflow-hidden bg-secondary flex items-center justify-center"
                  title="Click to upload image"
                >
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  {imagePreview
                    ? <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                    : <Upload size={20} className="text-muted-foreground" />
                  }
                </label>
                {/* Name + desc */}
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    placeholder="Name *"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    className="w-full px-3 py-1.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full px-3 py-1.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleCreate}
                  disabled={loading || !newName.trim()}
                  size="sm" className="flex-1 text-xs h-8"
                >
                  {loading ? "Creating…" : "Create & Select"}
                </Button>
                <Button
                  onClick={() => { setIsCreating(false); setNewName(""); setNewDesc(""); setImageFile(null); setImagePreview(null) }}
                  size="sm" variant="outline" className="text-xs h-8"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Selection list */}
          <div className="flex flex-wrap gap-2">
            {/* "None" option */}
            <button
              onClick={() => handleSelect(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                selectedTwinId === null
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border text-muted-foreground bg-secondary hover:border-primary/40"
              }`}
            >
              None (standalone)
            </button>

            {twins.map((twin) => (
              <div
                key={twin.id}
                className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  selectedTwinId === twin.id
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border text-foreground bg-secondary hover:border-primary/40"
                }`}
              >
                {twin.image_url && (
                  <img src={twin.image_url} alt={twin.name} className="w-5 h-5 rounded object-cover flex-shrink-0" />
                )}

                {editingId === twin.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleUpdateName(twin.id) }}
                      className="w-28 px-2 py-0.5 bg-background border border-border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                    <button onClick={() => handleUpdateName(twin.id)} className="p-0.5 hover:text-primary transition-colors" title="Save">
                      <Check size={12} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-0.5 hover:text-muted-foreground transition-colors" title="Cancel">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => handleSelect(twin.id)} className="flex-1 text-left truncate max-w-[120px]" title={twin.name}>
                    {twin.name}
                  </button>
                )}

                {/* Hover controls */}
                {editingId !== twin.id && (
                  <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingId(twin.id); setEditName(twin.name) }}
                      className="p-0.5 hover:text-primary transition-colors" title="Rename"
                    >
                      <Edit2 size={11} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(twin.id) }}
                      className="p-0.5 hover:text-destructive transition-colors" title="Delete"
                    >
                      <X size={11} />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {twins.length === 0 && !isCreating && (
              <p className="text-xs text-muted-foreground py-1">No digital twins yet. Click "New" to create one.</p>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
