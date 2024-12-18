import ChangeLogModal from '@/app/components/ChangeLogModal'
import { useState } from 'react'

const FooterBar: React.FC = () => {
  const [isChangelogOpen, setIsChangelogOpen] = useState(false)

  return (
    // Hide footer on mobile since screen space is more valuable
    <footer
      className="mt-auto hidden w-full justify-between bg-[#ebebeb] px-6 py-1.5 text-xs md:flex"
      aria-hidden="true"
    >
      <div>
        Version 2.0.0{' '}
        <a
          className="ml-1 cursor-pointer text-blue-600 underline"
          onClick={() => {
            setIsChangelogOpen(true)
          }}
        >
          What&apos;s new?
        </a>
        <ChangeLogModal
          isOpen={isChangelogOpen}
          setIsOpen={setIsChangelogOpen}
        />
      </div>
      <div>
        Found a bug? Have a suggestion? We welcome your feedback:
        <a
          href="mailto:adam.fipke@ubc.ca"
          className="ml-1 text-blue-600 underline"
        >
          adam.fipke@ubc.ca
        </a>
      </div>
    </footer>
  )
}

export default FooterBar
