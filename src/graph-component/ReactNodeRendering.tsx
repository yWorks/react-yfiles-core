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
import { ReactComponentHtmlGroupNodeStyle } from './ReactComponentHtmlGroupNodeStyle.ts'

export function useReactNodeRendering<TDataItem>(): {
  nodeInfos: NodeRenderInfo<TDataItem>[]
  setNodeInfos: Dispatch<SetStateAction<NodeRenderInfo<TDataItem>[]>>
  forceUpdateMeasurement: boolean
  updateMeasurement: () => void
} {
  const [nodeInfos, setNodeInfos] = useState<NodeRenderInfo<TDataItem>[]>([])
  const [forceUpdateMeasurement, setForceUpdateMeasurement] = useState(false)
  return {
    nodeInfos,
    setNodeInfos,
    forceUpdateMeasurement,
    // toggles the measurement state to make sure that measurement occurs when needed
    updateMeasurement: () => setForceUpdateMeasurement(!forceUpdateMeasurement)
  }
}

type NodeTemplateRef = {
  ref: RefObject<HTMLDivElement>
  node: INode | null
}

type NodeMeasurementProps<TDataItem> = {
  nodeData: TDataItem[]
  nodeSize?: { width: number; height: number }
  maxSize?: { width: number; height: number }
  onMeasured?: () => void
  updateMeasurement: boolean
}

type RenderNodesProps<TDataItem> = {
  nodeInfos: NodeRenderInfo<TDataItem>[]
  onRendered?: () => void
}

export type ReactNodeRenderingProps<TDataItem> = NodeMeasurementProps<TDataItem> &
  RenderNodesProps<TDataItem>

const fallbackNodeSize = { width: 285, height: 100 }

export function ReactNodeRendering<TDataItem>({
  nodeData,
  nodeInfos,
  nodeSize,
  maxSize,
  updateMeasurement,
  onMeasured,
  onRendered
}: ReactNodeRenderingProps<TDataItem>) {
  return (
    <>
      <NodeMeasurement
        nodeData={nodeData}
        nodeSize={nodeSize}
        maxSize={maxSize}
        updateMeasurement={updateMeasurement}
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

function NodeMeasurement<TDataItem>({
  nodeData,
  nodeSize,
  maxSize,
  onMeasured,
  updateMeasurement
}: NodeMeasurementProps<TDataItem>) {
  const graphComponent = useGraphComponent()!

  const [measureElements, setMeasureElements] = useState<ReactNode[]>([])
  const [measured, setMeasured] = useState<boolean>(false)

  const measureParent = useRef<HTMLDivElement>(null)
  const myRef = useRef<NodeTemplateRef[]>([])

  useEffect(() => {
    setMeasured(false)
  }, [nodeData])

  useEffect(() => {
    setMeasured(false)
    myRef.current = []
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
            })
          }
          const element = (
            <div
              ref={nodeTemplateRef.ref}
              data-id={node.tag.id}
              key={index}
              style={{ position: 'absolute' }}
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
  }, [graphComponent, nodeData, updateMeasurement])

  useLayoutEffect(() => {
    if (!measured && measureParent.current) {
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
      setMeasured(true)
      onMeasured && onMeasured()
    }
  }, [measured, measureParent.current])

  return (
    <>
      {!measured && (
        <div className="yfiles-react-measure-container" ref={measureParent}>
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
