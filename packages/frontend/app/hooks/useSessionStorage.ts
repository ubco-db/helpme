import { Dispatch, SetStateAction, useState } from 'react'

const isWindow = typeof window !== 'undefined'

export function useSessionStorage<T>(
  key: string,
  initialValue: T | null,
): [
  T | null,
  Dispatch<SetStateAction<T | null>>,
  Dispatch<SetStateAction<void>>,
] {
  const [storedValue, setStoredValue] = useState<T | null>(() => {
    try {
      const item = isWindow && window.sessionStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error(error)
      return initialValue
    }
  })

  const setValue: Dispatch<SetStateAction<T | null>> = (value) => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)

      if (isWindow) {
        window.sessionStorage.setItem(key, JSON.stringify(valueToStore))
      }
    } catch (error) {
      console.error(error)
    }
  }

  const removeValue = () => {
    try {
      setStoredValue(null)

      if (isWindow) {
        window.sessionStorage.removeItem(key)
      }
    } catch (error) {
      console.error(error)
    }
  }

  return [storedValue, setValue, removeValue]
}
