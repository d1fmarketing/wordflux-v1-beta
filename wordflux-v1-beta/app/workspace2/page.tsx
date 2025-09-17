export const dynamic = 'force-dynamic'
export const revalidate = 0

import dynamicLoad from 'next/dynamic'

const Board2 = dynamicLoad(() => import('../components/board2/Board2'), {
  ssr: false,
  loading: () => <div style={{ padding: 16 }}>Loading board...</div>
})

const Chat = dynamicLoad(() => import('../components/Chat'), {
  ssr: false,
  loading: () => <div style={{ padding: 16 }}>Loading chat...</div>
})

export default function Workspace2() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--surface)' }}>
      <div style={{ flex: '0 0 360px', borderRight: '1px solid var(--line)', minWidth: 0 }}>
        <Chat />
      </div>
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <Board2 />
      </div>
    </div>
  )
}
