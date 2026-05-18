import { Progress } from 'antd'

type FeedbackGradeProps = {
  grade?: number,
  size?: 'small' | 'default'
}

const FeedbackGrade: React.FC<FeedbackGradeProps> = ({
  grade,
  size = 'small'
}) => {
  return (
    <Progress
      size={size}
      type="circle"
      format={percent => grade != undefined ? `${percent}%` : 'N/A'}
      percent={grade ? grade : 0}
      strokeColor={grade != undefined ? '#03fc0f' : '#828282'}
    />
  )
}

export default FeedbackGrade