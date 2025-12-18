import { useReducer } from 'react'
import { GraphComponent } from '@yfiles/yfiles'
import { TimelineTooltipProps } from './TimelineTooltip'
import TimelineEngine from './engine/TimelineEngine'

export type TimelineState<T> = {
  engine: TimelineEngine<T> | null
  graphComponent: GraphComponent | null
  tooltipContainer: HTMLElement | null
  tooltip: TimelineTooltipProps | null
  animationState: 'playing' | 'idle'
}

type TimelineAction<T> = Partial<TimelineState<T>>
export type TimelineDispatch<T> = (action: TimelineAction<T>) => void

const initialState = {
  engine: null,
  graphComponent: null,
  tooltipContainer: null,
  tooltip: null,
  animationState: 'idle' as const
}

function timelineReducer<T>(state: TimelineState<T>, action: TimelineAction<T>) {
  return { ...state, ...action }
}

export function useTimelineReducer<T>(): [TimelineState<T>, TimelineDispatch<T>] {
  return useReducer(timelineReducer<T>, initialState as TimelineState<T>)
}
