import {
  Cursor,
  delegate,
  FoldingManager,
  GraphBuilder,
  GraphComponent,
  GraphHighlightIndicatorManager,
  type GraphInputMode,
  GraphViewerInputMode,
  type IGraph,
  type IModelItem,
  INode,
  ItemHoverInputMode,
  List,
  type MouseEventArgs,
  MouseWheelBehaviors,
  Point,
  Rect,
  ScrollBarVisibility,
  ShapeNodeStyle,
  Size,
  type SizeChangedEventArgs,
  GraphItemTypes
} from 'yfiles'
import { TimeframeRectangle } from './TimeframeRectangle'
import { defaultStyling, Styling, type TimelineStyle } from './Styling'
import { AggregationFolderNodeConverter } from './AggregationFolderNodeConverter'
import { days, intervalsIntersect, months, timeframeEquals, weeks, years } from './Utilities'
import { TimeframeAnimation } from './TimeframeAnimation'
import { aggregateBuckets, type Bucket, getBucket, getItemsFromBucket } from './bucket-aggregation'
import { applyTimelineLayout } from './timeline-layout'
import { TimelineDispatch } from '../TimelineState'
import { TimelineTooltipProps } from '../TimelineTooltip'

/**
 * A time entry specifies the time range or points in time when the corresponding data item should be visible.
 */
export type TimeRange =
  | {
      start?: number
      end?: number
    }
  | {
      start?: number
      end?: number
    }[]
  | number[]

export type DataItemFilter<TDataItem> = (item: TDataItem) => boolean

export type FilterChangedListener<TDataItem> = (filter: DataItemFilter<TDataItem>) => void
export type BarSelectListener<TDataItem> = (items: TDataItem[]) => void
export type BarHoverListener<TDataItem> = (items: TDataItem[]) => void

export type TimeInterval = [start: Date, end: Date]
export type LabeledTimeInterval = [start: Date, end: Date, label: string]

const UNDEFINED_TIMEFRAME = [new Date(0), new Date(0)] as TimeInterval

/**
 * A timeline component that shows data entries in a bar-chart like visualization.
 *
 * The timeline utilizes a GraphComponent to visualize the bar chart with the help of a folded graph.
 * The folding is mapped to the granularity of the timeline so that collapse/expand automatically hides/shows items
 * corresponding to the current level.
 * Entries in the timeline are modelled as INodes and automatically placed with the help of a RecursiveGroupLayout.
 *
 * Zooming in-/out of the timeline collapses and expands group nodes to show the nested data.
 */
export default class TimelineEngine<TDataItem> {
  private readonly graphComponent: GraphComponent
  private _items: TDataItem[] = []

  // [minZoom, maxZoom)
  private readonly minZoom = 1
  private readonly maxZoom = 4
  private zoom = 0

  // NOTE: this granularity is assumed in the tooltip generation, so changing it also needs tooltip adjustments
  private readonly granularities: ((start: Date, end: Date) => Iterable<LabeledTimeInterval>)[] = [
    days,
    weeks,
    months,
    years
    /* allTime */
  ]

  private filterChangedListener: FilterChangedListener<TDataItem> | null = null
  private barSelectListener: BarSelectListener<TDataItem> | null = null
  private barHoverListener: BarHoverListener<TDataItem> | null = null
  private animationEndListener: (() => void) | null = null

  private graphBuilder!: GraphBuilder
  private buckets: List<Bucket<TDataItem>> = new List<Bucket<TDataItem>>()

  private timeframeRect!: TimeframeRectangle
  private _timeframe: TimeInterval = UNDEFINED_TIMEFRAME

  private styling!: Styling
  private timeframeAnimation: TimeframeAnimation | null = null

