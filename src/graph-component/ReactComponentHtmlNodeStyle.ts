import type { GraphComponent, GraphInputMode, INode, IRenderContext, TypedHtmlVisual } from 'yfiles'
import { HtmlVisual, NodeStyleBase } from 'yfiles'
import { ComponentType, Dispatch, memo, SetStateAction } from 'react'

/**
 * A React component rendering a node described by the {@link RenderNodeProps}.
 */
type NodeTemplate<TDataItem> = ComponentType<RenderNodeProps<TDataItem>>

/**
 * Helper for the ReactComponentHtmlNodeStyle to factor out the props retrieval per node.
 */
export type TagProvider<TDataItem> = (context: IRenderContext, node: INode) => TDataItem

/**
 * The default implementation just uses the props from the tag of the item to be rendered.
 */
export const defaultTagProvider: TagProvider<any> = (_, node) => node.tag

/**
 * The information necessary to render a node in the context of its parent component with portals.
 */
export type NodeRenderInfo<TDataItem> = {
  domNode: HTMLDivElement
  component: NodeTemplate<TDataItem>
  props: RenderNodeProps<TDataItem>
  node: INode
}

/**
 * The interface of the props passed to the HTML react component for rendering the node contents.
 */
export interface RenderNodeProps<TDataItem> {
  /**
   * Whether the item is currently selected.
   */
  selected: boolean
  /**
   * Whether the item is currently being hovered.
   */
  hovered: boolean
  /**
   * Whether the item is currently focused.
   */
  focused: boolean
  /**
   * The width of the item.
   */
  width: number
  /**
   * The height of the item.
   */
  height: number
  /**
   * The detail level of the visualization. Use this value to implement level-of-detail rendering.
   */
  detail: 'low' | 'high'
  /**
   * The data item to render.
   */
  dataItem: TDataItem

  /**
   * Other props.
   */
  [key: string]: unknown
}

/**
 * A simple INodeStyle implementation that uses React Components/render functions
 * for rendering the node visualizations as an HtmlVisual.
 * Use it like this:
 * ```
 *  declare type TagType = { name: string }
 *
 *  const MyHtmlNodeTemplate = ({ name }: ReactComponentHtmlNodeStyleProps) => (
 *    <>
 *      <span>{name}</span>
 *   </>
 *  )
 *
 *  const style = new ReactComponentNodeStyle(MyHtmlNodeTemplate)
 *
 *  const tag: TagType = { name: 'yFiles' }
 *  graph.createNode({ style, tag })
 * ```
 */
export class ReactComponentHtmlNodeStyle<TDataItem> extends NodeStyleBase<
  TypedHtmlVisual<HTMLDivElement>
> {
  public readonly component: NodeTemplate<TDataItem>

  /**
   * Creates a new instance.
   * @param reactComponent The React component rendering the HTML content.
   * @param setNodeInfos Callback for setting the node infos to be rendered.
   * @param tagProvider The optional provider function that provides the "tag" in the props.
   * By default, this will use the node's tag.
   */
  constructor(
    reactComponent: ComponentType<RenderNodeProps<TDataItem>>,
    private readonly setNodeInfos: Dispatch<SetStateAction<NodeRenderInfo<TDataItem>[]>>,
    private readonly tagProvider: TagProvider<TDataItem> = defaultTagProvider
  ) {
    super()
    const memoizedComponent = memo(reactComponent)
    memoizedComponent.displayName = 'ReactComponentHtmlNodeStyle-NodeTemplate'
    this.component = memoizedComponent
  }

  protected createProps(
    context: IRenderContext,
    node: INode,
    cloneData: boolean
  ): RenderNodeProps<TDataItem> {
    const graphComponent = context.canvasComponent as GraphComponent
    const inputMode = graphComponent.inputMode as GraphInputMode
    return {
      selected: graphComponent.selection.isSelected(node),
      hovered: inputMode?.itemHoverInputMode.currentHoverItem === node,
      focused: graphComponent.currentItem === node,
      width: node.layout.width,
      height: node.layout.height,
      detail: context.zoom < 0.5 ? 'low' : 'high',
      dataItem: cloneData ? { ...this.tagProvider(context, node) } : this.tagProvider(context, node)
    }
  }

  protected createVisual(context: IRenderContext, node: INode): TypedHtmlVisual<HTMLDivElement> {
    // obtain the properties from the node
    const props = this.createProps(context, node, true)

    // create a React root and render the component into
    const div = document.createElement('div')

    this.setNodeInfos &&
      this.setNodeInfos(nodeInfos => {
        const info = { domNode: div, props, component: this.component, node }
        const newInfos = nodeInfos.filter(info => info.node !== node)
        newInfos.push(info)
        return newInfos
      })

    // wrap the Dom element into a HtmlVisual, adding the "root" for later use in updateVisual
    const visual = HtmlVisual.from(div)

    // set the CSS layout for the container
    HtmlVisual.setLayout(visual.element, node.layout)

    // register a callback that unmounts the React app when the visual is discarded
    context.setDisposeCallback(visual, () => {
      this.setNodeInfos &&
        this.setNodeInfos(nodeInfos => {
          return nodeInfos.filter(info => info.node !== node)
        })
      return null
    })
    return visual
  }

  protected updateVisual(
    context: IRenderContext,
    oldVisual: TypedHtmlVisual<HTMLDivElement>,
    node: INode
  ): TypedHtmlVisual<HTMLDivElement> {
    // obtain the properties from the node
    const newProps = this.createProps(context, node, false)

    this.setNodeInfos &&
      this.setNodeInfos(nodeInfos => {
        const oldInfo = nodeInfos.find(info => info.node === node)
        if (!oldInfo) {
          return nodeInfos
        }

        const oldProps = oldInfo.props
        if (!this.areEqual(oldProps, newProps)) {
          const newInfo = {
            domNode: oldVisual.element,
            props: this.createProps(context, node, true),
            component: this.component,
            node
          }
          const newInfos = nodeInfos.filter(info => info !== oldInfo)
          newInfos.push(newInfo)
          return newInfos
        }

        return nodeInfos
      })

    // update the CSS layout of the container element
    HtmlVisual.setLayout(oldVisual.element, node.layout)
    return oldVisual
  }

  protected areEqual(oldProps: RenderNodeProps<TDataItem>, newProps: RenderNodeProps<TDataItem>) {
    return (
      oldProps.selected === newProps.selected &&
      oldProps.hovered === newProps.hovered &&
      oldProps.focused === newProps.focused &&
      oldProps.detail === newProps.detail &&
      oldProps.width === newProps.width &&
      oldProps.height === newProps.height &&
      this.deepEquals(oldProps.dataItem, newProps.dataItem)
    )
  }

  private deepEquals(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) {
      return true
    }

    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
      return false
    }

    const keys1 = Object.keys(obj1)
    const keys2 = Object.keys(obj2)
    if (keys1.length !== keys2.length) {
      return false
    }

    for (const key of keys1) {
      if (!keys2.includes(key)) {
        return false
      }

      if (!this.deepEquals(obj1[key], obj2[key])) {
        return false
      }
    }
    return true
  }
}
