export const dynamic = 'force-dynamic'
import ndynamic from "next/dynamic"

export const revalidate = 0

const Board2 = ndynamic(() => import('../components/board2/Board2'), { ssr: false })
const Chat = ndynamic(() => import('../components/Chat'), { ssr: false })

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
