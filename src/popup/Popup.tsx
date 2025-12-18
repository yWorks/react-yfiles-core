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
  ExteriorNodeLabelModel,
  ExteriorNodeLabelModelPosition,
  GraphComponent,
  GraphInputMode,
  GraphItemTypes,
  IEdge,
  ILabelOwner,
  IModelItem,
  INode,
  ItemClickedEventArgs,
  Point,
  PointerButtons,
  PointerType,
  SimpleLabel,
  Size
} from '@yfiles/yfiles'
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
    | 'right'
    | 'top'
    | 'top-right'
    | 'top-left'
    | 'bottom'
    | 'bottom-right'
    | 'bottom-left'
    | 'left'
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

  /**
   * Optional global props that get passed to the popup component
   */
  extraProps?: Record<string, any>
}

/**
 * The Popup component adds a popup to the graph items, i.e., items and connections. It is designed to be used inside a
 * parent component that displays the graph.
 */
export function Popup<TDataItem>({
  renderPopup,
  position,
  clickMode,
  extraProps
}: PopupProps<TDataItem> & PropsWithChildren) {
  const graphComponent = useGraphComponent()!
  const [location, setLocation] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [currentItem, setCurrentItem] = useState<IModelItem | null>(null)
  const [visibility, setVisibility] = useState(false)
  const popupContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setVisibility(false)
    updateLocation(graphComponent, currentItem, popupContainerRef, position)
  }, [currentItem, graphComponent, position])

  /**
   * Registers the popup listeners.
   */
  useEffect(() => {
    const inputMode = graphComponent.inputMode as GraphInputMode
    inputMode.focusableItems = GraphItemTypes.NODE | GraphItemTypes.EDGE

    const canvasClickedListener = () => {
      setCurrentItem(null)
    }
    inputMode.addEventListener('canvas-clicked', canvasClickedListener)

    const viewportChangedListener = () => {
      updateLocation(graphComponent, graphComponent.currentItem, popupContainerRef, position)
    }
    graphComponent.addEventListener('viewport-changed', viewportChangedListener)

    const itemClickedListener = (evt: ItemClickedEventArgs<IModelItem>) => {
      if (
        evt.pointerType === PointerType.TOUCH ||
        (evt.pointerButtons & PointerButtons.MOUSE_LEFT) === PointerButtons.MOUSE_LEFT ||
        (evt.pointerButtons & PointerButtons.PEN_CONTACT) === PointerButtons.PEN_CONTACT
      ) {
        setCurrentItem(evt.item instanceof INode || evt.item instanceof IEdge ? evt.item : null)
      }
    }

    switch (clickMode) {
      case 'double':
        inputMode.addEventListener('item-double-clicked', itemClickedListener)
        break
      case 'single':
      default:
        inputMode.addEventListener('item-clicked', itemClickedListener)
        break
    }

    return () => {
      // clean up
      inputMode.removeEventListener('canvas-clicked', canvasClickedListener)
      graphComponent.removeEventListener('viewport-changed', viewportChangedListener)

      switch (clickMode) {
        case 'double':
          inputMode.removeEventListener('item-double-clicked', itemClickedListener)
          break
        case 'single':
        default:
          inputMode.removeEventListener('item-clicked', itemClickedListener)
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
        },
        ...extraProps
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
            top: location.y,
            visibility: visibility ? 'visible' : 'hidden'
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
    popupContainer: RefObject<HTMLDivElement | null>,
    position?:
      | 'right'
      | 'top'
      | 'top-right'
      | 'top-left'
      | 'bottom'
      | 'bottom-right'
      | 'bottom-left'
      | 'left'
  ) {
    if (!popupContainer.current || !item) {
      return
    }
    const { width, height } = popupContainer.current.getBoundingClientRect()

    const labelModelPosition = convertToLabelModelParameter(position)
    const labelModelParameter =
      item instanceof INode
        ? new ExteriorNodeLabelModel().createParameter(labelModelPosition)
        : new EdgePathLabelModel({ autoRotation: false }).createRatioParameter()
    const dummyLabel = new SimpleLabel(item as unknown as ILabelOwner, '', labelModelParameter)

    const zoom = graphComponent.zoom
    if (width >= 0 && height >= 0) {
      dummyLabel.preferredSize = new Size(width / zoom, height / zoom)
      const newLayout = labelModelParameter.model.getGeometry(dummyLabel, labelModelParameter)
      const location = graphComponent.worldToViewCoordinates(
        new Point(newLayout.anchorX, newLayout.anchorY - (height + 10) / zoom)
      )
      setLocation(location)
      setVisibility(true)
    }
  }
}

/**
 * Converts the given position to a yFiles node label model.
 */
function convertToLabelModelParameter(
  position?:
    | 'right'
    | 'top'
    | 'top-right'
    | 'top-left'
    | 'bottom'
    | 'bottom-right'
    | 'bottom-left'
    | 'left'
) {
  switch (position) {
    default:
    case 'top':
      return ExteriorNodeLabelModelPosition.TOP
    case 'right':
      return ExteriorNodeLabelModelPosition.RIGHT
    case 'left':
      return ExteriorNodeLabelModelPosition.LEFT
    case 'bottom':
      return ExteriorNodeLabelModelPosition.BOTTOM
    case 'top-right':
      return ExteriorNodeLabelModelPosition.TOP_RIGHT
    case 'top-left':
      return ExteriorNodeLabelModelPosition.TOP_LEFT
    case 'bottom-right':
      return ExteriorNodeLabelModelPosition.BOTTOM_RIGHT
    case 'bottom-left':
      return ExteriorNodeLabelModelPosition.BOTTOM_LEFT
  }
}
