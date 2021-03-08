import type { Storage, StorageProvider } from './types'
import { memoryStorage } from './providers'
import { normalizeKey, asyncCall } from './utils'

export function createStorage (): Storage {
  const defaultStorage = memoryStorage()

  // TODO: refactor to SortedMap / SortedMap
  const mounts: Record<string, StorageProvider> = {}
  const mountKeys: string[] = [] // sorted keys of mounts

  const getAllProviders = () => [defaultStorage, ...Object.values(mounts)]

  const getProvider = (key: string) => {
    key = normalizeKey(key)
    for (const base of mountKeys) {
      if (key.startsWith(base)) {
        return {
          provider: mounts[base],
          key: key.substr(base.length)
        }
      }
    }
    return {
      provider: defaultStorage,
      key
    }
  }

  const storage: Storage = {
    hasItem (_key) {
      const { key, provider } = getProvider(_key)
      return asyncCall(provider.hasItem, key)
    },
    getItem (_key) {
      const { key, provider } = getProvider(_key)
      return asyncCall(provider.getItem, key)
    },
    setItem (_key, vlaue) {
      const { key, provider } = getProvider(_key)
      return asyncCall(provider.setItem, key, vlaue)
    },
    removeItem (_key) {
      const { key, provider } = getProvider(_key)
      return asyncCall(provider.removeItem, key)
    },
    async getKeys () {
      const providerKeys = await Promise.all(getAllProviders().map(s => asyncCall(s.getKeys)))
      return providerKeys.flat().map(normalizeKey)
    },
    async clear () {
      await Promise.all(getAllProviders().map(s => asyncCall(s.clear)))
    },
    async dispose () {
      await Promise.all(getAllProviders().map(s => disposeStoage(s)))
    },
    mount (base, provider) {
      base = normalizeKey(base)
      if (!mountKeys.includes(base)) {
        mountKeys.push(base)
        mountKeys.sort((a, b) => b.length - a.length)
      }
      if (mounts[base]) {
        if (mounts[base].dispose) {
          // eslint-disable-next-line no-console
          disposeStoage(mounts[base]!).catch(console.error)
        }
        delete mounts[base]
      }
      mounts[base] = provider
    }
  }
  return storage
}

async function disposeStoage (storage: StorageProvider) {
  if (typeof storage.dispose === 'function') {
    await asyncCall(storage.dispose)
  }
}
