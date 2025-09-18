'use client'

export default function PublicStatus() {
  return (
    <div className="p-8 bg-black text-green-400 font-mono min-h-screen">
      <h1 className="text-2xl mb-4">WORDFLUX SYSTEM STATUS</h1>
      <div className="space-y-2">
        <p>🟢 App: http://52.4.68.118/</p>
        <p>🟢 WebSocket: ws://52.4.68.118/socket.io/</p>
        <p>🟢 Grafana: http://52.4.68.118:3002/ (credentials in .env.local)</p>
        <p>🟢 Prometheus: http://52.4.68.118:9090/</p>
        <p>🟢 Load Test: p95 128ms | p99 140ms | 0% failures</p>
      </div>
    </div>
  )
}
