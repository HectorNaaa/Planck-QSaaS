"use client"

import { useState, useEffect } from "react"
import { Plus, Upload, X, Edit2, Check } from "lucide-react"
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
  const [newTwinName, setNewTwinName] = useState("")
  const [newTwinDescription, setNewTwinDescription] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  useEffect(() => {
    loadTwins()
  }, [])

  const loadTwins = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("digital_twins")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error
      setTwins(data || [])
    } catch (error) {
      console.error("Failed to load digital twins:", error)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCreate = async () => {
    if (!newTwinName.trim()) return

    setLoading(true)
    try {
      const supabase = createClient()
      let imageUrl: string | null = null

      // Upload image if provided
      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("digital-twin-images")
          .upload(fileName, imageFile)

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from("digital-twin-images")
          .getPublicUrl(fileName)

        imageUrl = urlData.publicUrl
      }

      const { data, error } = await supabase
        .from("digital_twins")
        .insert({
          name: newTwinName.trim(),
          description: newTwinDescription.trim() || null,
          image_url: imageUrl,
        })
        .select()
        .single()

      if (error) throw error

      setTwins([data, ...twins])
      setIsCreating(false)
      setNewTwinName("")
      setNewTwinDescription("")
      setImageFile(null)
      setImagePreview(null)
    } catch (error) {
      console.error("Failed to create digital twin:", error)
      alert("Failed to create digital twin")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateName = async (id: string) => {
    if (!editName.trim()) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("digital_twins")
        .update({ name: editName.trim() })
        .eq("id", id)

      if (error) throw error

      setTwins(twins.map((t) => (t.id === id ? { ...t, name: editName.trim() } : t)))
      setEditingId(null)
    } catch (error) {
      console.error("Failed to update name:", error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this digital twin? Executions will remain but be unlinked.")) return

    try {
      const supabase = createClient()
      const { error } = await supabase.from("digital_twins").delete().eq("id", id)

      if (error) throw error

      setTwins(twins.filter((t) => t.id !== id))
      if (selectedTwinId === id) {
        onSelect(null)
      }
    } catch (error) {
      console.error("Failed to delete:", error)
    }
  }

  return (
    <Card className="p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Digital Twin</h3>
          <p className="text-xs text-muted-foreground">Optional: Organize your simulations</p>
        </div>
        <Button onClick={() => setIsCreating(!isCreating)} size="sm" variant="outline">
          <Plus size={16} className="mr-1" />
          New Twin
        </Button>
      </div>

      {isCreating && (
        <div className="mb-4 p-4 bg-secondary/30 rounded-lg border border-border space-y-3">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <label className="block w-20 h-20 bg-secondary rounded-lg border-2 border-dashed border-border hover:border-primary cursor-pointer overflow-hidden">
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Upload size={24} className="text-muted-foreground" />
                  </div>
                )}
              </label>
            </div>
            <div className="flex-1 space-y-2">
              <input
                type="text"
                placeholder="Name (e.g., Quantum ML Model)"
                value={newTwinName}
                onChange={(e) => setNewTwinName(e.target.value)}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground"
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={newTwinDescription}
                onChange={(e) => setNewTwinDescription(e.target.value)}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={loading || !newTwinName.trim()} size="sm" className="flex-1">
              {loading ? "Creating..." : "Create"}
            </Button>
            <Button onClick={() => setIsCreating(false)} size="sm" variant="outline">
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onSelect(null)}
          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            selectedTwinId === null
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-secondary text-muted-foreground border-border hover:border-primary/50"
          }`}
        >
          No Twin (Standalone)
        </button>
        {twins.map((twin) => (
          <div
            key={twin.id}
            className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              selectedTwinId === twin.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary text-foreground border-border hover:border-primary/50"
            }`}
          >
            {twin.image_url && (
              <img src={twin.image_url} alt={twin.name} className="w-6 h-6 rounded object-cover" />
            )}
            {editingId === twin.id ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-32 px-2 py-1 bg-background border border-border rounded text-xs"
                  autoFocus
                />
                <button
                  onClick={() => handleUpdateName(twin.id)}
                  className="p-1 hover:bg-background/50 rounded"
                >
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <button onClick={() => onSelect(twin.id)} className="flex-1 text-left">
                {twin.name}
              </button>
            )}
            <div className="hidden group-hover:flex items-center gap-1">
              {editingId !== twin.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingId(twin.id)
                    setEditName(twin.name)
                  }}
                  className="p-1 hover:bg-background/50 rounded"
                >
                  <Edit2 size={12} />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(twin.id)
                }}
                className="p-1 hover:bg-background/50 rounded text-red-400"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
