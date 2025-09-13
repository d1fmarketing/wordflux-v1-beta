'use client'

import { useEffect, useState } from 'react'

export default function SimpleBoard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    console.log('[SimpleBoard] Mounting...')
    
    fetch('/api/board/sync')
      .then(res => {
        console.log('[SimpleBoard] Response status:', res.status)
        return res.json()
      })
      .then(data => {
        console.log('[SimpleBoard] Data received:', data)
        setData(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('[SimpleBoard] Error:', err)
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) return <div>Loading simple board...</div>
  if (error) return <div>Error: {error}</div>
  if (!data) return <div>No data</div>

  return (
    <div style={{ padding: 20 }}>
      <h2>Simple Board</h2>
      <p>API Response OK: {data.ok ? 'Yes' : 'No'}</p>
      <p>Columns: {data.state?.columns?.length || 0}</p>
      <pre>{JSON.stringify(data.state?.columns?.map((c: any) => ({
        id: c.id,
        title: c.title,
        tasks: c.tasks?.length || 0
      })), null, 2)}</pre>
    </div>
  )
}