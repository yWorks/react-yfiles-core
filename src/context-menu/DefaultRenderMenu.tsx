import { ReactNode } from 'react'
import { ContextMenuItem } from './ContextMenu.tsx'

/**
 * The default rendering for the context menu component.
 */
export function DefaultRenderMenu<TDataItem>({
  item,
  menuItems,
  onClose
}: {
  item: TDataItem | null
  menuItems: ContextMenuItem<TDataItem>[]
  onClose: Function
}): ReactNode | null {
  return menuItems.length > 0
    ? menuItems.map((menuItem, i) => {
        return (
          <button
            onClick={() => {
              onClose()
              menuItem.action(item)
            }}
            key={i}
            className={'yfiles-react-context-menu__item'}
          >
            {menuItem.title}
          </button>
        )
      })
    : null
}
