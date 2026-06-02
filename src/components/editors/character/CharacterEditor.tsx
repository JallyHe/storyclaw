import { useState, useCallback } from 'react'
import type { ChrFile } from '@/types'
import { useWorkspaceStore } from '@/store'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="form-field">
      <div className="ff-label">{label}{hint && <span className="ff-hint">{hint}</span>}</div>
      {children}
    </div>
  )
}

interface Props { filePath: string; file: ChrFile }

const splitList = (value: string) => value
  .split(/[,，\n]/)
  .map(item => item.trim())
  .filter(Boolean)

export function CharacterEditor({ filePath, file }: Props) {
  const [data, setData] = useState(file)
  const { saveFile, markDirty } = useWorkspaceStore()

  const patch = useCallback(async (changes: Partial<ChrFile>) => {
    const updated = { ...data, ...changes }
    setData(updated)
    markDirty(filePath)
    await saveFile(filePath, updated)
  }, [data, filePath, saveFile, markDirty])

  const updateLocal = useCallback((changes: Partial<ChrFile>) => {
    setData(current => ({ ...current, ...changes }))
  }, [])

  const accent = data.color || '#e0a458'

  return (
    <div className="form-scroll">
      <div className="form-page">
        <div className="form-hero">
          <span className="char-avatar" style={{ background: accent }}>
            {data.name[0] ?? '?'}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              className="form-title-input"
              value={data.name}
              onChange={e => updateLocal({ name: e.target.value })}
              onBlur={e => patch({ name: e.target.value })}
              spellCheck={false}
            />
            <div className="form-sub">
              <span className="pill" style={{
                background: `color-mix(in srgb, ${accent} 22%, transparent)`,
                color: accent
              }}>{data.role}</span>
              {data.gender && <span className="form-sub-dim">{data.gender}</span>}
              <span className="form-sub-dim">{data.age || '年龄未定'}{data.age ? ' 岁' : ''}</span>
              {data.occupation && <span className="form-sub-dim">{data.occupation}</span>}
              {(data.appearsIn ?? []).map(ep => (
                <span key={ep} className="ep-chip">{ep}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="form-grid two">
          <Field label="角色定位">
            <input
              className="ff-input"
              value={data.role}
              onChange={e => updateLocal({ role: e.target.value })}
              onBlur={e => patch({ role: e.target.value })}
              placeholder="主角、反派、配角…"
            />
          </Field>

          <Field label="别名 / 昵称">
            <input
              className="ff-input"
              value={data.alias ?? ''}
              onChange={e => updateLocal({ alias: e.target.value })}
              onBlur={e => patch({ alias: e.target.value })}
              placeholder="可留空"
            />
          </Field>

          <Field label="年龄">
            <input
              className="ff-input"
              type="number"
              min={0}
              value={data.age || ''}
              onChange={e => updateLocal({ age: Number(e.target.value) || 0 })}
              onBlur={e => patch({ age: Number(e.target.value) || 0 })}
            />
          </Field>

          <Field label="性别">
            <input
              className="ff-input"
              value={data.gender ?? ''}
              onChange={e => updateLocal({ gender: e.target.value })}
              onBlur={e => patch({ gender: e.target.value })}
              placeholder="男、女、非二元、未说明…"
            />
          </Field>

          <Field label="职业 / 身份">
            <input
              className="ff-input"
              value={data.occupation ?? ''}
              onChange={e => updateLocal({ occupation: e.target.value })}
              onBlur={e => patch({ occupation: e.target.value })}
              placeholder="主播、捕快、房牙…"
            />
          </Field>

          <Field label="关系">
            <input
              className="ff-input"
              value={data.relationship ?? ''}
              onChange={e => updateLocal({ relationship: e.target.value })}
              onBlur={e => patch({ relationship: e.target.value })}
              placeholder="与主角/反派/组织的关系"
            />
          </Field>

          <Field label="角色颜色">
            <input
              className="ff-input"
              type="color"
              value={accent}
              onChange={e => updateLocal({ color: e.target.value })}
              onBlur={e => patch({ color: e.target.value })}
            />
          </Field>

          <Field label="出场集数" hint="逗号分隔">
            <input
              className="ff-input"
              value={(data.appearsIn ?? []).join('，')}
              onChange={e => updateLocal({ appearsIn: splitList(e.target.value) })}
              onBlur={e => patch({ appearsIn: splitList(e.target.value) })}
              placeholder="EP01，EP02"
            />
          </Field>
        </div>

        <Field label="一句话设定">
          <textarea
            className="ff-input"
            rows={2}
            value={data.tagline}
            onChange={e => updateLocal({ tagline: e.target.value })}
            onBlur={e => patch({ tagline: e.target.value })}
            placeholder="一句话描述这个角色…"
            spellCheck={false}
          />
        </Field>

        <Field label="性格标签" hint="逗号分隔">
          <input
            className="ff-input"
            value={(data.traits ?? []).join('，')}
            onChange={e => updateLocal({ traits: splitList(e.target.value) })}
            onBlur={e => patch({ traits: splitList(e.target.value) })}
            placeholder="冷静，嘴硬，行动派"
          />
          <div className="tag-row">
            {(data.traits ?? []).map((t, i) => (
              <span
                key={i}
                className="trait-tag"
                style={{ borderColor: `color-mix(in srgb, ${accent} 45%, transparent)` }}
              >{t}</span>
            ))}
          </div>
        </Field>

        <Field label="外貌 / 造型">
          <textarea
            className="ff-input"
            rows={3}
            value={data.appearance ?? ''}
            onChange={e => updateLocal({ appearance: e.target.value })}
            onBlur={e => patch({ appearance: e.target.value })}
            placeholder="外貌、服装、道具、视觉记忆点…"
            spellCheck={false}
          />
        </Field>

        <Field label="人物背景">
          <textarea
            className="ff-input"
            rows={4}
            value={data.background ?? ''}
            onChange={e => updateLocal({ background: e.target.value })}
            onBlur={e => patch({ background: e.target.value })}
            placeholder="出身、经历、创伤、社会位置…"
            spellCheck={false}
          />
        </Field>

        <Field label="目标 / 动机">
          <textarea
            className="ff-input"
            rows={3}
            value={data.motivation ?? ''}
            onChange={e => updateLocal({ motivation: e.target.value })}
            onBlur={e => patch({ motivation: e.target.value })}
            placeholder="他/她想要什么，为什么非要得到…"
            spellCheck={false}
          />
        </Field>

        <Field label="秘密 / 隐情">
          <textarea
            className="ff-input"
            rows={3}
            value={data.secret ?? ''}
            onChange={e => updateLocal({ secret: e.target.value })}
            onBlur={e => patch({ secret: e.target.value })}
            placeholder="可以被剧情揭开的隐藏信息…"
            spellCheck={false}
          />
        </Field>

        <Field label="人物弧光">
          <textarea
            className="ff-input"
            rows={3}
            value={data.arc}
            onChange={e => updateLocal({ arc: e.target.value })}
            onBlur={e => patch({ arc: e.target.value })}
            placeholder="这个角色的成长轨迹…"
            spellCheck={false}
          />
        </Field>

        <Field label="语气 / 说话方式" hint="AI 改写对白时会参考">
          <textarea
            className="ff-input"
            rows={3}
            value={data.voice}
            onChange={e => updateLocal({ voice: e.target.value })}
            onBlur={e => patch({ voice: e.target.value })}
            placeholder="语气、节奏、口头禅…"
            spellCheck={false}
          />
        </Field>
      </div>
    </div>
  )
}
