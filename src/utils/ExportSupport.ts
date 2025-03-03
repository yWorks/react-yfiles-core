import {
  Exception,
  Graph,
  GraphComponent,
  GraphCopier,
  Insets,
  IPortStyle,
  Size,
  SvgExport
} from '@yfiles/yfiles'
import { downloadFile } from './FileIoSupport'

/**
 * Exports the content of the graphComponent as an SVG Element.
 */
export async function exportSvgElement(
  exportSettings: ExportSettings,
  graphComponent: GraphComponent
): Promise<Element> {
  const exporter = createSvgExporter(exportSettings, graphComponent)
  const exportComponent = await createExportGraphComponent(graphComponent)
  return await exporter.exportSvgAsync(exportComponent)
}

/**
 * Exports the content of the graphComponent as an SVG string.
 * @throws Exception if the diagram cannot be exported.
 * The exception may occur when the diagram contains images from cross-origin sources.
 * In this case, disable {@link ExportSettings.inlineImages} and encode the icons manually to base64.
 */
export async function exportSvg(
  exportSettings: ExportSettings,
  graphComponent: GraphComponent,
  onRendered: (cb: () => void) => void
) {
  const svgElement = await exportSvgElement(exportSettings, graphComponent)

  await new Promise<void>((resolve, reject) => {
    onRendered(resolve)
  })

  // collect all stylesheets - dom has to be ready to get them
  attachStyleSheets(svgElement, graphComponent.htmlElement)

  return await doEncodeImagesBase64(svgElement, exportSettings)
    .then(() => svgElement)
    .then(() => SvgExport.exportSvgString(svgElement))
}

/**
 * Settings to configure how the graph is exported.
 */
export interface ExportSettings {
  /**
   * Gets or sets the scale for the export.
   *
   * A scale of 1 preserves the original size, a scale of 0.5 results in a target image with half the original size and so on.
   * This value has to be strictly greater than 0 and finite. Its default value is 1.0
   */
  scale?: number

  /**
   * Gets or sets the bounds of the content to export in world coordinates.
   * The default behavior is to use bounds to encompass the whole diagram.
   */
  bounds?: {
    x: number
    y: number
    width: number
    height: number
  }

  /**
   * Gets or sets the zoom property to use during the creation of the visualization.
   *
   * In contrast to the scale property, which works on the output graphics, this property determines what zoom value is
   * to be assumed on the canvas when creating the visual. This can affect the rendering of zoom-dependent visuals,
   * especially level-of-detail rendering.
   *
   * This value has to be strictly greater than 0. Its default value is 1.0
   */
  zoom?: number

  /**
   * Gets or sets the background color for the exported SVG.
   * CSS color values are supported.
   * https://developer.mozilla.org/en-US/docs/Web/CSS/color_value
   */
  background?: string

  /**
   * Gets or sets the margins for the exported image.
   *
   * The margins are added to the content.
   * This means that an image with non-zero margins is larger than the export area even if the scale is 1.0.
   * The margins are not scaled. They are interpreted to be in units (pixels for bitmaps) for the resulting image.
   * The default is an empty margin.
   */
  margins?: {
    top: number
    right: number
    bottom: number
    left: number
  }

  /**
   * Gets or sets a value indicating whether all external images should be inlined and encoded as Base64 data URIs.
   * Note that this feature is not applicable when loading images from cross-origin sources.
   * The default is true.
   */
  inlineImages?: boolean
}

/**
 * Exports and saves the content of the graphComponent in an SVG file.
 * @throws Exception if the diagram cannot be exported.
 * The exception may occur when the diagram contains images from cross-origin sources.
 * In this case, disable {@link ExportSettings.inlineImages} and encode the icons manually to base64.
 */
export async function exportSvgAndSave(
  exportSettings: ExportSettings,
  graphComponent: GraphComponent,
  onRendered: (cb: () => void) => void,
  fileName: string = 'export.svg'
): Promise<void> {
  const svg = await exportSvg(exportSettings, graphComponent, onRendered)
  downloadFile(svg, fileName)
}

