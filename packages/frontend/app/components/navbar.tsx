'use client'

import React from 'react'
import Image from 'next/image'
import { useUserInfo } from '@/app/contexts/userContext'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
  navigationMenuTriggerStyleForSubMenu,
} from '@/app/components/ui/navigation-menu'
import { orderBy } from 'lodash'
import { usePathname } from 'next/navigation'
import NextLink from 'next/link'
import { OrganizationRole } from '../typings/user'
import { SelfAvatar } from './UserAvatar'
import { useCourse } from '../hooks/useCourse'
import { cn, getRoleInCourse } from '../utils/generalUtils'
import { Role } from '@koh/common'

/**
 * This custom Link is wrapped around nextjs's Link to improve accessibility and styling. Not to be used outside of this navigation menu.
 */
const Link = ({
  ref,
  href,
  className,
  children,
  isSubMenuLink,
}: {
  ref?: React.Ref<HTMLAnchorElement>
  href: string
  className?: string
  children: React.ReactNode
  isSubMenuLink?: boolean
}) => {
  const pathname = usePathname()
  const isActive = href === pathname

  return (
    <NavigationMenuLink ref={ref} asChild active={isActive}>
      <NextLink
        href={href}
        className={
          (isSubMenuLink
            ? navigationMenuTriggerStyleForSubMenu()
            : navigationMenuTriggerStyle()) +
          ' ' +
          className
        }
      >
        {children}
      </NextLink>
    </NavigationMenuLink>
  )
}

const ListItem = React.forwardRef<
  React.ElementRef<'a'>,
  React.ComponentPropsWithoutRef<'a'> & { title: string; href: string }
>(({ className, title, children, href, ...props }, ref) => {
  return (
    <li>
      <Link
        ref={ref}
        href={href}
        className={cn(
          'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors',
          className,
        )}
        isSubMenuLink={true}
        {...props}
      >
        <div className="text-sm font-medium leading-none">{title}</div>
        <p className="text-muted-foreground line-clamp-2 text-sm leading-snug">
          {children}
        </p>
      </Link>
    </li>
  )
})
ListItem.displayName = 'ListItem'

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
  // only show open queues, sorted by name
  const openQueues =
    orderBy(
      course?.queues?.filter((queue) => queue.isOpen),
      ['room'],
      ['asc'],
    ) ?? []

  return (
    <NavigationMenu className="bg-white">
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
              <NavigationMenuTrigger>Queues</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px] ">
                  {openQueues.map((queue) => (
                    <ListItem
                      key={queue.id}
                      title={queue.room}
                      href={`/course/${courseId}/queue/${queue.id}`}
                    >
                      <>
                        {`${queue.staffList.length > 0 ? `${queue.staffList.length} staff checked in` : '1 staff checked in'}`}
                        <br />
                        {`${queue.queueSize > 0 ? `${queue.queueSize} students in queue` : ''}`}
                      </>
                    </ListItem>
                  ))}
                </ul>
              </NavigationMenuContent>
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
}

export default Navbar
