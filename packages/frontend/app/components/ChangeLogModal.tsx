import { Modal } from 'antd'
import { useEffect, useState } from 'react'
import MarkdownCustom from './Markdown'

interface ChangeLogModalProps {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}

const ChangeLogModal: React.FC<ChangeLogModalProps> = ({
  isOpen,
  setIsOpen,
}) => {
  const [currentChangeLog, setCurrentChangeLog] = useState<string>('')

  useEffect(() => {
    const fetchChangelog = async () => {
      try {
        const response = await fetch('/changelog.md')
        const text = await response.text()
        setCurrentChangeLog(text)
      } catch (error) {
        console.error('Failed to fetch changelog:', error)
      }
    }

    fetchChangelog()
  }, [setCurrentChangeLog])

  return (
    <Modal
      title={<h1>What&apos;s New?</h1>}
      open={isOpen}
      closable
      footer={null}
      onCancel={() => setIsOpen(false)}
      width="auto"
      classNames={{
        header: 'flex items-center justify-center',
      }}
      className="box-border flex flex-col items-center justify-center overflow-y-auto"
    >
      <div className="childrenMarkdownFormatted box-border h-[75vh] w-full overflow-y-auto px-4">
        <MarkdownCustom>{currentChangeLog}</MarkdownCustom>
      </div>
    </Modal>
  )
}
export default ChangeLogModal
