import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import React, { useState } from 'react'

interface FeedbackProps {
  questionId: number
}

export const Feedback: React.FC<FeedbackProps> = ({ questionId }) => {
  const [userScore, setUserScore] = useState(0)

  const handleClick = (newUserScore: number) => {
    const updatedUserScore = newUserScore == userScore ? 0 : newUserScore
    setUserScore(updatedUserScore)
    API.chatbot
      .editQuestion({
        userScore: updatedUserScore,
        id: questionId,
      })
      .catch((error) => {
        const errorMessage = getErrorMessage(error)
        console.log('Error updating user score:', errorMessage)
      })
  }

  return (
    <div className="flex gap-2">
      <ThumbsDown
        size={16}
        color="#1E38A8"
        fill={userScore === -1 ? '#1E38A8' : 'transparent'}
        onClick={() => handleClick(-1)}
        className="cursor-pointer"
      />
      <ThumbsUp
        size={16}
        color="#1E38A8"
        fill={userScore === 1 ? '#1E38A8' : 'transparent'}
        onClick={() => handleClick(1)}
        className="cursor-pointer"
      />
    </div>
  )
}
