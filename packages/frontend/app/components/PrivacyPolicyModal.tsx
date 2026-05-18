import { Modal } from 'antd'
import { useEffect, useState } from 'react'
import MarkdownCustom from './Markdown'
import CenteredSpinner from './CenteredSpinner'

interface PrivacyPolicyModalProps {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  onClose?: () => void
}

const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({
  isOpen,
  setIsOpen,
  onClose,
}) => {
  const [currentPrivacyPolicy, setCurrentPrivacyPolicy] = useState<string>('')

  useEffect(() => {
    const fetchPrivacyPolicy = async () => {
      try {
        const response = await fetch('/privacy_policy.md')
        const text = await response.text()
        setCurrentPrivacyPolicy(text)
      } catch (error) {
        console.error('Failed to fetch privacy policy:', error)
      }
    }

    fetchPrivacyPolicy()
  }, [setCurrentPrivacyPolicy])

  return (
    <Modal
      title={<h1>Privacy Policy</h1>}
      open={isOpen}
      closable
      footer={null}
      onCancel={() => {
        setIsOpen(false)
        onClose?.()
      }}
      width={{
        xs: '90%',
        sm: '85%',
        md: '80%',
        lg: '75%',
        xl: '70%',
        xxl: '65%',
      }}
      classNames={{
        header: 'flex items-center justify-center',
      }}
      className="box-border flex flex-col items-center justify-center"
    >
      <div className="childrenMarkdownFormatted box-border h-[60vh] w-full overflow-y-auto px-4 md:h-[75vh]">
        {currentPrivacyPolicy === '' ? (
          <CenteredSpinner tip="Fetching Privacy Policy..." />
        ) : (
          <MarkdownCustom>{currentPrivacyPolicy}</MarkdownCustom>
        )}
      </div>
    </Modal>
  )
}
export default PrivacyPolicyModal
