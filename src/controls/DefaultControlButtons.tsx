import { ControlButton } from './Controls.tsx'
import { useGraphComponent } from '../graph-component/GraphComponentProvider.tsx'
import { Command } from '@yfiles/yfiles'

/**
 * A function returning the default control buttons to be used in {@link ControlsProps.buttons}.
 */
export function DefaultControlButtons(): ControlButton[] {
  const graphComponent = useGraphComponent()!

  if (!graphComponent) {
    return []
  }

  const items: ControlButton[] = []
  items.push({
    action: () => graphComponent.executeCommand(Command.INCREASE_ZOOM, null),
    className: 'yfiles-react-controls__button--zoom-in',
    tooltip: 'Increase zoom'
  })
  items.push({
    action: () => graphComponent.executeCommand(Command.ZOOM, 1.0),
    className: 'yfiles-react-controls__button--zoom-original',
    tooltip: 'Zoom to original size'
  })
  items.push({
    action: () => graphComponent.executeCommand(Command.DECREASE_ZOOM, null),
    className: 'yfiles-react-controls__button--zoom-out',
    tooltip: 'Decrease zoom'
  })
  items.push({
    action: () => graphComponent.executeCommand(Command.FIT_GRAPH_BOUNDS, null),
    className: 'yfiles-react-controls__button--zoom-fit',
    tooltip: 'Fit content'
  })
  return items
}
