let license: Record<string, unknown> | null = null

/**
 * Sets the license to be used for initializing web workers in {@link createWebworker}.
 */
export function setWebWorkerLicense(licensePar: Record<string, unknown>) {
  license = licensePar
}

/**
 * Waits for the Web Worker to ready up and sends the license to it.
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
export function registerWebWorker(worker: Worker): Promise<Worker> {
  if (license === null) {
    throw new Error('License not initialized.')
  }

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

    // check if worker is already alive and ready, e.g. when switching between component instances
    // with and without worker support, but without terminating the worker
    worker.postMessage('check-is-ready')
  })
}
