import '@/app/styles/dashboard.css'
import DashboardMini from '@/app/components/DashboardMini'
import Chat from '@/app/components/Chat'
import ToastHost from '@/app/components/ToastHost'

export const dynamic = 'force-dynamic'

export default function WorkspacePage() {
  return (
    <main data-theme="quiet" data-density="ultra" className="workspace" data-testid="workspace-grid">
      <div className="ws-layout">
        <section className="ws-left" data-testid="dashboard-panel">
          <DashboardMini />
        </section>
        <section className="ws-right" data-testid="chat-panel">
          <div className="chat-pane">
            <Chat />
          </div>
          <ToastHost />
        </section>
      </div>
    </main>
  )
}