  /**
   * Instantiates a new timeline.
   * @param parentElement The HTML element to which the timeline is added
   * @param getTimeEntry The function that extracts the actual date of the data items
   * @param style The default timeline style
   * @param showTimeframeRectangle Whether to show timeframe rectangle to focus on parts of the timeline
   * @param showPlayButton Whether to display a button to start/stop the timeframe animation
   */
  constructor(
    private dispatch: TimelineDispatch<TDataItem>,
    private parentElement: HTMLElement,
    public getTimeRange: (item: TDataItem) => TimeRange | undefined,
    style: TimelineStyle = {},
    private showTimeframeRectangle = true,
    public showPlayButton = true
  ) {
    this.graphComponent = new GraphComponent()
    this.parentElement.append(this.graphComponent.div)
    this.graphComponent.div.style.width = '100%'
    this.graphComponent.div.style.height = '100%'
    this.initializeUserInteraction()
    this.initializeFolding()
    this.initializeGraphBuilder(this.graphComponent.graph.foldingView!.manager.masterGraph)
    this.initializeStyling(style)
    this.initializeTimeframe(style)

    // the zoom specifies the currently visible granularity
    this.zoomTo(2)
    let changeLayout = false
    this.graphComponent.addSizeChangedListener(
      (sender: GraphComponent, evt: SizeChangedEventArgs): void => {
        if (evt.oldSize.height !== this.graphComponent.size.height && !changeLayout) {
          changeLayout = true
          setTimeout(() => {
            changeLayout = false
            applyTimelineLayout(
              this.graphComponent,
              this.styling,
              this.zoom,
              this.minZoom,
              this.maxZoom
            )
            this.updateViewPort()
            this.centerTimeFrame(this.buckets.toArray())
          }, 500)
        }
      }
    )
  }

  /**
   * Gets the current data items of the timeline
   */
  get items(): TDataItem[] {
    return this._items
  }

  /**
   * Sets the data items of the timeline and triggers an update of the timeline.
   */
  set items(items: TDataItem[]) {
    this._items = items
    this.update()
  }

  /**
   * Returns all items associated with the currently selected bars.
   */
  get selectedItems(): TDataItem[] {
    return this.graphComponent.selection.selectedNodes
      .toArray()
      .flatMap(selectedNode => getItemsFromBucket(selectedNode))
  }

  /**
   * Returns the filtering function which describes whether the given item is visible in the current timeframe.
   */
  get filter(): (item: TDataItem) => boolean {
    return this.filterPredicate.bind(this)
  }

  /**
   * Gets the currently selected timespan.
   */
  get timeframe(): TimeInterval {
    return this._timeframe
  }

  /**
   * Sets the selected timespan in the timeline.
   */
  set timeframe(value: TimeInterval) {
    this._timeframe = value
    if (this.showTimeframeRectangle) {
      this.updateTimeframeRectFromTimeframe()
    }
  }

  addFilterChangedListener(listener: FilterChangedListener<TDataItem>): void {
    this.filterChangedListener = delegate.combine(this.filterChangedListener, listener)
  }

  removeFilterChangedListener(listener: FilterChangedListener<TDataItem>): void {
    this.filterChangedListener = delegate.remove(this.filterChangedListener, listener)
  }

  /**
   * Registers a click event listener on the bar elements of the timeline.
   */
  addBarSelectListener(listener: BarSelectListener<TDataItem>): void {
    this.barSelectListener = delegate.combine(this.barSelectListener, listener)
  }

  /**
   * De-registers a click event listener on the bar elements of the timeline.
   */
  removeBarSelectListener(listener: BarSelectListener<TDataItem>): void {
    this.barSelectListener = delegate.remove(this.barSelectListener, listener)
  }

  /**
   * Registers a hover event listener on the bar elements of the timeline.
   */
  addBarHoverListener(listener: BarHoverListener<TDataItem>): void {
    this.barHoverListener = delegate.combine(this.barHoverListener, listener)
  }

  /**
   * De-registers a hover event listener on the bar elements of the timeline.
   */
  removeBarHoverListener(listener: BarHoverListener<TDataItem>): void {
    this.barHoverListener = delegate.remove(this.barHoverListener, listener)
  }

  /**
   * Registers a listener that is invoked when the animation ends.
   */
  addAnimationEndListener(listener: () => void): void {
    this.animationEndListener = delegate.combine(this.animationEndListener, listener)
  }

  /**
   * De-registers a listener that is invoked when the animation ends.
   */
  removeAnimationEndListener(listener: () => void): void {
    this.animationEndListener = delegate.combine(this.animationEndListener, listener)
  }

