import './TimelineTooltip.css'

export type TimelineTooltipProps = {
  timeLabel: string
  entries: number | null
}

export function TimelineTooltip({ entries, timeLabel }: TimelineTooltipProps) {
  return (
    <div className="yfiles-react-timeline__tooltip">
      <h3 className="yfiles-react-timeline__tooltip-title">{timeLabel}</h3>
      <span className="yfiles-react-timeline__tooltip-content">Entries: {entries}</span>
    </div>
  )
}
