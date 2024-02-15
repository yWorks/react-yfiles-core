import { ControlButton } from './Controls.tsx'
import { useGraphComponent } from '../graph-component/GraphComponentProvider.tsx'
import { ICommand } from 'yfiles'

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
    action: () => ICommand.INCREASE_ZOOM.execute(null, graphComponent),
    className: 'yfiles-react-controls__button--zoom-in',
    tooltip: 'Increase zoom'
  })
  items.push({
    action: () => ICommand.ZOOM.execute(1.0, graphComponent),
    className: 'yfiles-react-controls__button--zoom-original',
    tooltip: 'Zoom to original size'
  })
  items.push({
    action: () => ICommand.DECREASE_ZOOM.execute(null, graphComponent),
    className: 'yfiles-react-controls__button--zoom-out',
    tooltip: 'Decrease zoom'
  })
  items.push({
    action: () => ICommand.FIT_GRAPH_BOUNDS.execute(null, graphComponent),
    className: 'yfiles-react-controls__button--zoom-fit',
    tooltip: 'Fit content'
  })
  return items
}
