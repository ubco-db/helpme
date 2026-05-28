'use client'

import { Avatar, Button, Card } from 'antd'
import { ReactElement, useState } from 'react'
import ChangeLogModal from './ChangeLogModal'
import PrivacyPolicyModal from './PrivacyPolicyModal'
import Meta from 'antd/es/card/Meta'
import { GithubOutlined, MailOutlined } from '@ant-design/icons'
import { FileLock, ScrollText } from 'lucide-react'

const AboutPageModals: React.FC = (): ReactElement => {
  const [isChangelogOpen, setIsChangelogOpen] = useState(false)
  const [isPrivacyPolicyOpen, setIsPrivacyPolicyOpen] = useState(false)
  return (
    <>
      <p className="flex items-center justify-center gap-4">
        <Button
          type="primary"
          size="large"
          onClick={() => setIsChangelogOpen(true)}
          icon={<ScrollText className="mt-1 p-[0.075rem]" />}
        >
          Changelog v{process.env.NEXT_PUBLIC_HELPME_VERSION}
        </Button>
        <Button
          type="primary"
          size="large"
          onClick={() => setIsPrivacyPolicyOpen(true)}
          icon={<FileLock className="mt-1 p-[0.075rem]" />}
        >
          Privacy Policy
        </Button>
      </p>
      <ChangeLogModal isOpen={isChangelogOpen} setIsOpen={setIsChangelogOpen} />
      <PrivacyPolicyModal
        isOpen={isPrivacyPolicyOpen}
        setIsOpen={setIsPrivacyPolicyOpen}
      />
    </>
  )
}

export default AboutPageModals
