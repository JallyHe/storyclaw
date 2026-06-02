interface Props {
  episode: string
  title: string
}

export function ScreenplayEpisodeHeader({
  episode,
  title
}: Props) {
  return (
    <div className="pm-page-title">
      <span className="pm-page-episode">{episode}</span>
      <span className="pm-page-title-text">{title}</span>
      <span className="pm-page-title-side" />
    </div>
  )
}
