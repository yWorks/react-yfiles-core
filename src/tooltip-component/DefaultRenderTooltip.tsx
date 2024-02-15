import { RenderTooltipProps } from './Tooltip.tsx'

/**
 * The default rendering for the tooltip, that displays the data.id property.
 */
export function DefaultRenderTooltip({ data }: RenderTooltipProps<{ id: string }>) {
  return <div className="yfiles-react-tooltip">{data.id}</div>
}
