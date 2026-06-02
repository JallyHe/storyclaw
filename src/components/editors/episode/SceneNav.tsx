import type { EpFile } from '@/types'

interface Segment {
  headId: string; number: string; intext: string; location: string; synopsis: string; hasDraft: boolean
}

function getSegments(file: EpFile): Segment[] {
  return file.blocks
    .filter(b => b.type === 'scene')
    .map(b => {
      if (b.type !== 'scene') return null!
      const idx = file.blocks.indexOf(b)
      const following = file.blocks.slice(idx + 1)
      const nextScene = following.findIndex(x => x.type === 'scene')
      const between = nextScene >= 0 ? following.slice(0, nextScene) : following
      const hasDraft = between.some(x => 'text' in x && x.text.includes('待'))
      return { headId: b.id, number: b.number, intext: b.intext, location: b.location, synopsis: b.synopsis, hasDraft }
    })
    .filter(Boolean)
}

interface Props { file: EpFile; activeId: string | null; onPick: (id: string) => void }

export function SceneNav({ file, activeId, onPick }: Props) {
  const segs = getSegments(file)
  return (
    <div className="scene-nav">
      <div className="snav-head">
        场景大纲
        <span className="snav-count">{segs.length}</span>
      </div>
      <div className="snav-list">
        {segs.map(s => (
          <div
            key={s.headId}
            className={`snav-item${s.headId === activeId ? ' on' : ''}`}
            onClick={() => onPick(s.headId)}
          >
            <div className="snav-row1">
              <span className="snav-no">{s.number}</span>
              <span className="snav-ie">{s.intext}</span>
              <span className="snav-loc">{s.location}</span>
              {s.hasDraft && <span className="snav-draft">待写</span>}
            </div>
            {s.synopsis && <div className="snav-syn">{s.synopsis}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