  /**
   * Configures the user interaction on the timeline component.
   */
  private initializeUserInteraction(): void {
    const graphComponent = this.graphComponent

    // the timeline graph cannot be edited interactively
    const inputMode = new GraphViewerInputMode()

    // limit the viewport of the timeline to the visible content, such that users cannot pan the content out of view.
    const viewportLimiter = this.graphComponent.viewportLimiter
    viewportLimiter.honorBothDimensions = true
    graphComponent.minimumZoom = graphComponent.maximumZoom = graphComponent.zoom = 1

    // this component overwrites the mouse-wheel handling entirely by collapsing / expanding the folded timeline graph
    graphComponent.mouseWheelBehavior = MouseWheelBehaviors.NONE
    graphComponent.horizontalScrollBarPolicy = ScrollBarVisibility.ALWAYS

    // wire up a custom mousewheel behavior
    graphComponent.addMouseWheelListener((sender, evt) => {
      evt.originalEvent?.preventDefault()
      this.updateZoom(evt)
    })

    // install a tooltip on the timeline items that reports the content of the possibly aggregated entry
    // initializeToolTips(inputMode, item => {
    //   if (item instanceof INode) {
    //     const bucket = getBucket<TDataItem>(item)
    //     if (bucket.label !== undefined) {
    //       return this.createTooltipContent(bucket)
    //     }
    //   }
    //   return null
    // })

    // installs the event handlers
    this.initializeEvents(inputMode)
    this.initializeTooltips(inputMode)

    // install the configured input mode on the GraphComponent
    graphComponent.inputMode = inputMode
  }

  /**
   * Installs various event handlers.
   */
  private initializeEvents(inputMode: GraphViewerInputMode): void {
    // bar-chart click listener
    inputMode.addItemLeftClickedListener((src, args) => {
      const clickedItem = args.item

      src.clearSelection()
      src.setSelected(clickedItem, true)

      if (clickedItem instanceof INode) {
        if (this.barSelectListener) {
          args.handled = true
          this.barSelectListener(getItemsFromBucket(clickedItem))
        }
      }
    })
    inputMode.addCanvasClickedListener(_ => {
      this.barSelectListener?.([])
    })

    // bar-chart hover listener
    const itemHoverInputMode = new (class extends ItemHoverInputMode {
      protected isValidHoverItem(item: IModelItem): boolean {
        // only consider bar-chart elements and ignore the time legend elements
        if (item instanceof INode) {
          const graph = this.inputModeContext!.graph!
          return !graph.isGroupNode(item)
        }
        return false
      }
    })()
    itemHoverInputMode.hoverCursor = Cursor.POINTER
    itemHoverInputMode.addHoveredItemChangedListener((sender, args) => {
      const highlightManager = (sender.inputModeContext!.canvasComponent as GraphComponent)
        .highlightIndicatorManager
      highlightManager.clearHighlights()

      let hoveredItems: TDataItem[] = []
      if (args.item instanceof INode) {
        highlightManager.addHighlight(args.item)
        hoveredItems = getItemsFromBucket<TDataItem>(args.item)
      }

      if (this.barHoverListener) {
        this.barHoverListener(hoveredItems)
      }
    })
    inputMode.itemHoverInputMode = itemHoverInputMode
  }

  private initializeTooltips(inputMode: GraphInputMode) {
    inputMode.toolTipItems = GraphItemTypes.NODE
    inputMode.mouseHoverInputMode.toolTipLocationOffset = new Point(14, 14)
    inputMode.mouseHoverInputMode.duration = '10s'
    inputMode.mouseHoverInputMode.delay = '0.5s'
    inputMode.addQueryItemToolTipListener((_, evt) => {
      if (!(evt.item instanceof INode)) {
        return
      }
      if (evt.item) {
        if (evt.handled) return
        const bucket = getBucket<TDataItem>(evt.item)
        const tooltipContainer = document.createElement('div')

        this.dispatch({ tooltipContainer })
        this.dispatch({
          tooltip: this.createTooltipContent(bucket)
        })

        evt.handled = true

        // Delay until tooltip contents are rendered so that dimensions are properly resolved:
        evt.toolTip = new Promise(resolve => setTimeout(() => resolve(tooltipContainer)))
      }
    })
  }

  /**
   * Creates the tooltip content when hovering an element on the timeline.
   */
  private createTooltipContent(data: Bucket<TDataItem>): TimelineTooltipProps {
    if (data.layer === 1) {
      // tooltip for "day"
      return {
        timeLabel: data.start.toDateString(),
        entries: data.aggregatedValue
      }
    } else if (data.layer === 2) {
      // tooltip for "week"
      const containingMonth = data.parent!
      const containingYear = containingMonth.parent!
      return {
        timeLabel: `${containingMonth.label} ${containingYear.label}, Week: #${data.label}`,
        entries: data.aggregatedValue
      }
    } else {
      return {
        timeLabel: data.label ?? '',
        entries: null
      }
    }
  }

