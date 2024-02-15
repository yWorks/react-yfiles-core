import { ComponentType, useRef } from 'react'
import { useAddGraphComponent, useGraphComponent } from '../index.ts'
import './GraphComponentStyles.css'

export function withGraphComponent(Component: ComponentType<any>) {
  return (props: any) => {
    const graphComponent = useGraphComponent()!

    const gcContainer = useRef<HTMLDivElement>(null)
    if (graphComponent) {
      useAddGraphComponent(gcContainer, graphComponent)
    }

    return (
      <>
        <div
          ref={gcContainer}
          className={props.className ?? 'yfiles-react-graph-component-container'}
          style={props.style}
        >
          <Component {...props}></Component>
        </div>
      </>
    )
  }
}
