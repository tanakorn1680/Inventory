'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Worker } from '@/lib/types'
import { formatRelativeTime } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/Confirm'

interface FileRecord {
  id: string
  name: string
  path: string
  mime_type: string
  size: number
  created_at: string
  updated_at: string
  current_version: number
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function fileIcon(mime: string): string {
  if (mime.startsWith('image/')) return '🖼️'
  if (mime.includes('pdf')) return '📄'
  if (mime.includes('json') || mime.includes('javascript') || mime.includes('typescript')) return '📦'
  if (mime.includes('text/') || mime.includes('markdown')) return '📝'
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('gzip')) return '🗜️'
  if (mime.includes('video/')) return '🎬'
  if (mime.includes('audio/')) return '🎵'
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return '📊'
  return '📎'
}

export default function FilesPage() {
  const { id: workspaceId } = useParams<{ id: string }>()
  const [files, setFiles] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [userId, setUserId] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [viewFile, setViewFile] = useState<{ url: string; name: string; mime: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { success: toastSuccess, error: toastError } = useToast()
  const confirm = useConfirm()

  const loadFiles = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUserId(user.id)

    const { data } = await supabase
      .from('files')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('parent_folder_id', null)
      .order('created_at', { ascending: false })

    if (data) setFiles(data)
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { loadFiles() }, [loadFiles])

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setUploading(true)
    setUploadProgress(0)
    const supabase = createClient()

    const total = fileList.length
    let done = 0

    for (const file of Array.from(fileList)) {
      const storagePath = `${userId}/${workspaceId}/${Date.now()}_${file.name}`

      const { error: storageErr } = await supabase.storage
        .from('workspace-files')
        .upload(storagePath, file, { upsert: false })

      if (storageErr) {
        console.error('Upload error:', storageErr)
        done++
        setUploadProgress(Math.round((done / total) * 100))
        continue
      }

      const { data: fileRecord } = await supabase
        .from('files')
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          name: file.name,
          path: storagePath,
          mime_type: file.type || 'application/octet-stream',
          size: file.size,
          current_version: 1,
        })
        .select()
        .single()

      if (fileRecord) { setFiles(prev => [fileRecord, ...prev]); toastSuccess(`Uploaded ${file.name}`) }
      done++
      setUploadProgress(Math.round((done / total) * 100))
    }

    setUploading(false)
    setUploadProgress(0)
  }

  async function handleDownload(file: FileRecord) {
    const supabase = createClient()
    const { data } = await supabase.storage
      .from('workspace-files')
      .createSignedUrl(file.path, 60)

    if (data?.signedUrl) {
      const a = document.createElement('a')
      a.href = data.signedUrl
      a.download = file.name
      a.click()
    }
  }

  async function handleView(file: FileRecord) {
    const supabase = createClient()
    const { data } = await supabase.storage
      .from('workspace-files')
      .createSignedUrl(file.path, 300)

    if (data?.signedUrl) {
      setViewFile({ url: data.signedUrl, name: file.name, mime: file.mime_type })
    }
  }

  async function handleDelete(file: FileRecord) {
    const ok = await confirm({ title: 'Delete File', message: `Delete "${file.name}"?`, confirmLabel: 'Delete', danger: true })
    if (!ok) return
    const supabase = createClient()
    await supabase.storage.from('workspace-files').remove([file.path])
    await supabase.from('files').delete().eq('id', file.id)
    setFiles(prev => prev.filter(f => f.id !== file.id))
    toastSuccess(`"${file.name}" deleted`)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    uploadFiles(e.dataTransfer.files)
  }

  const isViewable = (mime: string) =>
    mime.startsWith('image/') || mime === 'application/pdf' || mime.startsWith('text/')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0,
        background: 'var(--bg-surface)',
      }}>
        <span style={{ fontWeight: 600, color: '#fff', flex: 1 }}>
          Files
          <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.875rem', marginLeft: 8 }}>
            {files.length} file{files.length !== 1 ? 's' : ''}
          </span>
        </span>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={e => uploadFiles(e.target.files)}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          {uploading ? `Uploading… ${uploadProgress}%` : 'Upload'}
        </button>
      </div>

      {/* Drop zone + file list */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: 20, position: 'relative' }}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {dragOver && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: 'rgba(99,102,241,0.1)',
            border: '2px dashed var(--accent-primary)',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 8,
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            <span style={{ color: 'var(--accent-hover)', fontWeight: 600 }}>Drop files to upload</span>
          </div>
        )}

        {loading ? (
          <FileSkeleton />
        ) : files.length === 0 ? (
          <EmptyFiles onUpload={() => fileInputRef.current?.click()} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {files.map(file => (
              <FileRow
                key={file.id}
                file={file}
                onDownload={() => handleDownload(file)}
                onView={isViewable(file.mime_type) ? () => handleView(file) : undefined}
                onDelete={() => handleDelete(file)}
              />
            ))}
          </div>
        )}

        {/* Drop hint when no files */}
        {!loading && files.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 8, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            or drag & drop files here
          </div>
        )}
      </div>

      {/* File viewer modal */}
      {viewFile && (
        <div className="dialog-overlay" onClick={() => setViewFile(null)}>
          <div
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 16, padding: 0, width: '90vw', maxWidth: 900, maxHeight: '85dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 600, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{viewFile.name}</span>
              <button className="btn btn-ghost btn-icon" onClick={() => setViewFile(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
              {viewFile.mime.startsWith('image/') && (
                <img src={viewFile.url} alt={viewFile.name} style={{ maxWidth: '100%', maxHeight: '70dvh', objectFit: 'contain', display: 'block', margin: '0 auto', borderRadius: 8 }} />
              )}
              {viewFile.mime === 'application/pdf' && (
                <iframe src={viewFile.url} style={{ width: '100%', height: '70dvh', border: 'none', borderRadius: 8 }} />
              )}
              {viewFile.mime.startsWith('text/') && (
                <div style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--text-secondary)', background: 'var(--bg-base)', padding: 16, borderRadius: 8, overflowX: 'auto' }}>
                  <a href={viewFile.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-hover)' }}>Open in new tab</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FileRow({
  file, onDownload, onView, onDelete,
}: {
  file: FileRecord
  onDownload: () => void
  onView?: () => void
  onDelete: () => void
}) {
  const [hover, setHover] = useState(false)

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px', borderRadius: 8,
        background: hover ? 'var(--bg-hover)' : 'transparent',
        transition: 'background 0.1s',
        cursor: 'default',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span style={{ fontSize: 20, flexShrink: 0 }}>{fileIcon(file.mime_type)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file.name}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>
          {formatBytes(file.size)} · {formatRelativeTime(file.created_at)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, opacity: hover ? 1 : 0, transition: 'opacity 0.12s', flexShrink: 0 }}>
        {onView && (
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onView} title="View">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" /><circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        )}
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onDownload} title="Download">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
        </button>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onDelete} title="Delete" style={{ color: 'var(--danger)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function EmptyFiles({ onUpload }: { onUpload: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 260, gap: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 44, marginBottom: 4 }}>📁</div>
      <h3 style={{ fontWeight: 700, color: '#fff', fontSize: '1.125rem', margin: 0 }}>No files yet</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0, lineHeight: 1.6 }}>
        Upload files to share with your AI workers
      </p>
      <button className="btn btn-primary btn-md" onClick={onUpload}>
        Upload First File
      </button>
    </div>
  )
}

function FileSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px' }}>
          <div style={{ width: 24, height: 24, borderRadius: 4, background: 'var(--bg-overlay)' }} className="animate-pulse-slow" />
          <div style={{ flex: 1 }}>
            <div style={{ height: 13, background: 'var(--bg-overlay)', borderRadius: 4, width: '40%', marginBottom: 5 }} className="animate-pulse-slow" />
            <div style={{ height: 11, background: 'var(--bg-overlay)', borderRadius: 4, width: '25%' }} className="animate-pulse-slow" />
          </div>
        </div>
      ))}
    </div>
  )
}