  /**
   * Changes the detail level of the timeline.
   * The default mouse-wheel events behavior of the GraphComponent is disabled and overwritten with
   * this custom behavior that triggers a collapse/expand on the graph that represents the bar chart
   * of the timeline.
   */
  private updateZoom(evt: MouseEventArgs): void {
    if (evt.wheelDelta !== 0) {
      const mouseLocation = evt.location
      let closestNode: INode | undefined
      let zoomChanged
      if (evt.wheelDelta > 0) {
        closestNode = this.getClosestNode(mouseLocation)
        zoomChanged = this.zoomIn()
      } else {
        zoomChanged = this.zoomOut()
        closestNode = this.getClosestNode(mouseLocation)
      }

      if (zoomChanged) {
        applyTimelineLayout(
          this.graphComponent,
          this.styling,
          this.zoom,
          this.minZoom,
          this.maxZoom
        )

        // update the viewport such that the closest node is fixed in position
        if (closestNode) {
          const viewPoint = this.calculateViewPoint(mouseLocation, closestNode)
          this.updateViewPort(viewPoint.x)
        } else {
          this.updateViewPort()
        }

        // the bounds are now bigger but not due to a changed timeframe, thus keep silent about it
        this.updateTimeframeRectFromTimeframe(true)

        this.updateStyling()
      }
    }
  }

  /**
   * The new viewPoint when keeping the node's location fixed.
   */
  private calculateViewPoint(mouseLocation: Point, node: INode): Point {
    const mouseView = this.graphComponent.toViewCoordinates(mouseLocation)
    const nodeCenterView = this.graphComponent.toViewCoordinates(node.layout.center)
    const newViewpointView = nodeCenterView.subtract(mouseView)
    return this.graphComponent.toWorldCoordinates(newViewpointView)
  }

  /**
   * Determines the closest node to the given location.
   */
  private getClosestNode(location: Point): INode | undefined {
    const viewGraph = this.graphComponent.graph
    const mouseX = location.x
    let hitNode: INode | undefined
    let minDist = Number.POSITIVE_INFINITY
    for (const node of viewGraph.nodes) {
      if (!viewGraph.isGroupNode(node)) {
        const distToMouse = Math.abs(node.layout.center.x - mouseX)
        if (distToMouse < minDist) {
          hitNode = node
          minDist = distToMouse
        }
      }
    }
    return hitNode
  }

  /**
   * Increase zoom in the timeline.
   */
  private zoomIn(): boolean {
    return this.zoomTo(Math.max(this.minZoom, this.zoom - 1))
  }

  /**
   * Decrease zoom in the timeline.
   */
  private zoomOut(): boolean {
    return this.zoomTo(Math.min(this.maxZoom - 1, this.zoom + 1))
  }

  /**
   * Zooming in-/out of the timeline actually changes the collapse/expand state of the folded graph
   * that represents the bar chart.
   * @param zoom The zoom level which specifies to which detail level the graph should be expanded/collapsed.
   */
  private zoomTo(zoom: number): boolean {
    const viewGraph = this.graphComponent.graph
    const foldingView = viewGraph.foldingView!
    const masterGraph = foldingView.manager.masterGraph

    let zoomChanged = false
    let zoomChangedInLoop
    do {
      zoomChangedInLoop = false
      const nodesToCollapse = new Set<INode>()
      const nodesToExpand = new Set<INode>()

      for (const node of viewGraph.nodes) {
        const bucket = getBucket(node)
        if (bucket.layer === zoom && viewGraph.isGroupNode(node)) {
          nodesToCollapse.add(node)
        } else if (
          bucket.layer > zoom &&
          !viewGraph.isGroupNode(node) &&
          masterGraph.isGroupNode(foldingView.getMasterItem(node))
        ) {
          nodesToExpand.add(node)
        }
      }

      for (const node of nodesToCollapse) {
        if (viewGraph.contains(node)) {
          foldingView.collapse(node)
          zoomChangedInLoop = true
        }
      }

      for (const node of nodesToExpand) {
        foldingView.expand(node)
        zoomChangedInLoop = true
      }

      if (zoomChangedInLoop) {
        zoomChanged = true
      }
    } while (zoomChangedInLoop)

    this.zoom = zoom

    return zoomChanged
  }

