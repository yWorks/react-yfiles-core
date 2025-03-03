import {
  ComponentType,
  createElement,
  PropsWithChildren,
  useCallback,
  useLayoutEffect,
  useState
} from 'react'
import { GraphViewerInputMode, IModelItem, PopulateItemContextMenuEventArgs } from '@yfiles/yfiles'
import { useGraphComponent } from '../graph-component/GraphComponentProvider.tsx'
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
    // register the close listener
    const closeMenuListener = () => {
      setMenuVisible(false)
    }
    const inputMode = graphComponent.inputMode as GraphViewerInputMode
    inputMode.contextMenuInputMode.addEventListener('menu-closed', closeMenuListener)

    // register populate items listener
    const populateContextMenuListener = (event: PopulateItemContextMenuEventArgs<IModelItem>) => {
      // select the item
      if (event.item) {
        graphComponent.selection.clear()
        graphComponent.selection.add(event.item)
      }
      setMenuVisible(true)
      setMenuLocation(graphComponent.worldToViewCoordinates(event.queryLocation))
      // populate the menu
      populateContextMenu(event)
    }
    inputMode.addEventListener('populate-item-context-menu', populateContextMenuListener)

    return () => {
      // cleanup
      inputMode.contextMenuInputMode.removeEventListener('menu-closed', closeMenuListener)
      inputMode.removeEventListener('populate-item-context-menu', populateContextMenuListener)
    }
  }, [graphComponent, populateContextMenu])

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
