'use client'

import React from 'react'
import Image from 'next/image'
import { useUserInfo } from '@/app/contexts/userContext'
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from '@/app/components/ui/navigation-menu'

import { usePathname } from 'next/navigation'
import NextLink from 'next/link'

/**
 * This custom Link is wrapped around nextjs's Link to improve accessibility and styling. Not to be used outside of this navigation menu.
 */
const Link = ({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) => {
  const pathname = usePathname()
  const isActive = href === pathname

  return (
    <NavigationMenuLink asChild active={isActive}>
      <NextLink href={href} className={navigationMenuTriggerStyle()}>
        {children}
      </NextLink>
    </NavigationMenuLink>
  )
}

/**
 * Navbar component that is rendered on each page.
 */
const Navbar: React.FC = () => {
  const { userInfo } = useUserInfo()

  return (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          {userInfo?.organization && (
            <a href="/courses" aria-hidden="true" tabIndex={-1}>
              <Image
                width={48}
                height={48}
                className="h-12 w-full object-contain"
                alt="Organization Logo"
                src={`https://ires.ubc.ca/files/2020/02/ubc-logo.png`}
              />
            </a>
          )}
        </NavigationMenuItem>
        <NavigationMenuItem>
          <Link href="/courses">Courses</Link>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <Link href="/organization/settings">Organization Settings</Link>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )

  // return (
  //   <div className="my-1 flex h-16 items-center p-0">
  //     <div className="mr-5 flex items-center">
  //       <div className="color-[#262626] flex items-center align-middle text-xl font-medium capitalize">
  //         {userInfo?.organization && (
  //           <a href="/courses" aria-hidden="true" tabIndex={-1}>
  //             <Image
  //               width={100}
  //               height={100}
  //               className="h-16 w-full object-contain"
  //               alt="Organization Logo"
  //               src={`https://ires.ubc.ca/files/2020/02/ubc-logo.png`}
  //             />
  //           </a>
  //         )}
  //         <span className="ml-x">
  //           {userInfo?.organization?.organizationName}
  //         </span>
  //       </div>
  //     </div>
  //   </div>
  // )
}

export default Navbar
