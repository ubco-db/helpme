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
import { useMediaQuery } from '../hooks/useMediaQuery'
import { Drawer, DrawerContent, DrawerTrigger } from './ui/drawer'
import { MenuIcon } from 'lucide-react'

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
 * Note: If you would like to add or change a link, you must change it in both the desktop and mobile versions (both are on this page).
 * While it may be tempting to refactor it so you only have to modify one area, this would limit the flexibility and make adjusting the order of the tabs more difficult
 */
const Navbar: React.FC = () => {
  const { userInfo } = useUserInfo()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  // This is not the usual way to get the courseId from the URL
  // (normally you're supposed to use `params` for the page.tsx and then pass it down as a prop).
  // However, doing it this way makes it much easier to add the navbar to layout.tsx.
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

  return isDesktop ? (
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
              {/* This "NavigationMenuTrigger" is just the "Queues" button */}
              <NavigationMenuTrigger
                className={URLSegments[3] === 'queue' ? 'bg-zinc-300/80' : ''}
              >
                Queues
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[60vw] gap-1 p-4 md:grid-cols-2 lg:w-[600px] lg:gap-2 ">
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
  ) : (
    // MOBILE HEADER AND NAV DRAWER
    <header className="flex items-center justify-between">
      <div className="flex h-14 grow flex-col items-center justify-center pl-7">
        <h1 className="leading-none">{course?.name}</h1>
        <h2 className="text-base leading-none text-slate-500">
          {URLSegments[3] === 'queue' &&
          URLSegments[4] &&
          Number(URLSegments[4])
            ? course?.queues?.find(
                (queue) => queue.id === Number(URLSegments[4]),
              )?.room
            : ''}
        </h2>
      </div>
      <Drawer direction="left">
        <DrawerTrigger>
          <MenuIcon size={40} className="" />
        </DrawerTrigger>
        <DrawerContent>
          <div className="flex flex-col items-start justify-start">
            <div className="my-1 flex w-full items-center justify-start border-b border-b-zinc-200 bg-white px-2 py-1">
              <Image
                width={48}
                height={48}
                className="h-12 object-contain"
                alt="Organization Logo"
                src={`https://ires.ubc.ca/files/2020/02/ubc-logo.png`}
              />
              <span className="text-2xl font-semibold leading-none">
                {userInfo?.organization?.organizationName}
              </span>
            </div>
            <NavigationMenu orientation="vertical" className="bg-background">
              <NavigationMenuList>
                {course ? (
                  <>
                    <NavigationMenuItem>
                      <Link className="!font-bold" href={`/course/${courseId}`}>
                        {course.name}
                      </Link>
                    </NavigationMenuItem>
                    <NavigationMenuItem>
                      {/* This "NavigationMenuTrigger" is just the "Queues" button */}
                      <NavigationMenuTrigger
                        className={
                          URLSegments[3] === 'queue' ? 'bg-zinc-300/80' : ''
                        }
                      >
                        Queues
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <ul className="grid w-[60vw] gap-1 p-4 md:grid-cols-2 lg:w-[600px] lg:gap-2 ">
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
                        <Link href={`/course/${courseId}/admin`}>
                          Admin Panel
                        </Link>
                      </NavigationMenuItem>
                    )}
                    {role === Role.PROFESSOR && (
                      <NavigationMenuItem>
                        <Link href={`/course/${courseId}/insights`}>
                          Insights
                        </Link>
                      </NavigationMenuItem>
                    )}
                    <NavigationMenuItem>
                      <Link href={`/courses`}>
                        <span aria-hidden="true" className="pb-0.5 text-lg">
                          &lt;&nbsp;&nbsp;
                        </span>
                        My Courses
                      </Link>
                    </NavigationMenuItem>
                  </>
                ) : (
                  <>
                    <NavigationMenuItem>
                      {userInfo?.organization && (
                        <NextLink
                          href="/courses"
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
                      )}
                    </NavigationMenuItem>
                    <NavigationMenuItem>
                      <Link href="/courses">Courses</Link>
                    </NavigationMenuItem>
                    {userInfo?.organization?.organizationRole ===
                      OrganizationRole.ADMIN && (
                      <NavigationMenuItem>
                        <Link href="/organization/settings">
                          Organization Settings
                        </Link>
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
          </div>
        </DrawerContent>
      </Drawer>
    </header>
  )
}

export default Navbar