  /**
   * The timeline utilizes a folded graph as visualization for the bar chart.
   */
  private initializeFolding(): void {
    const graphComponent = this.graphComponent
    const foldingManager = new FoldingManager(graphComponent.graph)
    graphComponent.graph = foldingManager.createFoldingView().graph

    foldingManager.folderNodeConverter = new AggregationFolderNodeConverter({
      copyFirstLabel: false,
      folderNodeSize: [20, 50]
    })

    const inputMode = graphComponent.inputMode as GraphInputMode
    inputMode.navigationInputMode.allowEnterGroup = false
  }

  /**
   * Populates the internal graph model with the given data.
   */
  private initializeGraphBuilder(masterGraph: IGraph): void {
    const graphBuilder = new GraphBuilder(masterGraph)
    const getBucketId = (b: Bucket<TDataItem>): string =>
      `${b.layer}-${b.start.getTime()}-${b.end.getTime()}`
    const nodesSource = graphBuilder.createGroupNodesSource({
      data: this.buckets,
      id: getBucketId,
      parentId: b => (b.parent ? getBucketId(b.parent) : null)
    })

    const nodeCreator = nodesSource.nodeCreator
    nodeCreator.createLabelsSource<Bucket<TDataItem>>({
      data: b => (b.label != null ? [b] : []),
      text: 'label'
    })

    this.graphBuilder = graphBuilder
  }

  /**
   * Initializes the timeframe-window element on the timeline.
   */
  private initializeTimeframe(style: TimelineStyle): void {
    if (!this.showTimeframeRectangle) {
      return
    }

    const graphComponent = this.graphComponent
    const rectangleIndicator = new TimeframeRectangle(graphComponent, style.timeframe)

    rectangleIndicator.setBounds(graphComponent.contentRect)
    rectangleIndicator.limits = graphComponent.contentRect

    rectangleIndicator.addBoundsChangedListener(bounds => {
      this.updateTimeframe(bounds)
    })

    this.timeframeRect = rectangleIndicator

    // initial bounds
    this.updateTimeframe(rectangleIndicator.bounds)
  }

  /**
   * Sets specific bounds for the timeframe-window from which the actual timeframe is deduced.
   */
  private updateTimeframe(bounds: Rect): void {
    const newTimeframe = this.getTimeframeFromBounds(bounds)
    if (+newTimeframe[0] !== +this._timeframe[0] || +newTimeframe[1] !== +this._timeframe[1]) {
      this._timeframe = newTimeframe
      this.onTimeframeChanged()
    }
  }

  /**
   * Helper function to determine the actual timeframe from the given bounds.
   * @returns A non-empty timeframe or UNDEFINED_TIMEFRAME if there is no data within the given bounds.
   */
  private getTimeframeFromBounds(bounds: Rect): TimeInterval {
    const graph = this.graphComponent.graph
    const nodesInFrame = graph.nodes
      .filter(node => !graph.isGroupNode(node))
      .filter(node => bounds.contains(node.layout.center))

    if (nodesInFrame.size === 0) {
      // no nodes in timeframe, this returns an "empty" timeframe to trigger the update
      return UNDEFINED_TIMEFRAME
    }

    const frameStart = getBucket(
      nodesInFrame.reduce((start, current) => {
        const currentBucket = getBucket(current)
        const startBucket = getBucket(start)
        return currentBucket.start < startBucket.start ? current : start
      })
    ).start

    const frameEnd = getBucket(
      nodesInFrame.reduce((end, current) => {
        const currentBucket = getBucket(current)
        const endBucket = getBucket(end)
        return currentBucket.end > endBucket.end ? current : end
      })
    ).end

    return [frameStart, frameEnd]
  }

  /**
   * Sets the timeframe-window to the currently specified timeframe.
   * @param silent Whether the change should be notified. For example, the bounds of the visualization may change
   *  without changing the logical timeframe (e.g. if the zoom on the timeline changes) in which case, certain listeners
   *  should not be notified.
   */
  private updateTimeframeRectFromTimeframe(silent = false): void {
    if (!this.showTimeframeRectangle) {
      return
    }

    const bounds = this.getBoundsFromTimeframe(this._timeframe)
    this.timeframeRect.setBounds(bounds, silent)
    this.updateStyling()
  }

