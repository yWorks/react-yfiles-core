import {
  ComponentType,
  createElement,
  PropsWithChildren,
  RefObject,
  useEffect,
  useRef,
  useState
} from 'react'
import { useGraphComponent } from '../graph-component/GraphComponentProvider.tsx'
import {
  EdgePathLabelModel,
  ExteriorLabelModel,
  ExteriorLabelModelPosition,
  GraphComponent,
  GraphInputMode,
  GraphItemTypes,
  IEdge,
  ILabelOwner,
  IModelItem,
  INode,
  ItemClickedEventArgs,
  ItemTappedEventArgs,
  Point,
  SimpleLabel,
  Size
} from 'yfiles'
import { DefaultRenderPopup } from './DefaultRenderPopup.tsx'

import './Popup.css'

/**
 * The props for rendering the popup.
 */
export interface RenderPopupProps<TDataItem> {
  /**
   * The data item for which the popup was opened.
   */
  item: TDataItem
  /**
   * A function that closes the popup.
   */
  onClose: Function
}

/**
 * The props provided by the popup.
 */
export interface PopupProps<TDataItem> {
  /**
   * The position of the popup.
   */
  position?:
    | 'east'
    | 'north'
    | 'north-east'
    | 'north-west'
    | 'south'
    | 'south-east'
    | 'south-west'
    | 'west'
  /**
   * An optional custom that renders a custom popup.
   */
  renderPopup?: ComponentType<RenderPopupProps<TDataItem>>

  /**
   * Determines after which input event the pop-up appears:
   * single-click or double-click on the left mouse button, as well as
   * single-tap or double-tap on a touch device
   *
   * The default is single-click.
   */
  clickMode?: 'single' | 'double'
}

/**
 * The Popup component adds a popup to the graph items, i.e., items and connections. It is designed to be used inside a
 * parent component that displays the graph.
 */
export function Popup<TDataItem>({
  renderPopup,
  position,
  clickMode
}: PopupProps<TDataItem> & PropsWithChildren) {
  const graphComponent = useGraphComponent()!
  const [location, setLocation] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [currentItem, setCurrentItem] = useState<IModelItem | null>(null)
  const popupContainerRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // needed to run the updateLocation twice the first time that the popup appears to make sure
    // that the content is already in the dom, and it has the correct width and height
    setMounted(!!currentItem)
  }, [currentItem])

  useEffect(() => {
    updateLocation(graphComponent, currentItem, popupContainerRef, position)
  }, [currentItem, graphComponent, mounted, position])

  /**
   * Registers the popup listeners.
   */
  useEffect(() => {
    const inputMode = graphComponent.inputMode as GraphInputMode
    inputMode.focusableItems = GraphItemTypes.NODE | GraphItemTypes.EDGE

    const canvasClickedListener = () => {
      setCurrentItem(null)
    }
    inputMode.addCanvasClickedListener(canvasClickedListener)

    const itemClickedListener = (_: GraphInputMode, evt: ItemClickedEventArgs<IModelItem>) => {
      setCurrentItem(evt.item instanceof INode || evt.item instanceof IEdge ? evt.item : null)
    }
    const itemTappedListener = (_: GraphInputMode, evt: ItemTappedEventArgs<IModelItem>) => {
      setCurrentItem(evt.item instanceof INode || evt.item instanceof IEdge ? evt.item : null)
    }

    switch (clickMode) {
      case 'double':
        inputMode.addItemLeftDoubleClickedListener(itemClickedListener)
        inputMode.addItemDoubleTappedListener(itemTappedListener)
        break
      case 'single':
      default:
        inputMode.addItemLeftClickedListener(itemClickedListener)
        inputMode.addItemTappedListener(itemTappedListener)
        break
    }

    return () => {
      // clean up
      inputMode.removeCanvasClickedListener(canvasClickedListener)

      switch (clickMode) {
        case 'double':
          inputMode.removeItemLeftDoubleClickedListener(itemClickedListener)
          inputMode.removeItemDoubleTappedListener(itemTappedListener)
          break
        case 'single':
        default:
          inputMode.removeItemLeftClickedListener(itemClickedListener)
          inputMode.removeItemTappedListener(itemTappedListener)
          break
      }
    }
  }, [graphComponent])
  const template = renderPopup ?? (DefaultRenderPopup as ComponentType<RenderPopupProps<TDataItem>>)
  const popup = currentItem
    ? createElement(template, {
        item: currentItem?.tag,
        onClose: () => {
          setCurrentItem(null)
        }
      })
    : null
  return (
    <>
      {popup && (
        <div
          className="yfiles-react-popup"
          style={{
            position: 'absolute',
            left: location.x,
            top: location.y
          }}
          ref={popupContainerRef}
        >
          {popup}
        </div>
      )}
    </>
  )

  /**
   * Updates the location of the popup based on the given position.
   */
  function updateLocation(
    graphComponent: GraphComponent,
    item: IModelItem | null,
    popupContainer: RefObject<HTMLDivElement>,
    position?:
      | 'east'
      | 'north'
      | 'north-east'
      | 'north-west'
      | 'south'
      | 'south-east'
      | 'south-west'
      | 'west'
  ) {
    if (!popupContainer.current || !item) {
      return
    }
    const { width, height } = popupContainer.current.getBoundingClientRect()

    const labelModelPosition = convertToLabelModelParameter(position)
    const labelModelParameter =
      item instanceof INode
        ? new ExteriorLabelModel().createParameter(labelModelPosition)
        : new EdgePathLabelModel({ autoRotation: false }).createDefaultParameter()
    const dummyLabel = new SimpleLabel(item as unknown as ILabelOwner, '', labelModelParameter)

    const zoom = graphComponent.zoom
    if (labelModelParameter.supports(dummyLabel) && width >= 0 && height >= 0) {
      dummyLabel.preferredSize = new Size(width / zoom, height / zoom)
      const newLayout = labelModelParameter.model.getGeometry(dummyLabel, labelModelParameter)
      const location = graphComponent.toViewCoordinates(
        new Point(newLayout.anchorX, newLayout.anchorY - (height + 10) / zoom)
      )
      setLocation(location)
    }
  }
}

/**
 * Converts the given position to a yFiles node label model.
 */
function convertToLabelModelParameter(
  position?:
    | 'east'
    | 'north'
    | 'north-east'
    | 'north-west'
    | 'south'
    | 'south-east'
    | 'south-west'
    | 'west'
) {
  switch (position) {
    default:
    case 'north':
      return ExteriorLabelModelPosition.NORTH
    case 'east':
      return ExteriorLabelModelPosition.EAST
    case 'west':
      return ExteriorLabelModelPosition.WEST
    case 'south':
      return ExteriorLabelModelPosition.SOUTH
    case 'north-east':
      return ExteriorLabelModelPosition.NORTH_EAST
    case 'north-west':
      return ExteriorLabelModelPosition.NORTH_WEST
    case 'south-east':
      return ExteriorLabelModelPosition.SOUTH_EAST
    case 'south-west':
      return ExteriorLabelModelPosition.WEST
  }
}
