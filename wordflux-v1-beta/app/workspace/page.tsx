export const dynamic = 'force-dynamic'

import dynamicLoad from 'next/dynamic'

const Board2 = dynamicLoad(() => import('../components/board2/Board2'), {
  ssr: false,
  loading: () => <div style={{ padding: 16 }}>Loading board...</div>
})

const Chat = dynamicLoad(() => import('../components/Chat'), {
  ssr: false,
  loading: () => <div style={{ padding: 16 }}>Loading chat...</div>
})

const ToastHost = dynamicLoad(() => import('../components/ToastHost'), {
  ssr: false
})

export default function WorkspacePage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--surface)' }}>
      <div style={{ flex: '0 0 280px', borderRight: '1px solid var(--line)', minWidth: 0 }}>
        <Chat />
      </div>
      <div style={{ flex: '1 1 auto', minWidth: 0, position: 'relative' }}>
        <Board2 />
        <ToastHost />
      </div>
    </div>
  )
}
