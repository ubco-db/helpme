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
import { OrganizationRole } from '../typings/user'
import { SelfAvatar } from './UserAvatar'
import { useCourse } from '../hooks/useCourse'
import { getRoleInCourse } from '../utils/generalUtils'
import { Role } from '@koh/common'

/**
 * This custom Link is wrapped around nextjs's Link to improve accessibility and styling. Not to be used outside of this navigation menu.
 */
const Link = ({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: React.ReactNode
}) => {
  const pathname = usePathname()
  const isActive = href === pathname

  return (
    <NavigationMenuLink asChild active={isActive}>
      <NextLink
        href={href}
        className={className + ' ' + navigationMenuTriggerStyle()}
      >
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
  const pathname = usePathname()
  const URLSegments = pathname.split('/')
  const courseId =
    URLSegments[1] === 'course' && URLSegments[2] && Number(URLSegments[2])
      ? Number(URLSegments[2])
      : null
  const { course } = useCourse(courseId)
  const role = courseId ? getRoleInCourse(userInfo, courseId) : null

  return (
    <NavigationMenu>
      <NavigationMenuList>
        {course ? (
          <>
            <NextLink
              href={`/course/${courseId}`}
              aria-hidden="true"
              tabIndex={-1}
            >
              <Image
                width={48}
                height={48}
                className="h-12 w-full object-contain"
                alt="Organization Logo"
                src={`https://ires.ubc.ca/files/2020/02/ubc-logo.png`}
              />
            </NextLink>
            <NavigationMenuItem>
              <Link className="!font-bold" href={`/course/${courseId}`}>
                {course.name}
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link href={`/course/${courseId}/queue`}>Queues</Link>
            </NavigationMenuItem>
            {(role === Role.TA || role === Role.PROFESSOR) && (
              <NavigationMenuItem>
                <Link href={`/course/${courseId}/admin`}>Admin Panel</Link>
              </NavigationMenuItem>
            )}
            {role === Role.PROFESSOR && (
              <NavigationMenuItem>
                <Link href={`/course/${courseId}/insights`}>Insights</Link>
              </NavigationMenuItem>
            )}
            <NavigationMenuItem>
              <Link href={`/courses`}>
                My Courses
                <span aria-hidden="true" className="pb-0.5 text-lg">
                  &nbsp;&nbsp;&gt;
                </span>
              </Link>
            </NavigationMenuItem>
          </>
        ) : (
          <>
            <NavigationMenuItem>
              {userInfo?.organization && (
                <NextLink href="/courses" aria-hidden="true" tabIndex={-1}>
                  <Image
                    width={48}
                    height={48}
                    className="h-12 w-full object-contain"
                    alt="Organization Logo"
                    src={`https://ires.ubc.ca/files/2020/02/ubc-logo.png`}
                  />
                </NextLink>
              )}
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link href="/courses">Courses</Link>
            </NavigationMenuItem>
            {userInfo?.organization?.organizationRole ===
              OrganizationRole.ADMIN && (
              <NavigationMenuItem>
                <Link href="/organization/settings">Organization Settings</Link>
              </NavigationMenuItem>
            )}
          </>
        )}
        <NavigationMenuItem>
          <Link href="/profile">
            <SelfAvatar size={50} />
          </Link>
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
