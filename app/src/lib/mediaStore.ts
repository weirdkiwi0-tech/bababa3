const DB_NAME = 'harucheck.media.v1'
const STORE_NAME = 'files'
const memoryStore = new Map<string, File>()

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null)
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)

    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function saveMediaFiles(files: Array<{ id: string; file: File }>): Promise<void> {
  files.forEach(({ id, file }) => memoryStore.set(id, file))

  return openDatabase().then((database) => {
    if (!database || files.length === 0) {
      return
    }

    return new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)

      files.forEach(({ id, file }) => store.put(file, id))
      transaction.oncomplete = () => {
        database.close()
        resolve()
      }
      transaction.onerror = () => {
        database.close()
        reject(transaction.error)
      }
    })
  })
}

export function loadMediaFiles(ids: string[]): Promise<Record<string, File>> {
  const result: Record<string, File> = {}
  ids.forEach((id) => {
    const file = memoryStore.get(id)
    if (file) {
      result[id] = file
    }
  })

  return openDatabase().then((database) => {
    if (!database || ids.length === 0) {
      return result
    }

    return new Promise<Record<string, File>>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      let remaining = ids.length

      ids.forEach((id) => {
        const request = store.get(id)
        request.onsuccess = () => {
          if (request.result) {
            result[id] = request.result as File
          }
          remaining -= 1
          if (remaining === 0) {
            database.close()
            resolve(result)
          }
        }
        request.onerror = () => {
          database.close()
          reject(request.error)
        }
      })
    })
  })
}

export function deleteMediaFiles(ids: string[]): Promise<void> {
  ids.forEach((id) => memoryStore.delete(id))

  return openDatabase().then((database) => {
    if (!database || ids.length === 0) {
      return
    }

    return new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)

      ids.forEach((id) => store.delete(id))
      transaction.oncomplete = () => {
        database.close()
        resolve()
      }
      transaction.onerror = () => {
        database.close()
        reject(transaction.error)
      }
    })
  })
}