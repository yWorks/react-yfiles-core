import { GraphComponent, IEnumerable, Insets, Matrix, Point, Rect, Size, SvgExport } from 'yfiles'
import { attachStyleSheets, createExportGraphComponent } from './ExportSupport'
import '../styles/fonts.css'

export async function printDiagram(printSettings: PrintSettings, graphComponent: GraphComponent) {
  await print(printSettings, graphComponent)
}

// target page for printing
const printPage = `<!doctype html>
<html lang="en">
  <head>
    <link rel="stylesheet" type="text/css" href="../styles/fonts.css" />

    <style>
      .pagebreak {
        display: block;
        page-break-after: always;
      }
      /* this rule is needed to prevent that the hover effect is always visible */
      .hoverable {
        fill-opacity: 0;
      }
    </style>
  </head>
  <body>
    <script>
      window.opener.postMessage({message: 'print document loaded'})
      window.addEventListener(
        'message',
        (event) => {
          if (event.data?.message === 'print') {
            document.body.innerHTML = event.data.content
            
           // request some time to make sure that the graph is completely rendered before calling print
           requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
          }
        },
        false
      )
    </script>
  </body>
</html>
`

/**
 * Settings to configure how the graph is printed.
 */
export type PrintSettings = {
  /**
   * Gets or sets the scale for the printing.
   *
   * A scale of 1 preserves the original size, a scale of 0.5 results in a target image with half the original size and so on.
   * This value has to be strictly greater than 0 and finite. Its default value is 1.0
   */
  scale?: number

  /**
   * Gets or sets the bounds of the content to print in world coordinates.
   * The default behavior is to use bounds to encompass the whole diagram.
   */
  bounds?: {
    x: number
    y: number
    width: number
    height: number
  }

  /**
   * Gets or sets the margins for the printed image.
   *
   * The margins are added to the content.
   * This means that an image with non-zero margins is larger than the printed area even if the scale is 1.0.
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
   * Gets or sets to print the diagram in multiple pages if the content does not fit on a single page.
   * The default is false.
   */
  tiledPrinting?: boolean

  /**
   * Gets or sets the width of a single tile (page) in pt (1/72 inch), if {@link PrintSettings.tiledPrinting} is enabled.
   * The default width is 595.
   */
  tileWidth?: number

  /**
   * Gets or sets the height of a single tile (page) in pt (1/72 inch), if {@link PrintSettings.tiledPrinting} is enabled.
   * The default height is 842.
   */
  tileHeight?: number
}

/**
 * Prints the detail of the given GraphComponent's graph that is specified by either a
 * rectangle in world coordinates or a collection of world coordinate points which
 * define a bounding box in view coordinates.
 * If no `region` is specified, the complete graph is printed.
 */
