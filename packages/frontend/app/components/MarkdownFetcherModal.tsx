import { Modal } from 'antd'
import { useEffect, useState } from 'react'
import MarkdownCustom from './Markdown'
import CenteredSpinner from './CenteredSpinner'

type MarkdownFilename =
  | 'changelog.md'
  | 'privacy_policy.md'
  | 'terms_of_service.md'

function getTitleForMarkdownFile(filename: MarkdownFilename) {
  switch (filename) {
    case 'changelog.md':
      return "What's New?"
    case 'privacy_policy.md':
      return 'Privacy Policy'
    case 'terms_of_service.md':
      return 'Terms of Service'
  }
}

interface MarkdownFetcherModalProps {
  filename: MarkdownFilename
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  onClose?: () => void
}

/* a <Modal> component that will fetch the filename (e.g. changelog.md) that exists inside /public that we want to fetch and display.
  Needs a button outside of this component to manage its open state.
*/
const MarkdownFetcherModal: React.FC<MarkdownFetcherModalProps> = ({
  filename,
  isOpen,
  setIsOpen,
  onClose,
}) => {
  const [currentMarkdownContent, setCurrentMarkdownContent] =
    useState<string>('')

  useEffect(() => {
    const fetchMarkdownContent = async () => {
      try {
        const response = await fetch(`/actually_public/${filename}`)
        const text = await response.text()
        setCurrentMarkdownContent(text)
      } catch (error) {
        console.error(
          `Failed to fetch ${getTitleForMarkdownFile(filename)}:`,
          error,
        )
      }
    }

    fetchMarkdownContent()
  }, [setCurrentMarkdownContent, filename])

  return (
    <Modal
      title={<h1>{getTitleForMarkdownFile(filename)}</h1>}
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
        {currentMarkdownContent === '' ? (
          <CenteredSpinner
            tip={`Fetching ${getTitleForMarkdownFile(filename)}...`}
          />
        ) : (
          <MarkdownCustom>{currentMarkdownContent}</MarkdownCustom>
        )}
      </div>
    </Modal>
  )
}
export default MarkdownFetcherModal
