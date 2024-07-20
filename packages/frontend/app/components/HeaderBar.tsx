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
import { Role, User } from '@koh/common'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { Drawer, DrawerContent, DrawerTrigger } from './ui/drawer'
import {
  House,
  LineChart,
  MenuIcon,
  Settings,
  Undo2,
  UsersRound,
} from 'lucide-react'
import { HomeOutlined, LogoutOutlined } from '@ant-design/icons'
import { Divider, Popconfirm } from 'antd'

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

// add a isDesktop to this
// maybe consider renaming navbar to Header and calling this navbar
/**
 * This is the Navbar (i.e. all the nav bar tabs). It is seperate from the other components in the header.
 * This gets rendered in two areas: in the mobile drawer and in the desktop (both located in the HeaderBar component)
 */
const NavBar = ({
  userInfo,
  courseId,
  isAQueuePage,
  orientation = 'horizontal',
}: {
  userInfo: User
  courseId: number | null
  isAQueuePage: boolean
  orientation?: 'horizontal' | 'vertical'
}) => {
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
    <NavigationMenu orientation={orientation}>
      <NavigationMenuList>
        {course ? (
          <>
            <NextLink
              href={`/course/${courseId}`}
              aria-hidden="true"
              className="hidden md:block"
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
              <Link className="!font-bold " href={`/course/${courseId}`}>
                {/* <House strokeWidth={1.5} className='mr-3' /> */}
                <HomeOutlined className="mr-3 text-2xl" />
                {course.name}
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem>
              {/* This "NavigationMenuTrigger" is just the "Queues" button */}
              <NavigationMenuTrigger
                className={isAQueuePage ? 'bg-zinc-300/80' : ''}
              >
                <UsersRound strokeWidth={1.5} className="mr-3" />
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
                  <Settings strokeWidth={1.5} className="mr-3" />
                  Admin Panel
                </Link>
              </NavigationMenuItem>
            )}
            {role === Role.PROFESSOR && (
              <NavigationMenuItem>
                <Link href={`/course/${courseId}/insights`}>
                  <LineChart strokeWidth={1.5} className="mr-3" />
                  Insights
                </Link>
              </NavigationMenuItem>
            )}
            <NavigationMenuItem>
              <Link href={`/courses`}>
                <Undo2 strokeWidth={1.5} className="mr-3" />
                My Courses
              </Link>
            </NavigationMenuItem>
          </>
        ) : !courseId ? (
          <>
            <NavigationMenuItem>
              {userInfo?.organization && (
                <NextLink href="/courses" aria-hidden="true" tabIndex={-1}>
                  <Image
                    width={48}
                    height={48}
                    className="hidden h-12 w-full object-contain md:block"
                    alt="Organization Logo"
                    src={`https://ires.ubc.ca/files/2020/02/ubc-logo.png`}
                  />
                </NextLink>
              )}
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link href="/courses" className="md:pl-8">
                My Courses
              </Link>
            </NavigationMenuItem>
            {userInfo?.organization?.organizationRole ===
              OrganizationRole.ADMIN && (
              <NavigationMenuItem>
                <Link className="md:pl-8" href="/organization/settings">
                  Organization Settings
                </Link>
              </NavigationMenuItem>
            )}
          </>
        ) : null}
        <div className="!my-2 -mr-5 block w-[calc(100%+1.25rem)] border-b border-b-zinc-200 md:hidden" />
        <NavigationMenuItem className="!mt-auto md:!ml-auto">
          <Link href="/profile" className="!pl-0 md:!pl-4">
            <SelfAvatar size={40} className="mr-2" />
            {userInfo?.firstName}
          </Link>
        </NavigationMenuItem>
        <NavigationMenuItem className="!mt-auto md:!ml-auto">
          <Popconfirm
            title="Are you sure you want to log out?"
            onConfirm={() => {
              window.location.href = '/api/logout'
            }}
            okText="Yes"
            cancelText="No"
          >
            <Link href="/api/logout" className="text-red-700 md:hidden">
              <LogoutOutlined size={40} className="mr-2 rotate-180 text-2xl" />
              Log Out
            </Link>
          </Popconfirm>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}

/**
 * Navbar component that is rendered on each page.
 */
const HeaderBar: React.FC = () => {
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
  const queueId =
    URLSegments[3] === 'queue' && URLSegments[4] && Number(URLSegments[4])
      ? Number(URLSegments[4])
      : null
  const isAQueuePage = URLSegments[3] === 'queue'
  const { course } = useCourse(courseId)

  // DESKTOP HEADER
  return isDesktop ? (
    <NavBar
      userInfo={userInfo}
      courseId={courseId}
      isAQueuePage={isAQueuePage}
    />
  ) : (
    // MOBILE HEADER AND NAV DRAWER
    <div className="flex items-center justify-between">
      <Image
        width={48}
        height={48}
        className="h-12 object-contain"
        alt="Organization Logo"
        src={`https://ires.ubc.ca/files/2020/02/ubc-logo.png`}
      />
      <div className="flex h-14 grow flex-col items-center justify-center">
        <h1 className="leading-none">{course?.name}</h1>
        <h2 className="text-base leading-none text-slate-500">
          {queueId
            ? course?.queues?.find((queue) => queue.id === queueId)?.room
            : ''}
        </h2>
      </div>
      <Drawer direction="left">
        <DrawerTrigger>
          <MenuIcon size={40} className="ml-2" />
        </DrawerTrigger>
        <DrawerContent>
          {/* INSIDE DRAWER */}
          <div className="flex h-full flex-col items-start justify-start">
            <div className="my-1 flex w-full items-center justify-center border-b border-b-zinc-200 bg-white py-1 pr-5">
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
            <NavBar
              userInfo={userInfo}
              courseId={courseId}
              isAQueuePage={isAQueuePage}
              orientation="vertical"
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

export default HeaderBar
