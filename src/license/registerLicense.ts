import { DefaultGraph, License } from 'yfiles'
import { setWebWorkerLicense } from '../utils/WebworkerSupport.ts'

/**
 * Registers the [yFiles license]{@link http://docs.yworks.com/yfileshtml/#/dguide/licensing} which is needed to
 * use the yFiles React component.
 *
 * ```tsx
 * function App() {
 *   registerLicense(yFilesLicense)
 *
 *   return (
 *     <OrgChart data={data}></OrgChart>
 *   )
 * }
 * ```
 *
 * @param licenseKey - The license key to register
 */
export function registerLicense(licenseKey: Record<string, unknown>) {
  License.value = licenseKey
  setWebWorkerLicense(licenseKey)
}

/**
 * Checks whether there is a valid yfiles license registered.
 */
export function checkLicense(): boolean {
  const g = new DefaultGraph()
  g.createNode()
  return g.nodes.size === 1
}
