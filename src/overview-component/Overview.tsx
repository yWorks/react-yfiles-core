import { useEffect, useRef } from 'react'
import { GraphOverviewComponent } from 'yfiles'
import './Overview.css'
import { useGraphComponent } from '../graph-component/GraphComponentProvider.tsx'
import { combineCssClasses } from '../utils/combine-css-classes.ts'
import { Position } from '../types/types.ts'

/**
 * The props for the {@link Overview} component.
 */
export interface OverviewProps {
  /**
   * The {@link Overview} title.
   */
  title?: string
  /**
   * An optional CSS class to be used by the {@link Overview} component.
   */
  className?: string

  /**
   * The position of the {@link Overview} component.
   * When position is set to 'custom', the overview can be placed using a CSS-class.
   */
  position?: Position | 'custom'
}

/**
 * The Overview component provides an overview of the graph displayed by its parent component.
 * This component has to be used inside a parent component that displays the graph, or its corresponding provider.
 *
 * ```tsx
 * function App() {
 *   return (
 *     <MyReactYFilesComponent data={data}>
 *       <Overview></Overview>
 *     </MyReactYFilesComponent>
 *   )
 * }
 * ```
 */
export function Overview({ title = 'Overview', className, position = 'top-left' }: OverviewProps) {
  const graphComponent = useGraphComponent()
  const overviewContainer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (overviewContainer.current && graphComponent) {
      const overview = new GraphOverviewComponent(overviewContainer.current, graphComponent)
      return () => {
        overview.cleanUp()
      }
    }
  }, [])

  const classes = [className, 'yfiles-react-overview']
  if (position !== 'custom') {
    classes.push(`yfiles-react-overview__positioned--${position}`)
    classes.push('yfiles-react-overview__positioned')
  }
  const overviewClassList = combineCssClasses(classes)
  return (
    <div className={overviewClassList}>
      <div className="yfiles-react-overview__title">{title}</div>
      <div className="yfiles-react-overview__graph-component" ref={overviewContainer} />
    </div>
  )
}
