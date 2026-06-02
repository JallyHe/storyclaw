import { Schema } from 'prosemirror-model'

export const screenplaySchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    episode_heading: {
      group: 'block',
      content: 'inline*',
      attrs: {
        id: { default: null },
        episode: { default: '' },
        episodeLabel: { default: '' }
      },
      parseDOM: [{ tag: 'div[data-type="episode_heading"]' }],
      toDOM: node => [
        'div',
        { 'data-type': 'episode_heading', 'data-id': node.attrs.id, 'data-episode': node.attrs.episode, class: 'pm-sp-episode-heading' },
        ['span', { class: 'pm-sp-episode-label', contenteditable: 'false' }, node.attrs.episodeLabel || node.attrs.episode],
        ['span', { class: 'pm-sp-episode-title' }, 0],
        ['span', { class: 'pm-sp-episode-side', contenteditable: 'false' }, '']
      ]
    },
    scene_heading: {
      group: 'block',
      content: 'inline*',
      attrs: {
        id: { default: null },
        number: { default: '' },
        intext: { default: '' },
        location: { default: '' },
        time: { default: '' },
        synopsis: { default: '' }
      },
      parseDOM: [{ tag: 'div[data-type="scene_heading"]' }],
      toDOM: node => ['div', { 'data-type': 'scene_heading', 'data-id': node.attrs.id, class: 'pm-sp-scene', ...node.attrs }, 0]
    },
    action: blockNode('action', 'pm-sp-action'),
    character: blockNode('character', 'pm-sp-character', { name: { default: '' }, ext: { default: '' } }),
    dialogue: blockNode('dialogue', 'pm-sp-dialogue'),
    paren: blockNode('paren', 'pm-sp-paren'),
    transition: blockNode('transition', 'pm-sp-transition'),
    text: { group: 'inline' },
    hard_break: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM: () => ['br']
    }
  },
  marks: {
    strong: {
      parseDOM: [{ tag: 'strong' }, { tag: 'b' }],
      toDOM: () => ['strong', 0]
    },
    em: {
      parseDOM: [{ tag: 'em' }, { tag: 'i' }],
      toDOM: () => ['em', 0]
    },
    underline: {
      parseDOM: [{ tag: 'u' }],
      toDOM: () => ['u', 0]
    }
  }
})

function blockNode(type: string, className: string, attrs = { id: { default: null } }) {
  return {
    group: 'block',
    content: 'inline*',
    attrs,
    parseDOM: [{ tag: `div[data-type="${type}"]` }],
    toDOM: (node: any) => ['div', { 'data-type': type, 'data-id': node.attrs.id, class: className, ...node.attrs }, 0]
  }
}

export type ScreenplayLineType = 'scene' | 'action' | 'character' | 'dialogue' | 'paren' | 'transition'

export const SCREENPLAY_LABELS: Record<ScreenplayLineType, string> = {
  scene: '场次标题',
  action: '动作描述',
  character: '人物',
  dialogue: '对白行',
  paren: '括号',
  transition: '转场'
}
