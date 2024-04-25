import {
  GraphInputMode,
  GraphItemTypes,
  IModelItem,
  Point,
  QueryItemToolTipEventArgs,
  TimeSpan
} from 'yfiles'
import {
  ComponentType,
  createElement,
  PropsWithChildren,
  useEffect,
  useLayoutEffect,
  useState
} from 'react'
import { useGraphComponent } from '../graph-component/GraphComponentProvider.tsx'
import { DefaultRenderTooltip } from './DefaultRenderTooltip.tsx'
import './Tooltip.css'
import { createPortal } from 'react-dom'

/**
 * The props for rendering the tooltip.
 */
export interface RenderTooltipProps<TDataItem> {
  /**
   * The data item for which the tooltip should be rendered.
   */
  data: TDataItem
}

/**
 * The props provided by the tooltip.
 */
export interface TooltipProps<TDataItem> {
  renderTooltip?: ComponentType<RenderTooltipProps<TDataItem>>
}

/**
 * The Tooltip component adds an item tooltip to its parent component. It is designed to be used inside a
 * parent component that displays the graph.
 */
export function Tooltip<TDataItem>({ renderTooltip }: TooltipProps<TDataItem>) {
  const graphComponent = useGraphComponent()!

  const [tooltipRenderInfo, setTooltipRenderInfo] = useState<TooltipRenderInfo<TDataItem> | null>(
    null
  )

  useEffect(() => {
    const inputMode = graphComponent.inputMode as GraphInputMode

    // show tooltips only for nodes and edges
    inputMode.toolTipItems = GraphItemTypes.NODE | GraphItemTypes.EDGE

    // Customize the tooltip's behavior to our liking.
    const mouseHoverInputMode = inputMode.mouseHoverInputMode
    mouseHoverInputMode.toolTipLocationOffset = new Point(15, 15)
    mouseHoverInputMode.delay = TimeSpan.fromMilliseconds(500)
    mouseHoverInputMode.duration = TimeSpan.fromSeconds(5)

    // Register a listener for when a tooltip should be shown.
    const queryItemTooltipListener = (
      _: GraphInputMode,
      evt: QueryItemToolTipEventArgs<IModelItem>
    ) => {
      if (evt.handled) {
        // Tooltip content has already been assigned -> nothing to do.
        return
      }

      // Use a rich HTML element as tooltip content. Alternatively, a plain string would do as well.
      evt.toolTip = createTooltipContent(evt.item!, setTooltipRenderInfo, renderTooltip)

      // Indicate that the tooltip content has been set.
      evt.handled = true
    }
    inputMode.addQueryItemToolTipListener(queryItemTooltipListener)

    return () => {
      inputMode.removeQueryItemToolTipListener(queryItemTooltipListener)
    }
  }, [graphComponent, renderTooltip])

  return (
    <>
      {tooltipRenderInfo &&
        createPortal(
          createElement(
            TooltipWrapper,
            {},
            createElement<RenderTooltipProps<TDataItem>>(
              tooltipRenderInfo.component,
              tooltipRenderInfo.props
            )
          ),
          tooltipRenderInfo.domNode
        )}
    </>
  )
}

/**
 * The tooltip may either be a plain string or it can also be a rich HTML element. In this case, we
 * show the latter by using a dynamically compiled React component.
 */
function createTooltipContent<TDataItem>(
  item: IModelItem,
  setTooltipInfo: (tooltipInfo: TooltipRenderInfo<TDataItem>) => void,
  renderTooltip?: ComponentType<RenderTooltipProps<TDataItem>>
): HTMLDivElement {
  const tooltipContainer = document.createElement('div')

  const template = renderTooltip ?? DefaultRenderTooltip

  setTooltipInfo({
    domNode: tooltipContainer,
    component: template as ComponentType<RenderTooltipProps<TDataItem>>,
    props: { data: item.tag }
  })

  return tooltipContainer
}

/**
 * Wrapper component to ensure that the tooltip is rendered inside the window.
 */
function TooltipWrapper({ children }: PropsWithChildren) {
  const graphComponent = useGraphComponent()

  useLayoutEffect(() => {
    ;(graphComponent.inputMode as GraphInputMode).mouseHoverInputMode.toolTip?.updateLocation()
  }, [])

  return <>{children}</>
}

type TooltipRenderInfo<TDataItem> = {
  domNode: HTMLDivElement
  component: ComponentType<RenderTooltipProps<TDataItem>>
  props: RenderTooltipProps<TDataItem>
}
