import type { RenderTooltipProps } from './Tooltip.tsx'
import type { JSX } from 'react'

/**
 * The default rendering for the tooltip, that displays the data.id property.
 */
export function DefaultRenderTooltip({ data }: RenderTooltipProps<{ id: string }>): JSX.Element {
  return <div className="yfiles-react-tooltip">{data.id}</div>
}
