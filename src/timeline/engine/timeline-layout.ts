import {
  type GraphComponent,
  ILayoutGroupBoundsCalculator,
  Insets,
  type LayoutGraph,
  LayoutGrid,
  LayoutStageBase,
  Rect,
  RecursiveGroupLayout,
  SequentialLayout,
  TabularLayout,
  TabularLayoutData,
  TabularLayoutMode,
  TabularLayoutNodeDescriptor,
  TextRenderSupport
} from '@yfiles/yfiles'
import { type Bucket, getBucket } from './bucket-aggregation'
import type { Styling } from './Styling'

/**
 * Applies a RecursiveGroupLayout with a PartitionGrid to the managed graph.
 */
export function applyTimelineLayout<TDataItem>(
  graphComponent: GraphComponent,
  styling: Styling,
  zoom: number,
  minZoom: number,
  maxZoom: number
): void {
  const recursiveGroupLayout = new RecursiveGroupLayout({
    coreLayout: new TabularLayout({
      layoutMode: TabularLayoutMode.FIXED_SIZE,
      nodeLabelPlacement: 'ignore',
      defaultNodeDescriptor: new TabularLayoutNodeDescriptor({
        verticalAlignment: 1
      })
    })
  })

  const grid = new LayoutGrid({ rowCount: 1, columnCount: 31 })
  const layoutData = new TabularLayoutData({
    freeNodeComparator: (a, b) => {
      const tagA = a!.tag as Bucket<TDataItem>
      const tagB = b!.tag as Bucket<TDataItem>
      return (tagA.index ?? -1) - (tagB.index ?? -1)
    },
    nodeMargins: (item) => {
      const bucket = getBucket(item)
      const index = bucket.index ?? -1
      return new Insets(
        0,
        bucket.parent?.children.length === index + 1 ? 0 : 2,
        0,
        index === 0 ? 0 : 2
      )
    }
  })
  layoutData.layoutGridData.layoutGridCellDescriptors = () => grid.createDynamicCellDescriptor()


  recursiveGroupLayout.groupBoundsCalculator = ILayoutGroupBoundsCalculator.create(
    (graph, groupNode, children) => {
      let groupBounds = graph.getBounds(children)

      const tag = groupNode.tag as Bucket<TDataItem> | null
      if (tag?.type === 'group' && tag.label != null) {
        const groupLabelSizeEven = TextRenderSupport.measureText(
          tag.label,
          styling.groupStyleEven.font
        )
        const groupLabelSizeOdd = TextRenderSupport.measureText(
          tag.label,
          styling.groupStyleOdd.font
        )
        const minWidth = Math.max(groupLabelSizeEven.width, groupLabelSizeOdd.width) + 10
        const minHeight = Math.max(groupLabelSizeEven.height, groupLabelSizeOdd.height) + 4
        groupBounds = new Rect(
          groupBounds.x,
          groupBounds.y,
          Math.max(groupBounds.width, minWidth),
          groupBounds.height + minHeight
        )
      }

      return groupBounds
    }
  )

  const fontHeight = graphComponent.graph.nodeLabels.reduce((maxHeight, label) => {
    return Math.max(maxHeight, label.layout.bounds.height)
  }, 0)
  // calculate the maximum height for the bars by subtracting the height of the calendar labels and a small margin
  const maxHeight = graphComponent.size.height - (maxZoom - zoom + 1) * (fontHeight + 4) - 20
  const scaleBars = new BarScalingStage(maxHeight, zoom)

  graphComponent.graph.applyLayout(
    new SequentialLayout(scaleBars, recursiveGroupLayout),
    layoutData
  )
}

/**
 * A {@link LayoutStageBase} that scales the height of the bars so that they fit into the graph
 * components bounds.
 */
class BarScalingStage<TDataItem> extends LayoutStageBase {
  constructor(
    private maxHeight: number,
    private zoom: number
  ) {
    super()
  }

  protected applyLayoutImpl(graph: LayoutGraph): void {
    let maxValue = 0
    graph.nodes.forEach((node) => {
      const tag = node.tag as Bucket<TDataItem> | null
      if (tag?.type === 'group' && tag.layer === this.zoom) {
        maxValue = Math.max(maxValue, tag.aggregatedValue)
      }
    })
    const scale = maxValue > 0 ? this.maxHeight / maxValue : 1
    graph.nodes.forEach((node) => {
      const tag = node.tag as Bucket<TDataItem> | null
      if (tag?.type === 'group') {
        node.layout.size = [node.layout.width, tag.aggregatedValue * scale]
      }
    })
  }
}