  /**
   * Helper function that determines the bounds of the timeframe-window from the currently selected timeframe.
   */
  private getBoundsFromTimeframe(timeframe: TimeInterval): Rect {
    const graphComponent = this.graphComponent
    const graph = graphComponent.graph
    const nodesInTimeframe = graph.nodes
      .filter(node => !graph.isGroupNode(node))
      .filter(node => {
        const bucket = getBucket(node)
        return intervalsIntersect(bucket.start, bucket.end, timeframe[0], timeframe[1])
      })

    if (nodesInTimeframe.size === 0) {
      return new Rect(
        graphComponent.contentRect.topLeft,
        new Size(1, graphComponent.contentRect.height)
      )
    }

    let minX = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    nodesInTimeframe.forEach(current => {
      minX = Math.min(minX, current.layout.x)
      maxX = Math.max(maxX, current.layout.maxX)
    })

    return new Rect(
      minX,
      graphComponent.contentRect.y,
      maxX - minX,
      graphComponent.contentRect.height
    )
  }

  /**
   * Initialize a default visualization for the timeline component.
   */
  private initializeStyling(style: TimelineStyle): void {
    this.styling = new Styling(this.graphComponent, style)

    this.graphComponent.highlightIndicatorManager = new GraphHighlightIndicatorManager({
      nodeStyle: new ShapeNodeStyle({
        shape: 'rectangle',
        stroke: `2px solid ${style.barHover?.stroke ?? defaultStyling.barHover?.stroke}`,
        fill: style.barHover?.fill ?? defaultStyling.barHover?.fill
      })
    })
  }

  /**
   * Applies the styling to the currently selected/highlighted items.
   */
  private updateStyling(): void {
    this.styling.updateStyles(this._timeframe)
  }

  private onTimeframeChanged(): void {
    this.updateStyling()

    this.filterChangedListener?.(this.filter)
  }

  /**
   * Returns true if the given item is inside the current timeframe, and false otherwise.
   */
  private filterPredicate(item: TDataItem): boolean {
    if (!item) return false

    try {
      this.getTimeRange(item)
    } catch (e) {
      return false
    }

    const [startDate, endDate] = this._timeframe
    const [start, end] = [+startDate, +endDate]

    const timeEntry = this.getTimeRange(item)
    if (Array.isArray(timeEntry)) {
      return timeEntry.some(entry => {
        if (typeof entry === 'number') {
          const time = entry
          return start <= time && time < end
        } else {
          if (typeof entry.start === 'undefined' || typeof entry.end === 'undefined') {
            return true
          }
          return intervalsIntersect(entry.start, entry.end, start, end)
        }
      })
    } else if (timeEntry) {
      if (typeof timeEntry.start === 'undefined' || typeof timeEntry.end === 'undefined') {
        return true
      }
      return intervalsIntersect(timeEntry.start, timeEntry.end, start, end)
    }
    return false
  }

  /**
   * Updates the entire timeline when the data changes.
   */
  private update(): void {
    const allBuckets = aggregateBuckets(this.items, this.getTimeRange, this.granularities)
    this.updateGraph(allBuckets)
    this.zoomTo(this.zoom)
    applyTimelineLayout(this.graphComponent, this.styling, this.zoom, this.minZoom, this.maxZoom)
    // this.applyLayout()
    this.updateViewPort()
    this.centerTimeFrame(allBuckets)

    if (this.showTimeframeRectangle) {
      // The new data may be in an entirely different time slice. If so, update the timeframe to match some data
      const newTimeFrame = this.getTimeframeFromBounds(this.graphComponent.contentRect)
      // see if the new data intersects with the timeline - if not - move it into place
      if (
        this._timeframe === UNDEFINED_TIMEFRAME ||
        !timeframeEquals(this._timeframe, newTimeFrame)
      ) {
        if (this._timeframe !== UNDEFINED_TIMEFRAME) {
          if (this._timeframe[1].getTime() < newTimeFrame[0].getTime()) {
            newTimeFrame[1] = new Date(
              newTimeFrame[0].getTime() +
                (this._timeframe[1].getTime() - this._timeframe[0].getTime())
            )
          } else if (this._timeframe[0].getTime() > newTimeFrame[1].getTime()) {
            newTimeFrame[0] = new Date(
              newTimeFrame[1].getTime() -
                (this._timeframe[1].getTime() - this._timeframe[0].getTime())
            )
          } else {
            newTimeFrame[0] = this._timeframe[0]
            newTimeFrame[1] = this._timeframe[1]
          }
          this.timeframe = newTimeFrame
          this.onTimeframeChanged()
        } else {
          this.updateTimeframe(this.graphComponent.contentRect)
          this.updateTimeframeRectFromTimeframe()
        }
      } else {
        // Fire the filter changed listeners to notify about the changed data, even though the timeframe stayed the same.
        this.onTimeframeChanged()
        this.filterChangedListener?.(this.filter)
      }
    } else {
      // Set the timeframe to the whole timeline because nothing is out of focus when there is no timeframe rectangle
      this.timeframe = this.getTimeframeFromBounds(this.graphComponent.contentRect)
      // Fire the filter changed listeners to notify about the changed data, even though the timeframe stayed the same.
      this.onTimeframeChanged()
      this.filterChangedListener?.(this.filter)
    }
  }

