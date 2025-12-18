import React, {
  createContext,
  JSXElementConstructor,
  useContext,
  useLayoutEffect,
  useMemo
} from 'react'
import { GraphComponent, ScrollBarVisibility } from '@yfiles/yfiles'

const GraphComponentContext = createContext<GraphComponent | null>(null)

/**
 * A hook that returns the [yFiles GraphComponent]{@link http://docs.yworks.com/yfileshtml/#/api/GraphComponent}
 * that is used by the parent component to display the graph.
 * This hook provides the option to use the yFiles API for customizing graph layout, visualization, and interaction.
 * While it is highly versatile, proficiency is required for effective application.
 * @returns the GraphComponent used to display the graph.
 */
export function useGraphComponent() {
  const graphComponent = useContext(GraphComponentContext)
  if (!graphComponent) {
    throw new Error('GraphComponent is not available in this context.')
  }
  return graphComponent
}

/**
 * Creates a [yFiles GraphComponent]{@link http://docs.yworks.com/yfileshtml/#/api/GraphComponent} and wraps
 * the provided component in a provider that provides the created GraphComponent.
 */
export function withGraphComponentProvider<
  T extends keyof React.JSX.IntrinsicElements | JSXElementConstructor<any>
>(Component: T) {
  return (props: React.ComponentProps<T>) => {
    const graphComponent = useMemo(() => {
      const graphComponent = new GraphComponent()
      graphComponent.htmlElement.style.width = '100%'
      graphComponent.htmlElement.style.height = '100%'
      graphComponent.htmlElement.style.minWidth = '400px'
      graphComponent.htmlElement.style.minHeight = '400px'
      // scrollbar styling
      graphComponent.horizontalScrollBarPolicy = ScrollBarVisibility.AUTO
      graphComponent.verticalScrollBarPolicy = ScrollBarVisibility.AUTO
      return graphComponent
    }, [])

    return (
      <GraphComponentContext.Provider value={graphComponent}>
        <Component {...props} />
      </GraphComponentContext.Provider>
    )
  }
}

/**
 * A hook that adds the given [yFiles GraphComponent]{@link http://docs.yworks.com/yfileshtml/#/api/GraphComponent}
 * to a parent in useLayoutEffect().
 */
export function useAddGraphComponent(
  parentRef: React.RefObject<HTMLElement | null>,
  graphComponent: GraphComponent
) {
  useLayoutEffect(() => {
    if (parentRef.current) {
      const firstChild = parentRef.current.firstChild
      if (firstChild) {
        parentRef.current.insertBefore(graphComponent.htmlElement, firstChild)
      } else {
        parentRef.current.appendChild(graphComponent.htmlElement)
      }
    }
    return () => {
      if (parentRef.current) {
        parentRef.current.removeChild(graphComponent.htmlElement)
      }
    }
  }, [])
}