/**
 * Exports the graph using the SVG Export and renders the SVG as a PNG image.
 * @throws Exception if the diagram cannot be exported.
 * The exception may occur when the diagram contains images from cross-origin sources.
 * In this case, disable {@link ExportSettings.inlineImages} and encode the icons manually to base64.
 */
export async function exportImage(
  exportSettings: ExportSettings,
  graphComponent: GraphComponent,
  onRendered: (cb: () => void) => void
): Promise<Element> {
  const exporter = createSvgExporter(exportSettings, graphComponent)
  const exportComponent = await createExportGraphComponent(graphComponent)
  const svgElement = await exporter.exportSvgAsync(exportComponent)

  await new Promise<void>((resolve, reject) => {
    onRendered(resolve)
  })

  // collect all stylesheets - dom has to be ready to get them
  attachStyleSheets(svgElement, graphComponent.htmlElement)

  return renderSvgToPng(
    svgElement as SVGElement,
    exportSettings,
    new Size(exporter.viewWidth, exporter.viewHeight)
  )
}

/**
 * Exports the graph using the SVG Export, renders the SVG and saves it as a PNG image.
 * @throws Exception if the diagram cannot be exported.
 * The exception may occur when the diagram contains images from cross-origin sources.
 * In this case, disable {@link ExportSettings.inlineImages} and encode the icons manually to base64.
 */
export async function exportImageAndSave(
  exportSettings: ExportSettings,
  graphComponent: GraphComponent,
  onRendered: (cb: () => void) => void,
  fileName: string = 'graph.png'
): Promise<void> {
  const image = (await exportImage(exportSettings, graphComponent, onRendered)) as HTMLImageElement
  try {
    downloadFile(image.src, fileName)
  } catch (e) {
    alert('Saving directly to the filesystem is not supported by this browser.')
  }
}

async function renderSvgToPng(
  svgElement: SVGElement,
  exportSettings: ExportSettings,
  size: Size
): Promise<HTMLImageElement> {
  const margins = exportSettings.margins ?? Insets.from(5)
  await doEncodeImagesBase64(svgElement, exportSettings)
  SvgExport.exportSvgString(svgElement)
  const targetCanvas = document.createElement('canvas')
  const targetContext = targetCanvas.getContext('2d')!
  const svgString = SvgExport.exportSvgString(svgElement)
  const svgUrl = SvgExport.encodeSvgDataUrl(svgString)
  return new Promise(resolve => {
    // The SVG image is now used as the source of an HTML image element,
    // which is then rendered onto a Canvas element.

    // An image that gets the export SVG in the Data URL format
    const svgImage = new Image()
    svgImage.onload = (): void => {
      targetContext.clearRect(0, 0, targetCanvas.width, targetCanvas.height)
      targetCanvas.width = size.width + (margins.left + margins.right)
      targetCanvas.height = size.height + (margins.top + margins.bottom)

      targetContext.drawImage(svgImage, margins.left, margins.top)
      // When the svg image has been rendered to the Canvas,
      // the raster image can be exported from the Canvas.
      const pngImage = new Image()
      // The following 'toDataURL' function throws a security error in IE
      pngImage.src = targetCanvas.toDataURL('image/png')
      pngImage.onload = (): void => resolve(pngImage)
    }
    svgImage.src = svgUrl
  })
}

/**
 * Creates the svg exported needed for SVG and PNG export.
 */
function createSvgExporter(
  exportSettings: ExportSettings,
  graphComponent: GraphComponent
): SvgExport {
  return new SvgExport({
    // use null and collect all stylesheets later
    cssStyleSheet: null,
    inlineSvgImages: exportSettings.inlineImages ?? true,
    worldBounds: exportSettings.bounds ?? graphComponent.contentBounds,
    encodeImagesBase64: true,
    zoom: exportSettings.zoom ?? 1.0,
    scale: exportSettings.scale ?? 1.0,
    background: exportSettings.background,
    margins: exportSettings.margins ?? { top: 0, left: 0, bottom: 0, right: 0 }
  })
}

/**
 * Copies the original graph and creates the graphComponent used for the export.
 */