  private centerTimeFrame(allBuckets: Bucket<TDataItem>[]): void {
    const halfBuckets = allBuckets.length / 2
    const offset = allBuckets.length / 10
    this.timeframe = [
      allBuckets[Math.floor(halfBuckets - offset)].start,
      allBuckets[Math.floor(halfBuckets + offset)].end
    ]
  }

  /**
   * Updates the viewport and ViewportLimiter of the timeline.
   * @param viewPointX Utilizes this x-coordinate as new viewpoint or centers the viewport horizontally if not given
   */
  updateViewPort(viewPointX?: number): void {
    const graphComponent = this.graphComponent
    graphComponent.updateContentRect(10)

    const contentRect = graphComponent.contentRect
    graphComponent.viewportLimiter.bounds = contentRect

    if (viewPointX === undefined) {
      // just center it horizontally
      viewPointX = contentRect.x + contentRect.width * 0.5 - graphComponent.viewport.width * 0.5
    }

    graphComponent.viewPoint = new Point(
      viewPointX,
      contentRect.maxY - graphComponent.viewport.height
    )

    const minY = Math.min(contentRect.minY, graphComponent.viewport.minY)
    const maxY = Math.max(contentRect.maxY, graphComponent.viewport.maxY)
    graphComponent.contentRect = new Rect(contentRect.x, minY, contentRect.width, maxY - minY)

    if (this.showTimeframeRectangle) {
      this.timeframeRect.limits = graphComponent.contentRect
    }
  }

  /**
   * Updates the graph model when the data changes.
   */
  private updateGraph(buckets: Bucket<TDataItem>[]): void {
    this.buckets.clear()
    this.buckets.addRange(buckets)
    this.graphBuilder.graph.clear()
    this.graphBuilder.buildGraph()
  }

  /**
   * Disposes the timeline.
   */
  cleanUp(): void {
    this.timeframeRect.cleanup()
    this.parentElement.removeChild(this.graphComponent.div)
    this.graphComponent.cleanUp()
  }

  /**
   * Creates and returns the timeframe animation for the video.
   * @returns The timeframe animation
   */
  getTimeframeAnimation(): TimeframeAnimation {
    if (
      this.timeframeAnimation === null ||
      this.timeframeAnimation.timeframeRect !== this.timeframeRect.rect
    ) {
      // create a new animation object if there is none or if the timeframe has changed
      this.timeframeAnimation = new TimeframeAnimation(this.timeframeRect.rect, this.graphComponent)
      this.timeframeAnimation.addTimeframeListener(rect => this.updateTimeframe(rect))
      this.timeframeAnimation.addAnimationEndedListener(() => {
        // stop the animation and revert the state of the play button
        if (this.showPlayButton && !(this.timeframeAnimation?.animating ?? false)) {
          this.stop()
        }
        this.animationEndListener?.()
      })
    }
    return this.timeframeAnimation
  }

  /**
   * Starts the time-frame animation.
   */
  play(): void {
    const animation = this.getTimeframeAnimation()
    animation.stopAnimation()
    animation.playAnimation()
    this.dispatch({ animationState: 'playing' })
  }

  /**
   * Stops the time-frame animation.
   */
  stop(): void {
    this.getTimeframeAnimation().stopAnimation()
    this.dispatch({ animationState: 'idle' })
  }
}
