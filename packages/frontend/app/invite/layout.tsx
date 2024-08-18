import { LayoutProps } from '@/app/typings/types'

// While it may seem unnecessary to have this layout.tsx, it causes hydration errors without one
const Layout: React.FC<LayoutProps> = ({ children }) => {
  return <main>{children}</main>
}

export default Layout
