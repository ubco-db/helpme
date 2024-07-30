/* eslint-disable @next/next/no-img-element */
'use client'

import React, { useCallback } from 'react'
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
import { usePathname, useRouter } from 'next/navigation'
import NextLink from 'next/link'
import { OrganizationRole } from '../typings/user'
import { SelfAvatar } from './UserAvatar'
import { useCourse } from '../hooks/useCourse'
import { cn, getRoleInCourse } from '../utils/generalUtils'
import { Role, User } from '@koh/common'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { Drawer, DrawerContent, DrawerTrigger } from './ui/drawer'
import {
  CalendarDays,
  LineChart,
  MenuIcon,
  Settings,
  Undo2,
  UsersRound,
} from 'lucide-react'
import { HomeOutlined, LogoutOutlined } from '@ant-design/icons'
import { Popconfirm } from 'antd'

/**
 * This custom Link is wrapped around nextjs's Link to improve accessibility and styling. Not to be used outside of this navigation menu.
 */
const Link = ({
  ref,
  href,
  className,
  children,
  isSubMenuLink,
  onClick,
}: {
  ref?: React.Ref<HTMLAnchorElement>
  href: string
  className?: string
  children: React.ReactNode
  isSubMenuLink?: boolean
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
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
        onClick={onClick}
      >
        {children}
      </NextLink>
    </NavigationMenuLink>
  )
}

const ListItem = React.forwardRef<
  React.ElementRef<'a'>,
  React.ComponentPropsWithoutRef<'a'> & {
    title: string
    href: string
    titleElement?: React.ReactNode
  }
>(({ className, title, children, href, titleElement, ...props }, ref) => {
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
        <div className="text-sm font-medium leading-none">
          {titleElement ?? title}
        </div>
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
 * This is the Navbar (i.e. all the nav bar tabs). It is separate from the other components in the header.
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
  const router = useRouter()
  const role = courseId ? getRoleInCourse(userInfo, courseId) : null
  // only show open queues, sorted by name
  const openQueues =
    orderBy(
      course?.queues?.filter((queue) => queue.isOpen),
      ['room'],
      ['asc'],
    ) ?? []

  // This is to move the "Queues" and "Profile" submenu to show on the left or right side (there is only one component, so it needs to be moved around like this)
  const setNavigationSubMenuRightSide = useCallback(() => {
    const viewportElement = document.getElementById('navigation-menu-viewport')
    if (viewportElement) {
      viewportElement.classList.remove('left-0')
      viewportElement.classList.add('right-0')
    }
  }, [])
  const setNavigationSubMenuLeftSide = useCallback(() => {
    const viewportElement = document.getElementById('navigation-menu-viewport')
    if (viewportElement) {
      viewportElement.classList.remove('right-0')
      viewportElement.classList.add('left-0')
    }
  }, [])

  return (
    <NavigationMenu orientation={orientation}>
      <NavigationMenuList>
        <NextLink
          href={course ? `/course/${courseId}` : '/courses'}
          aria-hidden="true"
          className="hidden md:block"
          tabIndex={-1}
        >
          {/* This organization logo is only visible on desktop */}
          <img
            width={48}
            height={48}
            className="h-12 w-full object-contain p-1"
            alt="Organization Logo"
            src={`/api/v1/organization/${userInfo.organization?.orgId}/get_logo/${userInfo.organization?.organizationLogoUrl}`}
          />
        </NextLink>
        {course ? (
          <>
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
                onFocus={setNavigationSubMenuLeftSide}
                onClick={setNavigationSubMenuLeftSide}
                onMouseEnter={setNavigationSubMenuLeftSide}
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
                        {`${queue.staffList.length > 0 ? `${queue.staffList.length} staff checked in` : ''}`}
                        <br />
                        {`${queue.queueSize > 0 ? `${queue.queueSize} students in queue` : ''}`}
                      </>
                    </ListItem>
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <Link href={`/course/${courseId}/schedule`}>
                <CalendarDays strokeWidth={1.5} className="mr-3" />
                Schedule
              </Link>
            </NavigationMenuItem>
            {(role === Role.TA || role === Role.PROFESSOR) && (
              <NavigationMenuItem>
                <Link
                  href={`/course/${courseId}/settings${role === Role.TA ? '/export_data' : ''}`}
                >
                  <Settings strokeWidth={1.5} className="mr-3" />
                  Course Settings
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
        {/* DESKTOP ONLY PART OF NAVBAR */}
        <NavigationMenuItem className="!ml-auto hidden md:block">
          <NavigationMenuTrigger
            className="!pl-4"
            onFocus={setNavigationSubMenuRightSide}
            onClick={setNavigationSubMenuRightSide}
            onMouseEnter={setNavigationSubMenuRightSide}
          >
            <SelfAvatar size={40} className="mr-2" />
            {userInfo?.firstName}
          </NavigationMenuTrigger>
          <NavigationMenuContent className="hidden md:flex">
            <ul className="grid w-[200px] grid-cols-1 gap-1 p-2">
              <ListItem key="profile" title="Profile" href="/profile">
                {userInfo?.email}
              </ListItem>
              <ListItem
                key="logout"
                title="Logout"
                titleElement={<span className="text-red-700">Log Out</span>}
                href="/api/v1/logout"
              ></ListItem>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        {/* MOBILE ONLY PART OF NAVBAR */}
        <div className="!mb-2 !mt-auto -mr-5 block w-[calc(100%+1.25rem)] border-b border-b-zinc-200 md:hidden" />
        <NavigationMenuItem className="md:hidden">
          <Link href="/profile" className="!pl-0">
            <SelfAvatar size={40} className="mr-2" />
            {userInfo?.firstName}
          </Link>
        </NavigationMenuItem>
        <NavigationMenuItem className="mb-2 md:hidden">
          <Popconfirm
            title="Are you sure you want to log out?"
            onConfirm={() => {
              router.push('/api/v1/logout')
            }}
            okText="Yes"
            cancelText="No"
            // this places the Popconfirm just below the Link in the DOM rather than at the very bottom of the DOM (important for accessibility and prevent buttons being clicked underneath the Popconfirm)
            getPopupContainer={(trigger) => trigger.parentNode as HTMLElement}
          >
            <Link
              href="/api/v1/logout"
              className="text-red-700"
              onClick={(e) => {
                e.preventDefault()
              }}
            >
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
      <img
        width={48}
        height={48}
        className="h-12 object-contain"
        alt="Organization Logo"
        src={`/api/v1/organization/${userInfo.organization?.orgId}/get_logo/${userInfo.organization?.organizationLogoUrl}`}
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
              <img
                width={48}
                height={48}
                className="h-12 object-contain"
                alt="Organization Logo"
                src={`/api/v1/organization/${userInfo.organization?.orgId}/get_logo/${userInfo.organization?.organizationLogoUrl}`}
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
