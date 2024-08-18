import StandardPageContainer from '@/app/components/StandardPageContainer'
import { LayoutProps } from 'antd'

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <StandardPageContainer>
      <div className="mx-auto mt-10 w-full">{children}</div>
    </StandardPageContainer>
  )
}

export default Layout
