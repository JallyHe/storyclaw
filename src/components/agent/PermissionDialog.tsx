import { useEffect, useState } from 'react'
import { agentIpc } from '@/ipc/agent'
import { Ic } from '@/components/icons'

interface PendingRequest {
  requestId: string
  tool: string
  target: string
  description: string
}

/** Floating dialog that appears when the Agent requests a file-write permission. */
export function PermissionDialog() {
  const [pending, setPending] = useState<PendingRequest | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as PendingRequest
      setPending(detail)
    }
    window.addEventListener('agent:permission-request', handler)
    return () => window.removeEventListener('agent:permission-request', handler)
  }, [])

  if (!pending) return null

  const respond = (approved: boolean) => {
    agentIpc.permissionRespond(pending.requestId, approved)
    setPending(null)
  }

  return (
    <div className="perm-dialog-backdrop">
      <div className="perm-dialog">
        <div className="perm-dialog-icon">
          <Ic.shield width={18} height={18} />
        </div>
        <div className="perm-dialog-body">
          <div className="perm-dialog-title">Agent 请求授权</div>
          <div className="perm-dialog-desc">{pending.description}</div>
          <div className="perm-dialog-target">{pending.target}</div>
        </div>
        <div className="perm-dialog-actions">
          <button className="perm-btn deny"  onClick={() => respond(false)}>拒绝</button>
          <button className="perm-btn allow" onClick={() => respond(true)}>允许</button>
        </div>
      </div>
    </div>
  )
}
