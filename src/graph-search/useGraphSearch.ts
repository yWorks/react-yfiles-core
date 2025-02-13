import { GraphSearch } from './GraphSearch'
import { GraphComponent, INode } from '@yfiles/yfiles'
import { useCallback, useEffect, useMemo } from 'react'

export function useGraphSearch<TDataItem, TNeedle>(
  graphComponent: GraphComponent,
  searchQuery?: TNeedle,
  onSearch?: (item: TDataItem, needle: TNeedle) => boolean
) {
  const graphSearch = useMemo(() => new NodeTagSearch(graphComponent, onSearch), [graphComponent])

  useEffect(() => {
    graphSearch.onSearch = onSearch
    updateSearch()
  }, [onSearch])

  const updateSearch = useCallback(() => {
    graphSearch.updateSearch(searchQuery)
  }, [searchQuery, graphSearch])

  useEffect(() => {
    graphComponent.graph.addEventListener('node-created', updateSearch)
    graphComponent.graph.addEventListener('node-removed', updateSearch)
    return () => {
      graphComponent.graph.removeEventListener('node-created', updateSearch)
      graphComponent.graph.removeEventListener('node-removed', updateSearch)
    }
  }, [graphComponent, searchQuery, updateSearch])

  useEffect(() => {
    updateSearch()
  }, [searchQuery, updateSearch])

  return graphSearch
}

class NodeTagSearch<TDataItem, TNeedle> extends GraphSearch<TNeedle> {
  constructor(
    graphComponent: GraphComponent,
    public onSearch?: (item: TDataItem, needle: TNeedle) => boolean
  ) {
    super(graphComponent)
  }
  matches(node: INode, needle: TNeedle): boolean {
    if (node.tag) {
      const data = node.tag
      if (this.onSearch) {
        return this.onSearch(data, needle)
      }
      return (
        typeof needle === 'string' &&
        Object.keys(data).some(key => {
          const value = data[key]
          if (typeof value === 'string') {
            return value.toLowerCase().indexOf(needle.toLowerCase()) !== -1
          }
          return false
        })
      )
    }
    return false
  }
}
