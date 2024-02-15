import { RenderPopupProps } from './Popup.tsx'
import { ReactNode } from 'react'

export function DefaultRenderPopup({ item }: RenderPopupProps<{ id: string }>): ReactNode | null {
  return item ? <div className={'yfiles-react-popup__content'}>{item.id}</div> : null
}
