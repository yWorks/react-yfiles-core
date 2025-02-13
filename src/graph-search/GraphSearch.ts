import {
  Color,
  GraphComponent,
  HighlightIndicatorManager,
  IHighlightRenderer,
  IModelItem,
  INode,
  Insets,
  IObjectRenderer,
  IObservableCollection,
  NodeStyleIndicatorRenderer,
  Point,
  Rect,
  ShapeNodeStyle,
  Stroke,
  StyleIndicatorZoomPolicy
} from '@yfiles/yfiles'

export class GraphSearch<TNeedle> {
  graphComponent: GraphComponent
  searchHighlightIndicatorManager: SearchHighlightIndicatorManager
  matchingNodes: INode[] = []

  /**
   * Registers event listeners at the search box.
   *
   * The search result is updated on every key press and the 'ENTER' key zooms the viewport to the currently
   * matching nodes.
   *
   * @param searchBox The search box element.
   * @param graphSearch The GraphSearch instance.
   * @param autoCompleteSuggestions A list of possible auto-complete suggestion strings. If omitted, no auto-complete will be available
   */
  static registerEventListener(
    searchBox: HTMLElement,
    graphSearch: GraphSearch<string>,
    autoCompleteSuggestions?: string[]
  ): void {
    if (autoCompleteSuggestions && searchBox instanceof HTMLInputElement) {
      const datalist = document.createElement('datalist')
      datalist.id = searchBox.id + '-autocomplete'
      searchBox.setAttribute('list', datalist.id)
      if (searchBox.parentElement) {
        searchBox.parentElement.insertBefore(datalist, searchBox)
      }
      graphSearch.updateAutoCompleteSuggestions(searchBox, autoCompleteSuggestions)
    }

    searchBox.addEventListener('input', async e => {
      const input = e.target as HTMLInputElement
      const searchText = input.value
      graphSearch.updateSearch(searchText)

      // Zoom to search result if an element from the auto-completion list has been selected
      // How to detect this varies between browsers, sadly
      if (
        !(e instanceof InputEvent) /* Chrome */ ||
        e.inputType === 'insertReplacementText' /* Firefox */
      ) {
        // Determine whether we actually selected an element from the list
        if (hasSelectedElementFromDatalist(input, searchText)) {
          await graphSearch.zoomToSearchResult()
        }
      }
    })

    // adds the listener that will focus to the result of the search
    searchBox.addEventListener('keydown', async e => {
      if (e.key === 'Enter') {
        e.preventDefault()
        await graphSearch.zoomToSearchResult()
      }
    })

    // adds the listener to enable auto-completion
    searchBox.addEventListener('keyup', e => {
      if (e.key === 'Enter') {
        return
      }
    })
  }

  /**
   * Creates a new instance of this class with the default highlight style.
   *
   * @param graphComponent The graphComponent on which the search will be applied
   */
  constructor(graphComponent: GraphComponent) {
    this.graphComponent = graphComponent
    // initialize the default highlight style
    const highlightColor = Color.TOMATO
    this.searchHighlightIndicatorManager = this.searchHighlightIndicatorManager =
      new SearchHighlightIndicatorManager({
        nodeRenderer: new NodeStyleIndicatorRenderer({
          nodeStyle: new ShapeNodeStyle({
            stroke: new Stroke(highlightColor.r, highlightColor.g, highlightColor.b, 220, 3),
            fill: null
          }),
          margins: 3,
          zoomPolicy: StyleIndicatorZoomPolicy.MIXED
        }),
        domain: graphComponent.highlightIndicatorManager.domain
      })
    this.searchHighlightIndicatorManager.install(graphComponent)
  }

  /**
   * Gets the decoration style used for highlighting the matching nodes.
   */
  get highlightRenderer(): IHighlightRenderer {
    return this.searchHighlightIndicatorManager.nodeRenderer
  }

