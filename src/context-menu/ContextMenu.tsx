import {
  ComponentType,
  createElement,
  PropsWithChildren,
  useCallback,
  useLayoutEffect,
  useState
} from 'react'
import {
  GraphComponent,
  GraphViewerInputMode,
  IModelItem,
  Point,
  PopulateItemContextMenuEventArgs,
  TouchEventArgs
} from 'yfiles'
import { useGraphComponent } from '../graph-component/GraphComponentProvider.tsx'
import { BrowserDetection } from '../utils/BrowserDetection.ts'
import './ContextMenu.css'
import { DefaultRenderMenu } from './DefaultRenderMenu.tsx'

/**
 * A callback type representing an action to be performed when a context menu item is clicked.
 */
export type ContextMenuItemAction<TDataItem> = (item: TDataItem | null) => void

/**
 * An entry in the context menu.
 */
export interface ContextMenuItem<TDataItem> {
  /**
   * The displayed text on the context menu item.
   */
  title: string
  /**
   * The function that is triggered when clicking the context menu item.
   */
  action: ContextMenuItemAction<TDataItem>
}

/**
 * The props for rendering the context menu.
 */
export interface RenderContextMenuProps<TDataItem> {
  /**
   * The data item for which the context menu was opened, or null.
   */
  item: TDataItem | null
  /**
   * The menu items to be rendered.
   */
  menuItems: ContextMenuItem<TDataItem>[]
  /**
   * A function that closes the context menu.
   */
  onClose: Function
}
/**
 * A function type specifying the context menu items for a data item.
 */
export type ContextMenuItemProvider<TDataItem> = (
  item: TDataItem | null
) => ContextMenuItem<TDataItem>[]

/**
 * The props provided by the context menu.
 */
export interface ContextMenuProps<TDataItem> {
  /**
   * A function specifying the context menu items for a data item.
   */
  menuItems?: ContextMenuItemProvider<TDataItem>
  /**
   * An optional component used for rendering a custom context menu.
   */
  renderMenu?: ComponentType<RenderContextMenuProps<TDataItem>>
  /**
   * Optional global props that get passed to the context-menu component
   */
  extraProps?: Record<string, any>
}

/**
 * The ContextMenu component adds a context menu to the graph items. It is designed to be used inside a
 * parent component that displays the graph.
 */
