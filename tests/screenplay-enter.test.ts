import { describe, expect, it } from 'vitest'
import { EditorState, TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { createScreenplayPlugins } from '../src/editors/screenplay/plugins'
import { screenplaySchema } from '../src/editors/screenplay/schema'
import { screenplaySlashTriggerFromText } from '../src/components/editors/prosemirror/ScreenplayProseMirrorEditor'

describe('screenplay editor Enter behavior', () => {
  it('splits a line at the cursor when Enter is pressed mid-sentence', () => {
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    const doc = screenplaySchema.node('doc', null, [
      screenplaySchema.nodes.action.create({ id: 'a1' }, screenplaySchema.text('灯亮了。'))
    ])
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 2),
      plugins: createScreenplayPlugins()
    })
    const view = new EditorView(mount, { state })

    view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

    expect(view.state.doc.childCount).toBe(2)
    expect(view.state.doc.child(0).textContent).toBe('灯')
    expect(view.state.doc.child(1).textContent).toBe('亮了。')
    view.destroy()
    mount.remove()
  })

  it('keeps multiple Enter line breaks at the end of a non-empty text line', () => {
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    const doc = screenplaySchema.node('doc', null, [
      screenplaySchema.nodes.action.create({ id: 'a1' }, screenplaySchema.text('灯亮了。'))
    ])
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 5),
      plugins: createScreenplayPlugins()
    })
    const view = new EditorView(mount, { state })

    view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

    expect(view.state.doc.childCount).toBe(1)
    expect(view.state.doc.child(0).toJSON().content).toEqual([
      { type: 'text', text: '灯亮了。' },
      { type: 'hard_break' },
      { type: 'hard_break' }
    ])
    view.destroy()
    mount.remove()
  })

  it('detects slash commands after a hard line break', () => {
    expect(screenplaySlashTriggerFromText('灯亮了。\n/')).toEqual({ query: '', offset: 5 })
    expect(screenplaySlashTriggerFromText('灯亮了。\n/添加')).toEqual({ query: '添加', offset: 5 })
  })

  it('allows editing the episode number in an episode heading', () => {
    const mount = document.createElement('div')
    document.body.appendChild(mount)
    const doc = screenplaySchema.node('doc', null, [
      screenplaySchema.nodes.episode_heading.create(
        { id: 'e1', episode: 'EP01', episodeLabel: '第1集' },
        screenplaySchema.text('第一集')
      ),
      screenplaySchema.nodes.action.create({ id: 'a1' }, screenplaySchema.text('灯亮了。'))
    ])
    const state = EditorState.create({
      doc,
      plugins: createScreenplayPlugins()
    })
    const view = new EditorView(mount, { state })
    const input = view.dom.querySelector<HTMLInputElement>('.pm-sp-episode-number')

    expect(input).toBeTruthy()
    input!.value = '12'
    input!.dispatchEvent(new Event('input', { bubbles: true }))

    expect(view.state.doc.child(0).attrs.episode).toBe('EP12')
    expect(view.state.doc.child(0).attrs.episodeLabel).toBe('第12集')
    view.destroy()
    mount.remove()
  })
})