  /**
   * Sets the decoration style used for highlighting the matching nodes.
   * @param highlightRenderer The given highlight style.
   */
  set highlightStyle(highlightRenderer: IHighlightRenderer) {
    this.searchHighlightIndicatorManager.nodeRenderer = highlightRenderer
  }

  /**
   * Updates the search results for the given search query.
   * @param needle The data of the search query.
   */
  updateSearch(needle?: TNeedle): void {
    // we use the search highlight manager to highlight matching items
    const highlights = this.searchHighlightIndicatorManager.items

    // first remove previous highlights
    highlights.clear()
    this.matchingNodes = []

    if (typeof needle === 'string' && needle.trim() !== '') {
      this.graphComponent.graph.nodes
        .filter(node => this.matches(node, needle))
        .forEach(node => {
          highlights.add(node)
          this.matchingNodes.push(node)
        })
    }
  }

  /**
   * Updates the auto-complete list for the given search field with
   * the given new suggestions.
   *
   * This will do nothing, unless auto-complete has been configured with initial suggestions
   * in the {@link registerEventListener} call.
   *
   * @param input An HTML `input` element that is used as a search input.
   * @param autoCompleteSuggestions A list of possible auto-complete suggestion strings.
   */
  updateAutoCompleteSuggestions(input: HTMLInputElement, autoCompleteSuggestions: string[]) {
    const datalist = input.list
    if (!datalist) {
      return
    }
    while (datalist.lastChild) {
      datalist.lastChild.remove()
    }
    for (const item of autoCompleteSuggestions) {
      const option = document.createElement('option')
      option.value = item
      datalist.appendChild(option)
    }
  }

  /**
   * Zooms to the nodes that match the result of the current search.
   */
  zoomToSearchResult(): Promise<void> {
    if (this.matchingNodes.length === 0) {
      return Promise.resolve()
    }

    const maxRect = this.matchingNodes
      .map(node => node.layout.toRect())
      .reduce((prev, current) => Rect.add(prev, current))
    if (!maxRect.isFinite) {
      return Promise.resolve()
    }

    const rect = maxRect.getEnlarged(new Insets(20))
    const componentWidth = this.graphComponent.size.width
    const componentHeight = this.graphComponent.size.height
    const maxPossibleZoom = Math.min(componentWidth / rect.width, componentHeight / rect.height)
    const zoom = Math.min(maxPossibleZoom, 1.5)
    return this.graphComponent.zoomToAnimated(zoom, new Point(rect.centerX, rect.centerY))
  }

  /**
   * Specifies whether the given node is a match when searching for the given text.
   *
   * This implementation searches for the given string in the label text of the nodes.
   * Overwrite this method to implement custom matching rules.
   *
   * @param node The node to be examined.
   * @param needle The search data to be queried.
   * @returns True if the node matches the text, false otherwise
   */
  matches(node: INode, needle: TNeedle): boolean {
    return typeof needle === 'string'
      ? node.labels.some(label => label.text.toLowerCase().indexOf(needle.toLowerCase()) !== -1)
      : false
  }
}

function hasSelectedElementFromDatalist(input: HTMLInputElement, searchText: string) {
  if (input.list) {
    for (const option of Array.from(input.list.children)) {
      if (option instanceof HTMLOptionElement && option.value === searchText) {
        return true
      }
    }
  }
  return false
}

/**
 * A highlight indicator manager allows setting a specific renderer for the node highlights.
 */
class SearchHighlightIndicatorManager extends HighlightIndicatorManager<IModelItem> {
  public nodeRenderer: IHighlightRenderer

  constructor({
    nodeRenderer,
    domain
  }: {
    nodeRenderer: IHighlightRenderer
    domain: IObservableCollection<IModelItem>
  }) {
    super()

    this.nodeRenderer = nodeRenderer
    this.domain = domain
  }

  protected getRenderer(item: IModelItem): IObjectRenderer<IModelItem> | null {
    if (item instanceof INode) {
      return this.nodeRenderer
    }
    return super.getRenderer(item)
  }
}
