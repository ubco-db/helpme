const FooterBar: React.FC = () => {
  return (
    // Hide footer on mobile since screen space is more valuable
    <footer
      className="mt-auto hidden w-full justify-end bg-[#ebebeb] px-6 py-1.5 text-xs md:flex"
      aria-hidden="true"
    >
      Found a bug? Have a suggestion? We welcome your feedback:
      <a
        href="mailto:adam.fipke@ubc.ca"
        className="ml-1 text-blue-600 underline"
      >
        adam.fipke@ubc.ca
      </a>
    </footer>
  )
}

export default FooterBar
