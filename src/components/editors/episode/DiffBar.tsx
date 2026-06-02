interface Props {
  fileId: string
  onAccept: () => void
  onReject: () => void
}

export function DiffBar({ onAccept, onReject }: Props) {
  return (
    <div className="diff-bar">
      <span className="diff-bar-label"><b>AI 改动</b> — 审阅后接受或拒绝</span>
      <button className="btn-accept" onClick={onAccept}>✓ 接受</button>
      <button className="btn-reject" onClick={onReject}>✕ 拒绝</button>
    </div>
  )
}