async function print(printSettings: PrintSettings, graphComponent: GraphComponent): Promise<void> {
  const margins = printSettings.margins ?? Insets.from(0)
  const scale = printSettings.scale ?? 1
  const tiledPrinting = printSettings.tiledPrinting ?? false
  const tileWidth = printSettings.tileWidth ?? 595
  const tileHeight = printSettings.tileHeight ?? 842
  const projection = Matrix.IDENTITY
  const region = printSettings.bounds ?? null

  let targetRect: Rect
  if (region) {
    const rect = Rect.from(region)
    targetRect = getBoundsFromPoints(
      [rect.topLeft, rect.topRight, rect.bottomLeft, rect.bottomRight],
      projection
    )
  } else {
    targetRect = getBoundsFromPoints(
      graphComponent
        .getCanvasObjects(graphComponent.rootGroup)
        .map(co =>
          co.descriptor.getBoundsProvider(co.userObject).getBounds(graphComponent.canvasContext)
        )
        .filter(bounds => bounds.isFinite)
        .flatMap(bounds =>
          IEnumerable.from([bounds.topLeft, bounds.topRight, bounds.bottomLeft, bounds.bottomRight])
        ),
      projection
    )
  }

  let rows: number
  let columns: number
  let tiles: Point[][][]
  const invertedProjection = projection.clone()
  invertedProjection.invert()

  if (!tiledPrinting) {
    // no tiles - just one row and column
    rows = 1
    columns = 1
    tiles = [[getPointsForTile(targetRect, invertedProjection)]]
  } else {
    // get the size of the printed tiles
    const tileSize = new Size(tileWidth, tileHeight)
    const tileSizeScaled = new Size(tileSize.width / scale, tileSize.height / scale)

    // calculate number of rows and columns
    rows = Math.ceil((targetRect.height * scale) / tileSize.height)
    columns = Math.ceil((targetRect.width * scale) / tileSize.width)

    // calculate tile bounds
    tiles = []
    for (let i = 0; i < rows; i++) {
      const column: Point[][] = []
      for (let k = 0; k < columns; k++) {
        column.push(
          getPointsForTile(
            new Rect(
              targetRect.x + tileSizeScaled.width * k,
              targetRect.y + tileSizeScaled.height * i,
              tileSizeScaled.width,
              tileSizeScaled.height
            ),
            invertedProjection
          )
        )
      }
      tiles.push(column)
    }
    // calculate bounds of last row/column
    const lastX = targetRect.x + tileSizeScaled.width * (columns - 1)
    const lastY = targetRect.y + tileSizeScaled.height * (rows - 1)
    const lastWidth = targetRect.width - tileSizeScaled.width * (columns - 1)
    const lastHeight = targetRect.height - tileSizeScaled.height * (rows - 1)
    // set bounds of last row
    for (let k = 0; k < columns - 1; k++) {
      tiles[rows - 1][k] = getPointsForTile(
        new Rect(targetRect.x + tileSizeScaled.width * k, lastY, tileSizeScaled.width, lastHeight),
        invertedProjection
      )
    }
    // set bounds of last column
    for (let i = 0; i < rows - 1; i++) {
      tiles[i][columns - 1] = getPointsForTile(
        new Rect(lastX, targetRect.y + tileSizeScaled.height * i, lastWidth, tileSizeScaled.height),
        invertedProjection
      )
    }
    // set bounds of bottom right tile
    tiles[rows - 1][columns - 1] = getPointsForTile(
      new Rect(lastX, lastY, lastWidth, lastHeight),
      invertedProjection
    )
  }

  let resultingHTML = ''
  // loop through all rows and columns
  for (let i = 0; i < rows; i++) {
    for (let k = 0; k < columns; k++) {
      const lastRow = i === rows - 1
      const lastColumn = k === columns - 1

      const exportComponent = await createExportGraphComponent(graphComponent)
      const exporter = new SvgExport({
        worldBounds: Rect.EMPTY, // dummy rectangle that's overwritten by worldPoints below
        worldPoints: tiles[i][k],
        scale,
        copyDefsElements: true,
        encodeImagesBase64: true,
        inlineSvgImages: true,
        projection,
        cssStyleSheet: null,
        zoom: exportComponent.zoom
      })
      configureMargin(exporter, i === 0, lastRow, k === 0, lastColumn, margins, tiledPrinting)

      if (!lastRow || !lastColumn) {
        resultingHTML += "<div class='pagebreak'>"
      } else {
        resultingHTML += '<div>'
      }

      // export the svg to an XML string
      const svgElement = await exporter.exportSvgAsync(exportComponent)

      setTimeout(() => {
        // collect all stylesheets - dom has to be ready to get them
        attachStyleSheets(svgElement, graphComponent.div)
        resultingHTML += SvgExport.exportSvgString(svgElement)
      }, 0) //todo check if there is a better way to remove this

      resultingHTML += '</div>'
    }
  }

  const URL = window.location.href + '/printdocument.html'
  const printWindow = window.open(URL)
  if (printWindow) {
    printWindow.document.write(printPage)
    window.addEventListener(
      'message',
      event => {
        if (event.data?.message === 'print document loaded') {
          printWindow.postMessage({ message: 'print', content: resultingHTML })
        }
      },
      false
    )
  } else {
    alert('Could not open print preview window - maybe it was blocked?')
  }
}

// Returns the corners of the tile, projected back to world coordinates
function getPointsForTile(bounds: Rect, invertedProjection: Matrix): Point[] {
  return [
    invertedProjection.transform(bounds.topLeft),
    invertedProjection.transform(bounds.topRight),
    invertedProjection.transform(bounds.bottomRight),
    invertedProjection.transform(bounds.bottomLeft)
  ]
}

// Returns the projected bounding box for the given points
function getBoundsFromPoints(points: Iterable<Point>, projection: Matrix) {
  let bounds = Rect.EMPTY
  for (const p of points) {
    bounds = bounds.add(projection.transform(p))
  }
  return bounds
}

function configureMargin(
  exporter: SvgExport,
  firstRow: boolean,
  lastRow: boolean,
  firstColumn: boolean,
  lastColumn: boolean,
  margins: { top: number; bottom: number; left: number; right: number },
  tiledPrinting: boolean
): void {
  if (!tiledPrinting) {
    // set margin if we don't print tiles
    exporter.margins = margins
  } else {
    // for tile printing, set margin only for border tiles
    const top = firstRow ? margins.top : 0
    const bottom = lastRow ? margins.bottom : 0
    const right = lastColumn ? margins.right : 0
    const left = firstColumn ? margins.left : 0

    exporter.margins = new Insets(left, top, right, bottom)
  }
}
