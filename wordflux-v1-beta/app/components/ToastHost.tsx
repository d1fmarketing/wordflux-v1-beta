'use client'
import React from 'react'

type Toast = { id: number; text: string; action?: { label: string; onClick: () => void } }
const Ctx = React.createContext<{ push: (t: Omit<Toast,'id'>) => void } | null>(null)
export const useToast = () => {
  const c = React.useContext(Ctx)
  if (!c) throw new Error('Toast context not ready')
  return c
}
export default function ToastHost() {
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const push = React.useCallback((t: Omit<Toast,'id'>) => {
    const id = Date.now() + Math.floor(Math.random()*1000)
    setToasts((p) => [...p, { id, ...t }])
    setTimeout(() => setToasts((p) => p.filter(x => x.id !== id)), 5000)
  }, [])
  React.useEffect(() => { (window as any).wfToast = push }, [push])
  return (
    <Ctx.Provider value={{ push }}>
      <div style={{ position:'fixed', left:0, right:0, bottom:16, display:'flex', justifyContent:'center', pointerEvents:'none', zIndex:1000 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {toasts.map(t => (
            <div key={t.id} style={{ pointerEvents:'auto', background:'var(--wf-card)', color:'var(--wf-ink)', border:'1px solid var(--wf-line)', borderRadius:12, boxShadow:'var(--wf-shadow)', padding:'10px 12px', display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:14 }}>{t.text}</span>
              {t.action && (
                <button onClick={t.action.onClick} style={{ padding:'6px 10px', border:'1px solid var(--wf-line)', borderRadius:9999, background:'#fff', cursor:'pointer' }}>{t.action.label}</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Ctx.Provider>
  )
}
