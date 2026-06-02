import { describe, expect, it } from 'vitest'
import { addEpisodeToFile, deleteEpisodeFromFile } from '../src/editors/screenplay/episodeCollection'
import type { EpFile } from '../src/types'

const single: EpFile = {
  version: 1,
  episode: 'EP01',
  title: '第一集',
  status: 'wip',
  logline: '',
  blocks: [{ id: 'a1', type: 'action', text: '第一集正文' }]
}

describe('screenplay episode collection', () => {
  it('converts a single .ep into a multi-episode .ep when adding an episode', () => {
    const result = addEpisodeToFile(single)

    expect(result.index).toBe(1)
    expect(result.file.episodes).toHaveLength(2)
    expect(result.file.episodes?.[0]).toMatchObject({ episode: 'EP01', title: '第一集' })
    expect(result.file.episodes?.[1]).toMatchObject({ episode: 'EP02', title: '第2集' })
  })

  it('does not delete the first episode', () => {
    const multi = addEpisodeToFile(single).file

    expect(deleteEpisodeFromFile(multi, 0).file).toBe(multi)
  })

  it('deletes later episodes and collapses back to single episode when only one remains', () => {
    const multi = addEpisodeToFile(single).file
    const result = deleteEpisodeFromFile(multi, 1)

    expect(result.index).toBe(0)
    expect(result.file.episodes).toBeUndefined()
    expect(result.file).toMatchObject({ episode: 'EP01', title: '第一集' })
  })
})
