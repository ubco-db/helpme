import * as React from 'react'

/**
 *  A hook that returns whether or not a media query is currently matched.
 *  This is useful when you need to remove elements from the DOM based on screen size (and you can't use `sm:hidden block` and `sm:block hidden` with tailwind classNames to hide it with css).
 * @param query a media query string (e.g. `(min-width: 768px)`)
 * @returns whether or not the media query is currently matched
 */
export function useMediaQuery(query: string) {
  const [value, setValue] = React.useState(false)

  React.useEffect(() => {
    function onChange(event: MediaQueryListEvent) {
      setValue(event.matches)
    }

    const result = matchMedia(query)
    result.addEventListener('change', onChange)
    setValue(result.matches)

    return () => result.removeEventListener('change', onChange)
  }, [query])

  return value
}
