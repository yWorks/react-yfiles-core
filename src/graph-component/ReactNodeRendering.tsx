import {
  createElement,
  createRef,
  Dispatch,
  ReactNode,
  RefObject,
  SetStateAction,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { FilteredGraphWrapper, GraphComponent, IGraph, INode, Rect } from 'yfiles'
import {
  NodeRenderInfo,
  ReactComponentHtmlNodeStyle,
  RenderNodeProps
} from './ReactComponentHtmlNodeStyle.ts'
import { useGraphComponent } from './GraphComponentProvider.tsx'
import { createPortal } from 'react-dom'
import {
  ReactComponentHtmlGroupNodeStyle,
  RenderGroupNodeProps
} from './ReactComponentHtmlGroupNodeStyle.ts'

export function useReactNodeRendering<TDataItem>(): {
  nodeInfos: NodeRenderInfo<TDataItem>[]
  setNodeInfos: Dispatch<SetStateAction<NodeRenderInfo<TDataItem>[]>>
} {
  const [nodeInfos, setNodeInfos] = useState<NodeRenderInfo<TDataItem>[]>([])
  return {
    nodeInfos,
    setNodeInfos
  }
}

type NodeTemplateRef = {
  ref: RefObject<HTMLDivElement>
  node: INode | null
}

type SizedDataItem = { width?: number; height?: number }

type NodeMeasurementProps<TDataItem extends SizedDataItem> = {
  nodeData: TDataItem[]
  nodeSize?: { width: number; height: number }
  maxSize?: { width: number; height: number }
  onMeasured?: () => void
}

type RenderNodesProps<TDataItem> = {
  nodeInfos: NodeRenderInfo<TDataItem>[]
  onRendered?: () => void
}

export type ReactNodeRenderingProps<TDataItem extends SizedDataItem> =
  NodeMeasurementProps<TDataItem> & RenderNodesProps<TDataItem>

const fallbackNodeSize = { width: 285, height: 100 }

export function ReactNodeRendering<TDataItem extends SizedDataItem>({
  nodeData,
  nodeInfos,
  nodeSize,
  maxSize,
  onMeasured,
  onRendered
}: ReactNodeRenderingProps<TDataItem>) {
  return (
    <>
      <NodeMeasurement
        nodeData={nodeData}
        nodeSize={nodeSize}
        maxSize={maxSize}
        onMeasured={onMeasured}
      ></NodeMeasurement>
      <RenderNodes nodeInfos={nodeInfos} onRendered={onRendered}></RenderNodes>
    </>
  )
}

function getMasterGraph(graphComponent: GraphComponent): IGraph {
  let graph = graphComponent.graph.foldingView?.manager.masterGraph ?? graphComponent.graph
  return graph instanceof FilteredGraphWrapper ? graph.wrappedGraph! : graph
}

function NodeMeasurement<TDataItem extends SizedDataItem>({
  nodeData,
  nodeSize,
  maxSize,
  onMeasured
}: NodeMeasurementProps<TDataItem>) {
  const graphComponent = useGraphComponent()!

  const [measureElements, setMeasureElements] = useState<ReactNode[]>([])

  const measureParent = useRef<HTMLDivElement>(null)
  const myRef = useRef<NodeTemplateRef[]>([])

  useLayoutEffect(() => {
    const shouldMeasure = !nodeSize && nodeData.some(item => !('width' in item && 'height' in item))

    if (!shouldMeasure) {
      onMeasured?.()
      return
    }

    if (!nodeSize) {
      const graph = getMasterGraph(graphComponent)
      const elements: ReactNode[] = []
      let index = 0
      for (const node of graph.nodes) {
        if (!(node.tag.width && node.tag.height)) {
          const style = node.style
          const nodeTemplateRef = {
            node,
            ref: createRef<HTMLDivElement>()
          }
          myRef.current.push(nodeTemplateRef)
          let nodeElement
          if (style instanceof ReactComponentHtmlNodeStyle) {
            nodeElement = createElement(style.component, getMeasureNodeProps(node))
          } else if (style instanceof ReactComponentHtmlGroupNodeStyle) {
            const foldingView = graphComponent.graph.foldingView
            nodeElement = createElement(style.component, {
              ...getMeasureNodeProps(node),
              isFolderNode: foldingView ? !foldingView.isExpanded(node) : false
            } as RenderGroupNodeProps<any>)
          }
          const element = (
            <div
              ref={nodeTemplateRef.ref}
              data-id={node.tag.id}
              key={index}
              style={{ position: 'fixed' }}
            >
              {nodeElement}
            </div>
          )
          elements.push(element)
        }
        index++
      }
      setMeasureElements(elements)
    }

    return () => {
      myRef.current = []
    }
  }, [graphComponent, nodeData, nodeSize])

  useLayoutEffect(() => {
    if (measureElements.length > 0) {
      for (const { ref, node } of myRef.current) {
        if (node && ref.current) {
          // get the size of the template and assign its size to the node (only if the node has no specific size stored in its data)
          const { width, height } = ref.current.firstElementChild!.getBoundingClientRect()
          const newWidth =
            node.tag.width ??
            Math.min(width || fallbackNodeSize.width, maxSize?.width ?? Number.POSITIVE_INFINITY)
          const newHeight =
            node.tag.height ??
            Math.min(height || fallbackNodeSize.height, maxSize?.height ?? Number.POSITIVE_INFINITY)
          if (newWidth !== node.layout.width || newHeight !== node.layout.height) {
            getMasterGraph(graphComponent).setNodeLayout(
              node,
              new Rect(node.layout.x, node.layout.y, newWidth, newHeight)
            )
          }
        }
      }

      measureParent.current!.innerHTML = ''
      onMeasured && onMeasured()
    }
  }, [measureElements])

  return (
    <>
      {measureElements.length > 0 && (
        <div
          className="yfiles-react-measure-container"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: -1
          }}
          ref={measureParent}
        >
          {measureElements}
        </div>
      )}
    </>
  )
}

function RenderNodes<TDataItem>({ nodeInfos, onRendered }: RenderNodesProps<TDataItem>) {
  useEffect(() => {
    onRendered?.()
  })

  const nodes = useMemo(
    () =>
      nodeInfos.map(nodeInfo =>
        createPortal(
          createElement<RenderNodeProps<TDataItem>>(nodeInfo.component, nodeInfo.props),
          nodeInfo.domNode
        )
      ),
    [nodeInfos]
  )

  return <>{nodes}</>
}

function getMeasureNodeProps(node: INode): RenderNodeProps<any> {
  return {
    selected: false,
    hovered: false,
    focused: false,
    width: fallbackNodeSize.width,
    height: fallbackNodeSize.height,
    detail: 'high',
    dataItem: node.tag
  }
}
