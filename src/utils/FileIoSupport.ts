/**
 * Downloads the given content as a file.
 * @param content - The file content.
 * @param filename - The proposed filename.
 * @param contentType - An optional content type for the download.
 */
export function downloadFile(content: string, filename: string, contentType?: string): void {
  const type = contentType ?? determineContentType(filename)
  const objectURL = URL.createObjectURL(createBlob(content, type))

  const aElement = document.createElement('a')
  aElement.setAttribute('href', objectURL)
  aElement.setAttribute('download', filename)
  aElement.style.display = 'none'
  document.body.appendChild(aElement)
  aElement.click()
  document.body.removeChild(aElement)
}

function createBlob(content: string, type: string) {
  switch (type) {
    case 'application/pdf': {
      const uint8Array = new Uint8Array(content.length)
      for (let i = 0; i < content.length; i++) {
        uint8Array[i] = content.charCodeAt(i)
      }
      return new Blob([uint8Array], { type })
    }
    case 'application/png': {
      const dataUrlParts = content.split(',')
      const bString = window.atob(dataUrlParts[1])
      const byteArray = []
      for (let i = 0; i < bString.length; i++) {
        byteArray.push(bString.charCodeAt(i))
      }
      return new Blob([new Uint8Array(byteArray)], { type })
    }
    default:
      return new Blob([content], { type })
  }
}

/**
 * Returns the file extension of the given {@link filename}.
 * This is the filename part after the last dot.
 */
export function getFileExtension(filename: string | undefined): string | undefined {
  return filename?.match(/\.(?<extension>\w+)$/)?.groups?.extension
}

/**
 * Determines the content type of the given {@link filename} based on the file extension.
 * This implementation only knows some extensions that are used in the demos.
 */
export function determineContentType(filename: string): string {
  const knownTypes: Record<string, string | undefined> = {
    graphml: 'application/graphml+xml',
    json: 'application/json',
    pdf: 'application/pdf',
    png: 'application/png',
    svg: 'image/svg+xml',
    txt: 'text/plain'
  }
  const extension = getFileExtension(filename)?.toLowerCase() ?? ''
  return knownTypes[extension] ?? 'text/plain'
}
