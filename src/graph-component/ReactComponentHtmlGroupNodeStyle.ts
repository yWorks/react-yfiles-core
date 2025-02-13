import { ComponentType, Dispatch, SetStateAction } from 'react'
import type { GraphComponent, INode, IRenderContext } from '@yfiles/yfiles'
import {
  defaultTagProvider,
  NodeRenderInfo,
  ReactComponentHtmlNodeStyle,
  RenderNodeProps,
  TagProvider
} from './ReactComponentHtmlNodeStyle.ts'

export interface RenderGroupNodeProps<TDataItem> extends RenderNodeProps<TDataItem> {
  /**
   * Whether the node is folded.
   */
  isFolderNode: boolean
}

export class ReactComponentHtmlGroupNodeStyle<
  TDataItem
> extends ReactComponentHtmlNodeStyle<TDataItem> {
  constructor(
    reactComponent: ComponentType<RenderGroupNodeProps<TDataItem>>,
    setNodeInfos: Dispatch<SetStateAction<NodeRenderInfo<TDataItem>[]>>,
    tagProvider: TagProvider<TDataItem> = defaultTagProvider
  ) {
    super(reactComponent as ComponentType<RenderNodeProps<TDataItem>>, setNodeInfos, tagProvider)
  }

  protected createProps(
    context: IRenderContext,
    node: INode,
    cloneData: boolean
  ): RenderGroupNodeProps<TDataItem> {
    const graphComponent = context.canvasComponent as GraphComponent
    const foldingView = graphComponent.graph.foldingView
    return {
      ...super.createProps(context, node, cloneData),
      isFolderNode: foldingView ? !foldingView.isExpanded(node) : false
    }
  }

  protected areEqual(
    oldProps: RenderGroupNodeProps<TDataItem>,
    newProps: RenderGroupNodeProps<TDataItem>
  ): boolean {
    return super.areEqual(oldProps, newProps) && oldProps.isFolderNode === newProps.isFolderNode
  }
}