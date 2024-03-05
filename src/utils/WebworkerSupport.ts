let license: Record<string, unknown> | null = null

/**
 * Sets the license to be used for initializing web workers in {@link createWebworker}.
 */
export function setWebWorkerLicense(licensePar: Record<string, unknown>) {
  license = licensePar
}

/**
 * Creates a web worker and sends it a license message.
 * Returns a promise that resolves to the worker once the worker has sent
 * a 'licensed' message.
 *
 * Every worker should therefore include the following or similar code
 * at the beginning of its message handler:
 *
 * ```tsx
 * if (e.data.license) {
 *   License.value = e.data.license
 *   postMessage('licensed')
 *   return
 * }
 * ```
 *
 */
export function createWebWorker(url: URL): Promise<Worker> {
  if (license === null) {
    throw new Error('License not initialized.')
  }

  const worker = new Worker(url, {
    type: 'module'
  })

  return new Promise(resolve => {
    worker.onmessage = event => {
      if (event.data === 'ready') {
        worker.postMessage({
          license
        })
      } else if (event.data === 'licensed') {
        resolve(worker)
      }
    }
  })
}
