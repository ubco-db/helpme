import { useMemo } from 'react'

export const useParsedQuestion = (
  questionText: string | null | undefined,
): [string, string[]] => {
  return useMemo(() => {
    if (!questionText) {
      return ['', []]
    }
    let mainText = questionText
    let customTags: string[] = []
    if (questionText.includes('[Custom Tags]:')) {
      const parts = questionText.split('[Custom Tags]:')
      mainText = parts[0]
      const tagString = parts[1]
      customTags = tagString
        .trim()
        .split(' ')
        .map((t: string) => t.substring(1))
        .filter(Boolean)
    }
    return [mainText, customTags]
  }, [questionText])
}
