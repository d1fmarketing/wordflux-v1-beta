'use client'

import { useEffect } from 'react'
import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3003', {
      transports: ['websocket'],
      reconnectionAttempts: 5
    })
  }
  return socket
}

export function useWebSocket(event: string, handler: (data: any) => void) {
  useEffect(() => {
    const s = getSocket()
    s.on(event, handler)
    return () => {
      s.off(event, handler)
    }
  }, [event, handler])

  return getSocket()
}
