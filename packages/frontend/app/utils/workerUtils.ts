'use client'

const workerInstances: { [key: string]: SharedWorker } = {}

export function getWorker(file: string) {
  if (typeof window === 'undefined') {
    return null
  }

  if (!workerInstances[file]) {
    workerInstances[file] = new SharedWorker(
      new URL(
        `${process.env.NEXT_PUBLIC_HOST_PROTOCOL}://${process.env.NEXT_PUBLIC_HOSTNAME}${process.env.NEXT_PUBLIC_HOSTNAME === 'localhost' && process.env.NEXT_PUBLIC_DEV_PORT ? `:${process.env.NEXT_PUBLIC_DEV_PORT}` : ''}${file}`,
      ),
    )
  }

  const worker = workerInstances[file]
  worker.port.start()

  return worker
}

export function stopWorker(file: string) {
  if (workerInstances[file]) {
    workerInstances[file].port.close()
  }
}
