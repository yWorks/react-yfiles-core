import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import TimelineEngine, {
  DataItemFilter,
  FilterChangedListener,
  TimeRange
} from './engine/TimelineEngine'
import { TimelineStyle } from './engine/Styling'
import { useTimelineReducer } from './TimelineState'
import { TimelineTooltip } from './TimelineTooltip/TimelineTooltip'
import { TimelinePlayButton } from './TimelinePlayButton'

export interface TimelineProps<TDataItem> {
  /** Data items for populating the timeline */
  dataItems: TDataItem[]
  /** Time range getter */
  getTimeRange: (item: TDataItem) => TimeRange
  /** Callback for receiving a filter function for items in the current timeframe. */
  onFilterChange?: (filter: DataItemFilter<TDataItem>) => void
  /** Callback for receiving the list of items that match the currently hovered timeline bar. */
  onBarHover?: (items: TDataItem[]) => void
  /** Callback for receiving the list of items that match the currently selected timeline bar. */
  onBarSelected?: (items: TDataItem[]) => void
  TooltipComponent?: typeof TimelineTooltip | null
  PlayButtonComponent?: typeof TimelinePlayButton | null
  style?: TimelineStyle
}

export function Timeline<TDataItem>({
  dataItems,
  getTimeRange,
  onFilterChange,
  onBarHover,
  onBarSelected,
  TooltipComponent = TimelineTooltip,
  PlayButtonComponent = TimelinePlayButton,
  style = {}
}: TimelineProps<TDataItem>): JSX.Element {
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const [{ engine, tooltip, tooltipContainer, animationState }, dispatch] =
    useTimelineReducer<TDataItem>()

  useEffect(() => {
    if (!container) return
    const engine = new TimelineEngine(dispatch, container, getTimeRange, style)
    dispatch({ engine })
    return () => engine.cleanUp()
  }, [container, dataItems, dispatch])

  useEffect(() => {
    if (engine) {
      engine.items = dataItems
    }
  }, [engine, dataItems])

  useEffect(() => {
    if (engine && onFilterChange) {
      const handler: FilterChangedListener<TDataItem> = filter => {
        // `filter` always has the same identity; use a wrapper so that a new function
        // is emitted each time:
        onFilterChange((item: TDataItem) => {
          return filter(item)
        })
      }
      engine.addFilterChangedListener(handler)
      return () => engine.removeFilterChangedListener(handler)
    }
  }, [engine, onFilterChange])

  useEffect(() => {
    if (engine && onBarHover) {
      engine.addBarHoverListener(onBarHover)
      return () => engine.removeBarHoverListener(onBarHover)
    }
  }, [engine, onBarHover])

  useEffect(() => {
    if (engine && onBarSelected) {
      engine.addBarSelectListener(onBarSelected)
      return () => engine.removeBarSelectListener(onBarSelected)
    }
  }, [engine, onBarSelected])

  const toggleAnimation = useCallback(() => {
    animationState === 'idle' ? engine?.play() : engine?.stop()
  }, [engine, animationState])

  return (
    <>
      <div ref={setContainer} style={{ width: '100%', height: '100%', position: 'relative' }}>
        {PlayButtonComponent && (
          <div style={{ position: 'absolute', zIndex: 100 }}>
            <PlayButtonComponent state={animationState} toggle={toggleAnimation} />
          </div>
        )}
      </div>
      {tooltip && tooltipContainer && TooltipComponent
        ? createPortal(<TooltipComponent {...tooltip} />, tooltipContainer)
        : null}
    </>
  )
}
