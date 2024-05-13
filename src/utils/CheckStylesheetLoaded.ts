import { isProd } from './DevMode.ts'

export function checkStylesheetLoaded(root: HTMLElement, name: string) {
  //@ts-ignore
  if (!isProd && !window['skip-react-yfiles-css-check']) {
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
        `Stylesheet not loaded! Please import 'dist/index.css' from the @yworks/${name} package:`
      )
      displayCssWarning(root!, name)
    }
    dummy.remove()
  }
}

function displayCssWarning(root: HTMLElement, componentName: string) {
  if (root.getAttribute('cssWarningAdded')) {
    return
  }
  const warning = document.createElement('div')
  warning.innerHTML = `<div
  style="user-select: text; position:absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: Roboto, sans-serif;">
  <div
    style="max-width: 700px; padding: 20px; border: 1px solid #ccc; border-radius: 8px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); background-color: #f1f5f9; color: #334155; overflow-y: auto; text-align: left;">
    <div style="font-size: 20px; font-weight: bold; margin-bottom: 10px; display: flex">Missing CSS
      <button class="cssWarningClose" style="margin-left: auto">X</button>
    </div>
    <div style="margin: 2ex 0;"> The required CSS stylesheet could not be detected.<br>
      Please import <code>'dist/index.css'</code> from the 
      <code style="white-space: nowrap">@yworks/${componentName}</code>
      package.
    </div>
    <div style="background-color: #ffffff; padding: 0 10px; border-radius: 4px; overflow-x: auto;">
      <pre>import '@yworks/${componentName}/dist/index.css'</pre>
    </div>
  </div>
</div> 
`

  warning.addEventListener('mousedown', e => e.stopPropagation(), true)
  warning.querySelector('.cssWarningClose')!.addEventListener('click', e => warning.remove())
  root.appendChild(warning)
  root.setAttribute(`cssWarningAdded`, 'true')
}
