import { Arrow as YArrow, ArrowType, IArrow, PolylineEdgeStyle, Stroke } from 'yfiles'

/**
 * A connection style configuration.
 */
export interface EdgeStyle {
  /**
   * An optional CSS class that's used by the connection.
   */
  className?: string
  /**
   * The thickness of the connection.
   */
  thickness?: number
  /**
   * The bend smoothing of the connection.
   */
  smoothingLength?: number
  /**
   * The source arrow type.
   */
  sourceArrow?: Arrow
  /**
   * The target arrow type.
   */
  targetArrow?: Arrow
}

/**
 * A connection arrow configuration.
 */
export interface Arrow {
  /**
   * The arrow color.
   */
  color?: string
  /**
   * The shape of the arrow.
   */
  type?: 'circle' | 'cross' | 'default' | 'diamond' | 'none' | 'short' | 'simple' | 'triangle'
}

/**
 * Converts the input style to a yFiles PolylineEdgeStyle.
 */
export function convertToPolylineEdgeStyle(style: EdgeStyle) {
  return new PolylineEdgeStyle({
    smoothingLength: style.smoothingLength ?? 0,
    stroke: new Stroke({
      fill: style.className ? 'currentColor' : 'rgb(170, 170, 170)',
      thickness: style.thickness ?? 1
    }),
    cssClass: style.className ?? '',
    sourceArrow: convertArrow(style, true),
    targetArrow: convertArrow(style)
  })
}

/**
 * Converts the input style arrow to a yFiles PolylineEdgeStyle.
 */
function convertArrow(style: EdgeStyle, isSource = false): IArrow {
  const arrow = isSource ? style.sourceArrow : style.targetArrow
  if (!arrow) {
    return IArrow.NONE
  }
  const arrowColor = arrow.color ?? (style.className ? 'currentColor' : 'black')
  return new YArrow({
    stroke: `${(style.thickness ?? 1) * 0.5}px ${arrowColor}`,
    fill: arrowColor,
    type: arrow.type ? ArrowType.from(arrow.type) : 'default'
  })
}
