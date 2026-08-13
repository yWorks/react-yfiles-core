import type { RenderPopupProps } from './Popup.tsx'
import type { ReactNode } from 'react'

export function DefaultRenderPopup({ item }: RenderPopupProps<{ id: string }>): ReactNode | null {
  return item ? <div className={'yfiles-react-popup__content'}>{item.id}</div> : null
}
