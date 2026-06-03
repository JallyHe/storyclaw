interface Props {
  onAccept: () => void
  onReject: () => void
  onAcceptAll?: () => void
}

export function DiffBar({ onAccept, onReject, onAcceptAll }: Props) {
  return (
    <div className="diff-bar">
      <span className="diff-bar-label"><b>AI 改动</b> — 审阅后接受或拒绝</span>
      {onAcceptAll && <button className="btn-accept" onClick={onAcceptAll}>✓ 全部接受</button>}
      <button className="btn-accept" onClick={onAccept}>✓ 接受</button>
      <button className="btn-reject" onClick={onReject}>✕ 拒绝</button>
    </div>
  )
}