export function ContextMenu<TDataItem>({
  menuItems,
  renderMenu,
  extraProps
}: ContextMenuProps<TDataItem> & PropsWithChildren) {
  const [menuVisible, setMenuVisible] = useState(false)
  const [menuLocation, setMenuLocation] = useState({ x: 0, y: 0 })
  const [dataItem, setDataItem] = useState<TDataItem | null>(null)

  const graphComponent = useGraphComponent()!

  const openContextMenu = useCallback(
    (worldLocation: Point) => {
      const showMenu = (
        graphComponent.inputMode as GraphViewerInputMode
      ).contextMenuInputMode.shouldOpenMenu(worldLocation)
      if (showMenu) {
        setMenuVisible(true)
        setMenuLocation(graphComponent.toViewCoordinates(worldLocation))
      }
    },
    [graphComponent]
  )

  const populateContextMenu = useCallback(
    (args: PopulateItemContextMenuEventArgs<IModelItem>) => {
      const modelItem = args.item
      graphComponent.currentItem = modelItem
      const dataItem = modelItem?.tag as TDataItem
      setDataItem(dataItem)
      args.showMenu = true
    },
    [graphComponent]
  )

  /**
   * Registers the context menu listeners.
   */
  useLayoutEffect(() => {
    const componentDiv = graphComponent.div
    const contextMenuListener = (evt: MouseEvent) => {
      evt.preventDefault()
      openContextMenu(graphComponent.toWorldFromPage({ x: evt.pageX, y: evt.pageY }))
    }

    // Listen for the contextmenu event
    // Note: On Linux based systems (e.g. Ubuntu), the contextmenu event is fired on mouse down
    // which triggers the ContextMenuInputMode before the ClickInputMode. Therefore, handling the
    // event, will prevent the ItemRightClicked event from firing.
    // For more information, see https://docs.yworks.com/yfileshtml/#/kb/article/780/
    componentDiv.addEventListener('contextmenu', contextMenuListener, false)

    let touchDownListener: (_: GraphComponent, evt: TouchEventArgs) => void | null
    let touchUpListener: (_: GraphComponent, evt: TouchEventArgs) => void | null
    if (BrowserDetection.safariVersion > 0 || BrowserDetection.iOSVersion > 0) {
      // Additionally add a long press listener especially for iOS, since it does not fire the contextmenu event.
      let contextMenuTimer: ReturnType<typeof setTimeout> | undefined
      touchDownListener = (_: GraphComponent, evt: TouchEventArgs) => {
        contextMenuTimer = setTimeout(() => {
          openContextMenu(evt.location)
        }, 500)
      }
      graphComponent.addTouchDownListener(touchDownListener)
      touchUpListener = () => {
        clearTimeout(contextMenuTimer!)
      }
      graphComponent.addTouchUpListener(touchUpListener)
    }

    // Listen to the context menu key to make it work in Chrome
    const contextMenuKeyListener = (evt: KeyboardEvent) => {
      if (evt.key === 'ContextMenu') {
        evt.preventDefault()
        openContextMenu(graphComponent.toWorldFromPage(getCenterInPage(componentDiv)))
      }
    }
    componentDiv.addEventListener('keyup', contextMenuKeyListener)

    // register the close listener
    const closeMenuListener = () => {
      setMenuVisible(false)
    }
    const inputMode = graphComponent.inputMode as GraphViewerInputMode
    inputMode.contextMenuInputMode.addCloseMenuListener(closeMenuListener)

    // register populate items listener
    const populateContextMenuListener = (
      _: GraphViewerInputMode,
      args: PopulateItemContextMenuEventArgs<IModelItem>
    ) => {
      // select the item
      if (args.item) {
        graphComponent.selection.clear()
        graphComponent.selection.setSelected(args.item, true)
      }
      // populate the menu
      populateContextMenu(args)
    }
    inputMode.addPopulateItemContextMenuListener(populateContextMenuListener)

    return () => {
      // cleanup
      componentDiv.removeEventListener('contextmenu', contextMenuListener)
      componentDiv.removeEventListener('keyup', contextMenuKeyListener)
      inputMode.contextMenuInputMode.removeCloseMenuListener(closeMenuListener)
      inputMode.removePopulateItemContextMenuListener(populateContextMenuListener)
      touchDownListener && graphComponent.removeTouchDownListener(touchDownListener)
      touchUpListener && graphComponent.removeTouchUpListener(touchUpListener)
    }
  }, [graphComponent, openContextMenu, populateContextMenu])

  return (
    <>
      {menuVisible && (
        <ContextMenuCore
          dataItem={dataItem}
          menuItems={menuItems}
          menuLocation={menuLocation}
          onClose={() => {
            setMenuVisible(false)
          }}
          renderMenu={renderMenu}
          extraProps={extraProps}
        ></ContextMenuCore>
      )}
    </>
  )
}

/**
 * This component is needed because renderMenu should only be executed if the menu is visible.
 */
function ContextMenuCore<TDataItem>({
  dataItem,
  menuItems,
  menuLocation,
  onClose,
  renderMenu = DefaultRenderMenu,
  extraProps
}: ContextMenuProps<TDataItem> & {
  dataItem: TDataItem | null
  onClose: Function
  menuLocation: { x: number; y: number }
}) {
  const menu = createElement(renderMenu, {
    menuItems: menuItems ? menuItems(dataItem) : [],
    item: dataItem,
    onClose: onClose,
    ...extraProps
  })
  return (
    menu && (
      <div
        style={{
          position: 'absolute',
          left: menuLocation.x,
          top: menuLocation.y
        }}
        className={'yfiles-react-context-menu'}
      >
        {menu}
      </div>
    )
  )
}

/**
 * Helper function to determine the page's center location.
 */
function getCenterInPage(element: HTMLElement): { x: number; y: number } {
  let left = element.clientWidth / 2.0
  let top = element.clientHeight / 2.0
  while (element.offsetParent) {
    left += element.offsetLeft
    top += element.offsetTop
    element = element.offsetParent as HTMLElement
  }
  return { x: left, y: top }
}
