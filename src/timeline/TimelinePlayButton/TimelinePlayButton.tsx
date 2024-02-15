import './TimelinePlayButton.css'

export type TimelinePlayButtonProps = {
  state: 'playing' | 'idle'
  toggle: () => void
}

export function TimelinePlayButton({ state, toggle }: TimelinePlayButtonProps) {
  return (
    <button
      onClick={toggle}
      className={[
        'yfiles-react-timeline__play-button',
        state === 'idle'
          ? 'yfiles-react-timeline__play-button--idle'
          : 'yfiles-react-timeline__play-button--playing'
      ].join(' ')}
    />
  )
}
