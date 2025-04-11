import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { useState } from 'react'

interface FeedbackProps {
  courseId: number
  questionId: number // this is a helpme question id
}

export const Feedback: React.FC<FeedbackProps> = ({ courseId, questionId }) => {
  const [userScore, setUserScore] = useState(0)

  const handleClick = (newUserScore: number) => {
    const updatedUserScore = newUserScore == userScore ? 0 : newUserScore
    setUserScore(updatedUserScore) // immediately show the user score as updated, asynchronously update the backend
    API.chatbot.studentsOrStaff
      .updateUserScore(courseId, questionId, updatedUserScore)
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
        onClick={() => (userScore === -1 ? handleClick(0) : handleClick(-1))}
        className="cursor-pointer"
      />
      <ThumbsUp
        size={16}
        color="#1E38A8"
        fill={userScore === 1 ? '#1E38A8' : 'transparent'}
        onClick={() => (userScore === 1 ? handleClick(0) : handleClick(1))}
        className="cursor-pointer"
      />
    </div>
  )
}