export async function createExportGraphComponent(
  graphComponent: GraphComponent
): Promise<GraphComponent> {
  const graphCopier = new GraphCopier()
  const targetGraph = new Graph()
  graphCopier.addEventListener('port-copied', event => {
    targetGraph.setStyle(event.copy, IPortStyle.VOID_PORT_STYLE)
  })
  graphCopier.copy(graphComponent.graph, targetGraph)

  const exportComponent = new GraphComponent()
  exportComponent.graph = targetGraph
  exportComponent.contentBounds = graphComponent.contentBounds
  exportComponent.zoom = graphComponent.zoom

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(exportComponent)
    }, 0)
  })
}

function decodeSvgDataUrl(body: string, base64: boolean) {
  if (base64) {
    // This method is (currently) only called with base64=true in IE when the XHR on a data url fails.
    // To properly support Unicode characters we would need to manually decode the binary string using the charset
    // of the data url. This is out of scope. As workaround, IE users should XML-escape non-latin1 characters before
    // encoding the images to base 64 (or URI-encode them instead).
    if (window['atob'] != undefined) {
      return window.atob(body)
    } else {
      return fromByteArray(fromBase64String(body))
    }
  } else {
    return window.decodeURIComponent(body)
  }
}

function doEncodeImagesBase64(element: Element, exportSettings: ExportSettings) {
  const allImages = element.querySelectorAll('image,img')
  const inlineImages = exportSettings.inlineImages ?? true

  const promises = []
  for (let i = 0; i < allImages.length; i++) {
    const imageElement = allImages[i]
    const isSvgImage = imageElement instanceof SVGImageElement

    const imageUrl = isSvgImage
      ? (imageElement as SVGImageElement).href.baseVal
      : (imageElement as HTMLImageElement).getAttribute('src')!

    const svgFileMatch = imageUrl.match('\\.svg$')
    if (svgFileMatch != null) {
      if (inlineImages) {
        promises.push(
          new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest()

            xhr.onreadystatechange = () => {
              if (xhr.readyState != XMLHttpRequest.DONE) {
                return
              }
              if (xhr.status == 200 || xhr.status == 0) {
                if (!xhr.responseText) {
                  let errorMessage = 'Could not encode the SVG image ' + imageUrl + ' as base64.'
                  if (xhr.statusText.length == 0) {
                    errorMessage +=
                      ' This may be due to a cross-origin exception. Please see the browser console for more information.'
                  } else {
                    errorMessage += '\nRequest status: ' + xhr.statusText
                  }
                  reject(new Exception(errorMessage))
                } else {
                  const encodeSvgDataUrl = SvgExport.encodeSvgDataUrl(xhr.responseText)
                  if (isSvgImage) {
                    ;(imageElement as SVGImageElement).href.baseVal = encodeSvgDataUrl
                  } else {
                    imageElement.setAttribute('src', encodeSvgDataUrl)
                  }
                  resolve()
                }
              }
            }
            xhr.open('GET', imageUrl, true)
            xhr.send()
          })
        )
      } else {
        const dataUrlMatch = imageUrl.match('^data:([^,...64]*),(.*?)$')
        if (dataUrlMatch != null) {
          const mimeType = dataUrlMatch[1]
          const isBase64 = dataUrlMatch[2] == ';base64'
          if (!isBase64 && inlineImages) {
            if (mimeType == 'image/svg+xml') {
              const svgXmlString = dataUrlMatch[3]
              const encodeSvgDataUrl = SvgExport.encodeSvgDataUrl(
                decodeSvgDataUrl(svgXmlString, false)
              )
              if (isSvgImage) {
                ;(imageElement as SVGImageElement).href.baseVal = encodeSvgDataUrl
              } else {
                ;(imageElement as HTMLImageElement).setAttribute('src', encodeSvgDataUrl)
              }
            }
          }
        } else {
          if (inlineImages) {
            // no data url, no svg file - so that's an external image...
            const image = document.createElement('img') as HTMLImageElement
            promises.push(
              new Promise<void>((resolve, reject) => {
                image.addEventListener(
                  'load',
                  () => {
                    const targetCanvas = document.createElement('canvas')
                    targetCanvas.width = image.width
                    targetCanvas.height = image.height
                    const context = targetCanvas.getContext('2d')!
                    context.drawImage(image, 0, 0)
                    try {
                      const dataUrl = targetCanvas.toDataURL()
                      if (isSvgImage) {
                        ;(imageElement as SVGImageElement).href.baseVal = dataUrl
                      } else {
                        ;(imageElement as HTMLImageElement).setAttribute('src', dataUrl)
                      }
                    } catch (e) {
                      reject(
                        new Exception(
                          'Could not encode the SVG image. This may be due to a cross-origin exception. Please see the browser console for more information.'
                        )
                      )
                      return
                    }
                    resolve()
                  },
                  false
                )
                image.addEventListener(
                  'error',
                  () => {
                    // No fallback image or exception here. The assumption is that if there is an image that is somehow rendered normally,
                    // we would never get to here, as it will also load in an img element. However, if it is somehow faulty
                    // (empty href, and a few others (cf. https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement#errors)
                    // we only see an empty image in the canvas, and that's also what we should export.
                    // So neither a fallback image nor a rejection, since the exported result is the same as what the users sees.
                    resolve()
                  },
                  false
                )
                image.src = imageUrl
              })
            )
          }
        }
      }
    }
  }
  return Promise.all(promises)
}

