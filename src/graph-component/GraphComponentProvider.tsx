import React, {
  createContext,
  JSXElementConstructor,
  useContext,
  useLayoutEffect,
  useMemo
} from 'react'
import { GraphComponent, ScrollBarVisibility } from 'yfiles'

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
  T extends keyof JSX.IntrinsicElements | JSXElementConstructor<any>
>(Component: T) {
  return (props: React.ComponentProps<T>) => {
    const graphComponent = useMemo(() => {
      const graphComponent = new GraphComponent()
      graphComponent.div.style.width = '100%'
      graphComponent.div.style.height = '100%'
      graphComponent.div.style.minWidth = '400px'
      graphComponent.div.style.minHeight = '400px'
      // scrollbar styling
      graphComponent.horizontalScrollBarPolicy = ScrollBarVisibility.AS_NEEDED_DYNAMIC
      graphComponent.verticalScrollBarPolicy = ScrollBarVisibility.AS_NEEDED_DYNAMIC
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
  parentRef: React.RefObject<HTMLElement>,
  graphComponent: GraphComponent
) {
  useLayoutEffect(() => {
    if (parentRef.current) {
      const firstChild = parentRef.current.firstChild
      if (firstChild) {
        parentRef.current.insertBefore(graphComponent.div, firstChild)
      } else {
        parentRef.current.appendChild(graphComponent.div)
      }
    }
    return () => {
      if (parentRef.current) {
        parentRef.current.removeChild(graphComponent.div)
      }
    }
  }, [])
}
