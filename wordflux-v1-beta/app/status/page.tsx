'use client'

import { useEffect, useState } from 'react'

type EndpointStatus = {
  name: string
  url: string
  status: 'UP' | 'DOWN'
}

export default function StatusPage() {
  const [status, setStatus] = useState<EndpointStatus[]>([])

  useEffect(() => {
    let isMounted = true

    const checkHealth = async () => {
      const endpoints: Array<Omit<EndpointStatus, 'status'>> = [
        { name: 'App', url: '/api/health' },
        { name: 'TaskCafe', url: '/api/board/diagnostics' },
        { name: 'MCP Gateway', url: '/api/mcp-proxy' }
      ]

      const results: EndpointStatus[] = await Promise.all(
        endpoints.map(async (ep): Promise<EndpointStatus> => {
          try {
            const res = await fetch(ep.url, { cache: 'no-store' })
            return { ...ep, status: (res.ok ? 'UP' : 'DOWN') }
          } catch (error) {
            console.warn('[status-page] health check failed', ep, error)
            return { ...ep, status: 'DOWN' }
          }
        })
      )

      if (isMounted) {
        setStatus(results)
      }
    }

    checkHealth()
    const interval = setInterval(checkHealth, 5000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-3xl font-semibold">System Status</h1>
      <div className="space-y-2">
        {status.map(endpoint => (
          <div key={endpoint.name} className="flex items-center gap-2">
            <span
              className={`h-3 w-3 rounded-full ${
                endpoint.status === 'UP' ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="font-medium">{endpoint.name}</span>
            <span className="text-sm text-muted-foreground">{endpoint.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
