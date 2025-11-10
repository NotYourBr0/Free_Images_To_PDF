import { useCallback, useMemo, useRef, useState } from 'react'
import './App.css'

const MAX_FILES = 50
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ACCEPTED = ['image/jpeg', 'image/png']
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

function App() {
  const [items, setItems] = useState([]) // { id, file, url }
  const [dragIndex, setDragIndex] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  const remaining = MAX_FILES - items.length

  const onFiles = useCallback((filesList) => {
    setError('')
    const files = Array.from(filesList)
    const filtered = []
    for (const f of files) {
      if (!ACCEPTED.includes(f.type)) {
        setError('Only JPG and PNG images are allowed')
        continue
      }
      if (f.size > MAX_SIZE) {
        setError('Each image must be <= 10 MB')
        continue
      }
      filtered.push(f)
    }

    const limited = filtered.slice(0, Math.max(0, remaining))
    const mapped = limited.map((file, i) => ({ id: `${Date.now()}_${i}_${file.name}` , file, url: URL.createObjectURL(file) }))
    setItems(prev => [...prev, ...mapped])
  }, [remaining])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    const dt = e.dataTransfer
    if (dt?.files?.length) onFiles(dt.files)
  }, [onFiles])

  const onBrowse = useCallback((e) => {
    onFiles(e.target.files)
    e.target.value = ''
  }, [onFiles])

  const onDragStart = (index, e) => {
    setDragIndex(index)
    if (e?.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      try { e.dataTransfer.setData('text/plain', String(index)) } catch {}
    }
  }
  const onDragOver = (e) => {
    e.preventDefault()
    if (e?.dataTransfer) e.dataTransfer.dropEffect = 'move'
  }
  const onDropItem = (e, index) => {
    e.preventDefault()
    // Source index from state or from dataTransfer (fallback)
    const dt = e.dataTransfer
    const fromData = dt ? parseInt(dt.getData('text/plain'), 10) : NaN
    const from = (dragIndex !== null ? dragIndex : (Number.isFinite(fromData) ? fromData : null))
    if (from === null || from === index) return
    setItems(prev => {
      const next = [...prev]
      let to = index
      const [moved] = next.splice(from, 1)
      if (from < to) to -= 1
      next.splice(to, 0, moved)
      return next
    })
    setDragIndex(null)
  }

  const removeAt = (index) => setItems(prev => prev.filter((_, i) => i !== index))

  const clearAll = () => setItems([])

  const canConvert = items.length > 0 && !loading

  const handleConvert = async () => {
    if (!items.length) return
    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      for (const it of items) fd.append('images', it.file, it.file.name)
      const resp = await fetch(`${API_BASE}/api/convert`, { method: 'POST', body: fd })
      if (!resp.ok) throw new Error('Conversion failed')
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'converted.pdf'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e.message || 'Conversion failed')
    } finally {
      setLoading(false)
    }
  }

  const grid = useMemo(() => (
    <div className="grid">
      {items.map((it, i) => (
        <div key={it.id}
             className="card"
             data-index={i}
             draggable
             onDragStart={(e) => onDragStart(i, e)}
             onDragOver={onDragOver}
             onDrop={(e) => onDropItem(e, i)}
             onDragEnd={() => setDragIndex(null)}>
          <img src={it.url} alt={`img-${i}`} />
          <div className="card-actions">
            <button className="delete" onClick={() => removeAt(i)} title="Remove">🗑️</button>
            <span className="handle" title="Drag to reorder">↕️</span>
          </div>
        </div>
      ))}
    </div>
  ), [items])

  return (
    <div className="container">
      <header>
        <h1>Image to PDF Converter</h1>
        <p>Upload up to 50 images (JPG/PNG), reorder, and convert to a single PDF.</p>
      </header>

      {error && <div className="alert">{error}</div>}

      <section className="uploader"
               onDragOver={(e) => e.preventDefault()}
               onDrop={onDrop}
      >
        <div className="dropzone" onClick={() => inputRef.current?.click()}>
          <p><strong>Drag & drop</strong> images here, or click to browse</p>
          <p className="hint">Remaining: {remaining}</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png"
            onChange={onBrowse}
            style={{ display: 'none' }}
          />
        </div>
      </section>

      {items.length > 0 && (
        <section>
          {grid}
          <div className="actions">
            <button onClick={clearAll} disabled={loading}>Clear</button>
            <button className="primary" onClick={handleConvert} disabled={!canConvert}>
              {loading ? 'Converting…' : 'Convert to PDF'}
            </button>
          </div>
        </section>
      )}

      <footer>
        <small>All processing is done server-side; uploads are deleted after conversion.</small>
      </footer>
    </div>
  )
}

export default App
