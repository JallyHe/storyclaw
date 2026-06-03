export const WORLD_SECTION_DEFS = [
  {
    key: 'premise',
    label: '核心设定',
    hint: '故事世界、类型承诺、核心前提、主要看点。',
    placeholder: '这个故事最重要的世界前提是什么？观众进入故事时需要默认相信什么？'
  },
  {
    key: 'timeAndPlace',
    label: '时代地域',
    hint: '年代、城市/乡镇/架空地域、生活质感、社会环境。',
    placeholder: '故事发生在什么年代和地域？生活质感、气候、街区、方言或社会气氛如何？'
  },
  {
    key: 'rules',
    label: '行业与规则',
    hint: '行业背景、制度流程、职业规则、世界运行规则、禁忌与代价。',
    placeholder: '这个行业/制度/世界有哪些硬规则？违反规则会付出什么代价？'
  },
  {
    key: 'socialRelations',
    label: '社会关系',
    hint: '家庭、单位、学校、社区、阶层、人情网络、人物共同处境。',
    placeholder: '人物之间被哪些关系网绑定？他们共同面对怎样的人情、阶层或组织压力？'
  },
  {
    key: 'keySpaces',
    label: '关键空间',
    hint: '高频场景、重要地点、空间关系、每个地点的戏剧功能。',
    placeholder: '哪些地点会反复出现？每个空间承载什么戏剧功能？'
  },
  {
    key: 'backstoryAndMaterials',
    label: '前史与素材',
    hint: '故事开始前的大事、旧案/往事、参考资料、待核查问题、禁用设定。',
    placeholder: '故事开始前发生过什么？有哪些资料、细节、禁用设定或待核查问题？'
  }
] as const

export type WorldSectionKey = (typeof WORLD_SECTION_DEFS)[number]['key']
export type WorldSections = Record<WorldSectionKey, string>

export function createEmptyWorldSections(seed?: Partial<Record<WorldSectionKey, string>>): WorldSections {
  return Object.fromEntries(
    WORLD_SECTION_DEFS.map(section => [section.key, seed?.[section.key] ?? ''])
  ) as WorldSections
}

export function composeWorldSectionsMarkdown(sections: WorldSections): string {
  return WORLD_SECTION_DEFS
    .map(section => {
      const content = sections[section.key].trim()
      return content ? `## ${section.label}\n\n${content}` : ''
    })
    .filter(Boolean)
    .join('\n\n')
}
