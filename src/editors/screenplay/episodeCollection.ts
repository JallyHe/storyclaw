import type { EpFile } from '@/types'
import { episodeCodeFromNumber, episodeNumberFromCode } from './episodeMeta'

export function addEpisodeToFile(file: EpFile): { file: EpFile; index: number } {
  const episodes = file.episodes && file.episodes.length > 1 ? file.episodes : [stripCollection(file)]
  const nextIndex = episodes.length
  const nextNumber = nextEpisodeNumber(episodes)
  const nextEpisode: EpFile = {
    version: 1,
    episode: episodeCodeFromNumber(String(nextNumber)),
    title: `第${nextNumber}集`,
    status: 'wip',
    logline: '',
    blocks: [
      { id: `scene-${Date.now()}`, type: 'scene', number: '1', intext: '内景', location: '待填写', time: '日', synopsis: '' },
      { id: `action-${Date.now()}`, type: 'action', text: '这里写动作或描述。' }
    ]
  }
  const nextEpisodes = [...episodes, nextEpisode]
  return {
    file: {
      ...nextEpisodes[0],
      series: file.series,
      episodes: nextEpisodes
    },
    index: nextIndex
  }
}

export function deleteEpisodeFromFile(file: EpFile, index: number): { file: EpFile; index: number } {
  const episodes = file.episodes && file.episodes.length > 1 ? file.episodes : [stripCollection(file)]
  if (index <= 0 || index >= episodes.length) return { file, index: 0 }

  const nextEpisodes = episodes.filter((_, itemIndex) => itemIndex !== index)
  const nextIndex = Math.max(0, index - 1)
  if (nextEpisodes.length === 1) {
    return { file: nextEpisodes[0], index: 0 }
  }

  return {
    file: {
      ...nextEpisodes[0],
      series: file.series,
      episodes: nextEpisodes
    },
    index: nextIndex
  }
}

function stripCollection(file: EpFile): EpFile {
  const { episodes: _episodes, series: _series, ...episode } = file
  return episode
}

function nextEpisodeNumber(episodes: EpFile[]) {
  return episodes.reduce((max, episode, index) => {
    const value = Number(episodeNumberFromCode(episode.episode, index + 1))
    return Math.max(max, value)
  }, 0) + 1
}