function fromByteArray(a: number[]) {
  let result = ''
  for (let i = 0; i < a.length; i++) {
    result += String.fromCharCode(a[i])
  }
  return result
}

function fromBase64String(base64: string) {
  const length = base64.length
  const bytes = []
  let padding = 0
  for (let i = 0; i < length; i += 4) {
    let byteBuffer = 0
    for (let j = 0; j < 4; j++) {
      let c = base64.charCodeAt(i + j)
      if (c > 0x40 && c < 0x5b) {
        c -= 0x41
      } else if (c > 0x60 && c < 0x7b) {
        c -= 71
      } else if (c > 0x2f && c < 0x3a) {
        c += 4
      } else if (c === 0x2b) {
        c = 0x3e
      } else if (c === 0x2f) {
        c = 0x3f
      } else if (c === 0x3d) {
        c = 0
        padding++
      } else {
        throw new Exception('Invalid Base64 String')
      }
      byteBuffer = byteBuffer << 6
      byteBuffer |= c
    }
    bytes.push((byteBuffer & 0x00ff0000) >> 16)
    if (padding < 2) {
      bytes.push((byteBuffer & 0x0000ff00) >> 8)
      if (padding === 0) {
        bytes.push(byteBuffer & 0x000000ff)
      }
    }
  }
  return bytes
}

function collectDocumentStyles(svgElement: Element, domElement: Element): string {
  let text = ''

  const styleSheetList = Array.from(document.styleSheets)
  const shadowRoot = domElement.getRootNode()
  if (shadowRoot && shadowRoot instanceof ShadowRoot) {
    styleSheetList.push(...shadowRoot.styleSheets)
    styleSheetList.push(...shadowRoot.adoptedStyleSheets)
  }

  if (typeof styleSheetList == 'undefined') {
    // document.styleSheets is experimental, but supported by all/most browsers
    return text
  }

  for (let i = 0; i < styleSheetList.length; i++) {
    const styleSheet = styleSheetList[i]
    // filter CORS stylesheets
    try {
      if (!styleSheet.cssRules) {
        continue
      }
    } catch {
      continue
    }

    for (let j = 0; j < styleSheet.cssRules.length; j++) {
      const cssRule = styleSheet.cssRules[j]
      if (ruleMatches(cssRule, svgElement)) {
        text += cssRule.cssText
      }
    }
  }
  return text
}

function ruleMatches(cssRule: CSSRule, svgElement: Element): boolean {
  const cssStyleRule = cssRule as CSSStyleRule
  if (
    cssRule.type !== CSSRule.STYLE_RULE ||
    typeof cssStyleRule.selectorText !== 'string' ||
    typeof cssRule.cssText !== 'string'
  ) {
    return false
  }
  return svgElement.querySelector(cssStyleRule.selectorText) != null
}

/**
 * Collects and attaches all necessary stylesheets to the exported svgElement.
 */
export function attachStyleSheets(svgElement: Element, domElement: Element) {
  const styleSheets = collectDocumentStyles(svgElement, domElement)
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.textContent = styleSheets
  svgElement.appendChild(style)
}
