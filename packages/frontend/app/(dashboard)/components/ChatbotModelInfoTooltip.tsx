import { Progress, ProgressProps } from 'antd'

const scaleColors: ProgressProps['strokeColor'] = {
  '0%': '#108ee9',
  '100%': '#87d068',
}
const trailColor = '#cfcfcf'

const ChatbotModelInfoTooltip: React.FC<{
  speed: number
  quality: number
  additionalNotes?: string[]
}> = ({ speed, quality, additionalNotes }) => {
  return (
    <div>
      <div className="mr-2 flex w-full items-center justify-between gap-x-2">
        <div>Estimated Quality</div>
        <Progress
          percent={quality}
          size="small"
          steps={20}
          strokeColor={scaleColors}
          trailColor={trailColor}
          showInfo={false}
        />
      </div>
      <div className="mr-2 flex w-full items-center justify-between gap-x-2">
        <div>Estimated Speed</div>
        <Progress
          percent={speed}
          size="small"
          steps={20}
          strokeColor={scaleColors}
          trailColor={trailColor}
          showInfo={false}
        />
      </div>
      {additionalNotes && (
        <ul className="list-disc pl-4 leading-tight text-gray-100">
          {additionalNotes.map((note, index) => (
            <li key={index}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default ChatbotModelInfoTooltip
