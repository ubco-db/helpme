import { useState, Dispatch, SetStateAction } from 'react'

const isWindow = typeof window !== 'undefined'

export function useLocalStorage<T>(
  key: string,
  initialValue: T | null,
): [
  T | null,
  Dispatch<SetStateAction<T | null>>,
  Dispatch<SetStateAction<void>>,
] {
  const [storedValue, setStoredValue] = useState<T | null>(() => {
    try {
      const item = isWindow && window.localStorage.getItem(key)
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
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      }
    } catch (error) {
      console.error(error)
    }
  }

  const removeValue = () => {
    try {
      setStoredValue(null)

      if (isWindow) {
        window.localStorage.removeItem(key)
      }
    } catch (error) {
      console.error(error)
    }
  }

  return [storedValue, setValue, removeValue]
}
