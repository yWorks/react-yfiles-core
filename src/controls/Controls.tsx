import { ComponentType, createElement, JSX, PropsWithChildren } from 'react'
import './Controls.css'
import { DefaultRenderControls } from './DefaultRenderControls.tsx'
import { combineCssClasses } from '../utils/combine-css-classes.ts'
import { Position } from '../types/types.ts'

/**
 * A button in the {@link Controls} component.
 */
export interface ControlButton {
  /**
   * The function that is triggered when clicking the control button.
   */
  action: () => void
  /**
   * The url or element to be used as the button icon.
   */
  icon?: string | JSX.Element
  /**
   * The class name to style the control button.
   */
  className?: string
  /**
   * Whether the control button is active.
   */
  disabled?: boolean
  /**
   * The tooltip that is displayed when hovering the control button.
   */
  tooltip?: string
}

/**
 * The props for rendering the {@link Controls} component.
 */
export interface RenderControlsProps {
  /**
   * The buttons that are rendered by the {@link Controls} component.
   */
  buttons: ControlButton[]
  /**
   * The orientation of the {@link Controls} component.
   */
  orientation?: 'horizontal' | 'vertical'
  /**
   * The CSS class of the {@link Controls} component.
   */
  className?: string
  /**
   * The position of the {@link Controls} component.
   */
  position?: Position | 'custom'
}
/**
 * A function type specifying the buttons of the  {@link Controls} component.
 */
export type ControlsButtonProvider = () => ControlButton[]

/**
 * The props provided by the {@link Controls}.
 */
export interface ControlsProps {
  /**
   * A function specifying the buttons that are rendered by the {@link Controls} component.
   */
  buttons: ControlsButtonProvider
  /**
   * The orientation of the {@link Controls} component.
   */
  orientation?: 'horizontal' | 'vertical'
  /**
   * The CSS class of the {@link Controls} component.
   */
  className?: string
  /**
   * The position of the {@link Controls} component.
   */
  position?: Position | 'custom'
  /**
   * An optional component used for rendering a custom {@link Controls} component.
   */
  renderControls?: ComponentType<RenderControlsProps>
}

/**
 * The Controls component renders buttons that perform actions on the graph.
 * This component must be used inside a parent component that displays the graph, or its corresponding provider.
 *
 * ```tsx
 * function OrganizationChart() {
 *   const button1 = { action: () => alert('Button 1 clicked!'), icon: <div>Button 1</div> }
 *   const button2 = { action: () => alert('Button 2 clicked!'), icon: <div>Button 2</div> }
 *   return (
 *     <OrgChart data={data}>
 *       <Controls buttons={() => [button1, button2]}></Controls>
 *     </OrgChart>
 *   )
 * }
 * ```
 */
export function Controls({
  buttons,
  orientation = 'vertical',
  position = 'top-right',
  className,
  renderControls = DefaultRenderControls
}: ControlsProps & PropsWithChildren) {
  const toolbar = createElement(renderControls, {
    buttons: buttons(),
    orientation: orientation,
    position
  })
  const classes = [className, 'yfiles-react-controls', `yfiles-react-controls--${orientation}`]
  if (position !== 'custom') {
    classes.push(`yfiles-react-controls__positioned--${position}`)
    classes.push('yfiles-react-controls__positioned')
  }

  const toolbarClassList = combineCssClasses(classes)
  return (
    <div className="yfiles-react-controls__toolbar-container">
      {toolbar && <div className={toolbarClassList}>{toolbar}</div>}
    </div>
  )
}
