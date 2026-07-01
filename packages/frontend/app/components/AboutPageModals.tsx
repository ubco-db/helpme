'use client'

import { Button } from 'antd'
import { ReactElement, useState } from 'react'
import { FileLock, Handshake, ScrollText } from 'lucide-react'
import MarkdownFetcherModal from './MarkdownFetcherModal'

/* needed to put this into its own file so it becomes a client component that can be put inside server components */
const AboutPageModals: React.FC = (): ReactElement => {
  const [isChangelogOpen, setIsChangelogOpen] = useState(false)
  const [isPrivacyPolicyOpen, setIsPrivacyPolicyOpen] = useState(false)
  const [isTermsOfServiceOpen, setIsTermsOfServiceOpen] = useState(false)
  return (
    <>
      <p className="flex flex-wrap items-center justify-center gap-4">
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
        <Button
          type="primary"
          size="large"
          onClick={() => setIsTermsOfServiceOpen(true)}
          icon={<Handshake className="mt-1 p-[0.075rem]" />}
        >
          Terms of Service
        </Button>
      </p>
      <MarkdownFetcherModal
        filename="changelog.md"
        isOpen={isChangelogOpen}
        setIsOpen={setIsChangelogOpen}
      />
      <MarkdownFetcherModal
        filename="privacy_policy.md"
        isOpen={isPrivacyPolicyOpen}
        setIsOpen={setIsPrivacyPolicyOpen}
      />
      <MarkdownFetcherModal
        filename="terms_of_service.md"
        isOpen={isTermsOfServiceOpen}
        setIsOpen={setIsTermsOfServiceOpen}
      />
    </>
  )
}

export default AboutPageModals
