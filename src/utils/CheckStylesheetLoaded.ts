import { isProd } from './DevMode.ts'

export function checkStylesheetLoaded(root: HTMLElement | null, name: string) {
  if (!isProd) {
    const dummy = document.createElement('div')
    dummy.id = `${name}-stylesheet-detection`
    const rootNode = root?.getRootNode() ?? document
    const parent = rootNode === document ? document.body : rootNode
    parent.appendChild(dummy)
    const computedStyle = getComputedStyle(dummy)
    const hasStyle =
      computedStyle.getPropertyValue('--yfiles-react-stylesheet-detection') ===
      `${name}-stylesheet-detection`

    if (!hasStyle) {
      console.warn(
        `Stylesheet not loaded! Please import 'dist/index.css' from the @yworks/${name} package.`
      )
    }
    dummy.remove()
  }
}
