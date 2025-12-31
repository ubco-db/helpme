'use client'

import React, {
  HTMLAttributeAnchorTarget,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useUserInfo } from '@/app/contexts/userContext'
import { usePathname, useRouter } from 'next/navigation'
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
import NextLink from 'next/link'
import { SelfAvatar } from './UserAvatar'
import {
  checkCourseCreatePermissions,
  cn,
  getRoleInCourse,
} from '../utils/generalUtils'
import {
  GetCourseResponse,
  OrganizationRole,
  Role,
  User,
  UserRole,
} from '@koh/common'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { Drawer, DrawerContent, DrawerTrigger } from './ui/drawer'
import {
  CalendarDays,
  LineChart,
  MenuIcon,
  MessageCircleQuestion,
  Settings,
  Undo2,
  UsersRound,
} from 'lucide-react'
import { HomeOutlined, LogoutOutlined, SyncOutlined } from '@ant-design/icons'
import { Popconfirm } from 'antd'
import { sortQueues } from '../(dashboard)/course/[cid]/utils/commonCourseFunctions'
import { useCourseFeatures } from '../hooks/useCourseFeatures'
import CenteredSpinner from './CenteredSpinner'
import Image from 'next/image'
import { useOrganizationSettings } from '@/app/hooks/useOrganizationSettings'
import { API } from '@/app/api'

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
  target,
}: {
  ref?: React.Ref<HTMLAnchorElement>
  href: string
  className?: string
  children: React.ReactNode
  isSubMenuLink?: boolean
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
  target?: HTMLAttributeAnchorTarget
}) => {
  const pathname = usePathname()
  const isActive = href === pathname
  const isLogout = href.startsWith('/api/v1/logout')

  return (
    <NavigationMenuLink ref={ref} asChild active={isActive}>
      <NextLink
        href={href}
        prefetch={isLogout ? false : undefined}
        className={
          (isSubMenuLink
            ? navigationMenuTriggerStyleForSubMenu()
            : navigationMenuTriggerStyle()) +
          ' ' +
          className
        }
        onClick={onClick}
        target={target}
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

/**
 * This is the Navbar (i.e. all the nav bar tabs). It is separate from the other components in the header.
 * This gets rendered in two areas: in the mobile drawer and in the desktop (both located in the HeaderBar component)
 */
const NavBar = ({
  userInfo,
  courseId,
  course,
  isAQueuePage,
  isACourseSettingsPage,
  isAnOrganizationSettingsPage,
  isAnAdminPanelPage,
  setIsDrawerOpen,
  isProfilePage = false,
  orientation = 'horizontal',
  isLti = false,
}: {
  userInfo: User
  courseId?: number
  course?: GetCourseResponse
  isAQueuePage: boolean
  isACourseSettingsPage: boolean
  isAnOrganizationSettingsPage: boolean
  isAnAdminPanelPage: boolean
  setIsDrawerOpen?: React.Dispatch<React.SetStateAction<boolean>>
  isProfilePage?: boolean
  orientation?: 'horizontal' | 'vertical'
  isLti?: boolean
}) => {
  const organizationSettings = useOrganizationSettings(
    userInfo?.organization?.orgId ?? -1,
  )
  const router = useRouter()
  const courseFeatures = useCourseFeatures(courseId)
  const role = courseId ? getRoleInCourse(userInfo, courseId) : null
  const sortedQueues = useMemo(() => {
    if (!course?.queues) return []
    return sortQueues(course.queues)
  }, [course?.queues])

  // This is to move the "Queues" and "Profile" submenu to show on the left or right side (there is only one component, so it needs to be moved around like this)
  const setNavigationSubMenuRightSide = useCallback(() => {
    const viewportElement = document.getElementById('navigation-menu-viewport')
    if (viewportElement) {
      viewportElement.classList.remove('left-0')
      viewportElement.classList.add('right-0')
    }
  }, [])
  const setNavigationSubMenuLeftSide = useCallback(() => {
    if (isLti) {
      return
    }
    const viewportElement = document.getElementById('navigation-menu-viewport')
    if (viewportElement) {
      viewportElement.classList.remove('right-0')
      viewportElement.classList.add('left-0')
    }
  }, [])

  // Could this redirect be put elsewhere? Yes it can. However, since all of the data needed is already here and this component is on all course pages, this way is easiest and most efficient.
  if (
    course &&
    !course.enabled &&
    role !== Role.TA &&
    role !== Role.PROFESSOR &&
    userInfo.organization?.organizationRole !== OrganizationRole.ADMIN
  ) {
    router.push(isLti ? '/lti' : '/courses')
    return <CenteredSpinner tip="Course is archived. Redirecting..." />
  } else {
    const coursePrefix = isLti ? '/lti' : '/course'
    const logoutUrl = '/api/v1/logout' + (isLti ? '?lti=true' : '')
    return (
      <NavigationMenu orientation={orientation}>
        <NavigationMenuList>
          <NextLink
            href={
              course
                ? `${coursePrefix}/${courseId}`
                : isLti
                  ? '/lti'
                  : '/courses'
            }
            aria-hidden="true"
            className="hidden md:block"
            tabIndex={-1}
            onClick={() => setIsDrawerOpen && setIsDrawerOpen(false)}
          >
            {/* This organization logo is only visible on desktop */}
            <Image
              width={48}
              height={48}
              className={cn(
                'h-12 w-full object-contain p-1',
                isLti ? 'pl-4' : 'pr-4',
              )}
              alt="Organization Logo"
              src={`/api/v1/organization/${userInfo.organization?.orgId}/get_logo/${userInfo.organization?.organizationLogoUrl}`}
            />
          </NextLink>
          {course ? (
            <>
              <NavigationMenuItem>
                <Link
                  className="!font-bold "
                  href={`${coursePrefix}/${courseId}`}
                  onClick={() => setIsDrawerOpen && setIsDrawerOpen(false)}
                >
                  {/* <House strokeWidth={1.5} className='mr-3' /> */}
                  <HomeOutlined className="mr-3 text-2xl" />
                  {course.name}
                </Link>
              </NavigationMenuItem>
              {isLti && [Role.PROFESSOR].includes(role ?? Role.STUDENT) && (
                <NavigationMenuItem>
                  <Link
                    href={`/lti/${course.id}/integration`}
                    onClick={() => setIsDrawerOpen && setIsDrawerOpen(false)}
                  >
                    <SyncOutlined className="mr-3 text-2xl" />
                    Integration
                  </Link>
                </NavigationMenuItem>
              )}
              {!isLti && (
                <>
                  {courseFeatures?.queueEnabled && (
                    <NavigationMenuItem>
                      {/* This "NavigationMenuTrigger" is just the "Queues" button */}
                      <NavigationMenuTrigger
                        className={
                          isAQueuePage
                            ? 'md:border-helpmeblue bg-zinc-300/80 md:border-b-2 md:bg-white'
                            : ''
                        }
                        onFocus={setNavigationSubMenuLeftSide}
                        onClick={setNavigationSubMenuLeftSide}
                        onPointerMove={(e) => e.preventDefault()}
                        onPointerLeave={(e) => e.preventDefault()}
                      >
                        <UsersRound strokeWidth={1.5} className="mr-3" />
                        Queues
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        {/* On mobile, if there are more than 6 queues, put the queue list into two columns */}
                        <ul
                          className={`grid gap-1 p-4 md:grid-cols-2 lg:w-[600px] lg:gap-2 ${sortedQueues.length > 6 ? 'w-[95vw] grid-cols-2' : 'w-[60vw]'}`}
                        >
                          {sortedQueues.map((queue) => (
                            <ListItem
                              key={queue.id}
                              title={queue.room}
                              href={`/course/${courseId}/queue/${queue.id}`}
                              onClick={() =>
                                setIsDrawerOpen && setIsDrawerOpen(false)
                              }
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
                  )}
                  {courseFeatures?.asyncQueueEnabled && (
                    <NavigationMenuItem>
                      <Link
                        href={`/course/${courseId}/async_centre`}
                        onClick={() =>
                          setIsDrawerOpen && setIsDrawerOpen(false)
                        }
                      >
                        <MessageCircleQuestion
                          strokeWidth={1.5}
                          className="mr-3"
                        />
                        Anytime Qs
                      </Link>
                    </NavigationMenuItem>
                  )}
                  {courseFeatures?.queueEnabled && (
                    <NavigationMenuItem>
                      <Link
                        href={`/course/${courseId}/schedule`}
                        onClick={() =>
                          setIsDrawerOpen && setIsDrawerOpen(false)
                        }
                      >
                        <CalendarDays strokeWidth={1.5} className="mr-3" />
                        Schedule
                      </Link>
                    </NavigationMenuItem>
                  )}
                  {(role === Role.TA || role === Role.PROFESSOR) && (
                    <NavigationMenuItem
                      className={
                        isACourseSettingsPage
                          ? // the hover:border-none is because the inner link has a hover effect that adds another border
                            'md:border-helpmeblue bg-zinc-300/80 md:border-b-2 md:bg-white md:hover:border-none md:focus:border-none'
                          : ''
                      }
                    >
                      <Link
                        href={`/course/${courseId}/settings${role === Role.TA ? '/edit_questions' : ''}`}
                        onClick={() =>
                          setIsDrawerOpen && setIsDrawerOpen(false)
                        }
                      >
                        <Settings strokeWidth={1.5} className="mr-3" />
                        Course Settings
                      </Link>
                    </NavigationMenuItem>
                  )}
                  {role === Role.PROFESSOR && (
                    <NavigationMenuItem>
                      <Link
                        href={`/course/${courseId}/insights`}
                        onClick={() =>
                          setIsDrawerOpen && setIsDrawerOpen(false)
                        }
                      >
                        <LineChart strokeWidth={1.5} className="mr-3" />
                        Insights
                      </Link>
                    </NavigationMenuItem>
                  )}
                </>
              )}
              <NavigationMenuItem>
                <Link
                  href={isLti ? '/lti' : '/courses'}
                  onClick={() => setIsDrawerOpen && setIsDrawerOpen(false)}
                >
                  <Undo2 strokeWidth={1.5} className="mr-3" />
                  My Courses
                </Link>
              </NavigationMenuItem>
            </>
          ) : !courseId ? (
            <>
              {isProfilePage && (
                <NavigationMenuItem>
                  <Link
                    href=""
                    className="md:pl-8"
                    onClick={() => {
                      router.back()
                      if (setIsDrawerOpen) setIsDrawerOpen(false)
                    }}
                  >
                    <Undo2 strokeWidth={1.5} className="mr-3" />
                    Back
                  </Link>
                </NavigationMenuItem>
              )}
              <NavigationMenuItem>
                <Link
                  href={isLti ? '/lti' : '/courses'}
                  className="md:pl-8"
                  onClick={() => setIsDrawerOpen && setIsDrawerOpen(false)}
                >
                  My Courses
                </Link>
              </NavigationMenuItem>
              {!isLti &&
                checkCourseCreatePermissions(
                  userInfo,
                  organizationSettings,
                ) && (
                  <NavigationMenuItem>
                    <Link
                      className={cn(
                        '!md:pl-8',
                        isAnOrganizationSettingsPage
                          ? 'md:border-helpmeblue md:border-b-2'
                          : '',
                      )}
                      href="/organization/settings"
                      onClick={() => setIsDrawerOpen && setIsDrawerOpen(false)}
                    >
                      {userInfo?.organization?.organizationRole ===
                      OrganizationRole.PROFESSOR
                        ? 'Semester Management'
                        : 'Organization Settings'}
                    </Link>
                  </NavigationMenuItem>
                )}
              {!isLti && userInfo.userRole == UserRole.ADMIN && (
                <NavigationMenuItem>
                  <Link
                    href="/admin"
                    className={cn(
                      'md:pl-8',
                      isAnAdminPanelPage
                        ? 'md:border-helpmeblue md:border-b-2'
                        : '',
                    )}
                    onClick={() => setIsDrawerOpen && setIsDrawerOpen(false)}
                  >
                    Admin Panel
                  </Link>
                </NavigationMenuItem>
              )}
            </>
          ) : null}
          {/* DESKTOP ONLY PART OF NAVBAR */}
          <NavigationMenuItem className="!ml-auto hidden md:block">
            <NavigationMenuTrigger
              className={cn(
                '!pl-4',
                isProfilePage ? 'md:border-helpmeblue md:border-b-2' : '',
              )}
              onFocus={setNavigationSubMenuRightSide}
              onClick={setNavigationSubMenuRightSide}
              onPointerMove={(e) => e.preventDefault()}
              onPointerLeave={(e) => e.preventDefault()}
            >
              <SelfAvatar size={40} className="mr-2" />
              {userInfo?.firstName}
            </NavigationMenuTrigger>
            <NavigationMenuContent className="hidden md:flex">
              <ul className="grid w-max min-w-[200px] grid-cols-1 gap-1 p-2">
                {!isLti && (
                  <ListItem key="profile" title="Profile" href="/profile">
                    {userInfo?.email}
                  </ListItem>
                )}
                <ListItem
                  key="logout"
                  title="Logout"
                  titleElement={<span className="text-red-700">Log Out</span>}
                  href={logoutUrl}
                ></ListItem>
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
          {/* MOBILE ONLY PART OF NAVBAR */}
          <div className="!mb-2 !mt-auto -mr-5 block w-[calc(100%+1.25rem)] border-b border-b-zinc-200 md:hidden" />
          <NavigationMenuItem className="md:hidden">
            {isLti ? (
              <>
                <SelfAvatar size={40} className="mr-2" />
                {userInfo?.firstName}
              </>
            ) : (
              <Link
                href="/profile"
                className="!pl-0"
                onClick={() => setIsDrawerOpen && setIsDrawerOpen(false)}
              >
                <SelfAvatar size={40} className="mr-2" />
                {userInfo?.firstName}
              </Link>
            )}
          </NavigationMenuItem>
          <NavigationMenuItem className="mb-2 md:hidden">
            <Popconfirm
              title="Are you sure you want to log out?"
              onConfirm={() => {
                router.push(logoutUrl)
                if (setIsDrawerOpen) setIsDrawerOpen(false)
              }}
              okText="Yes"
              cancelText="No"
              // this places the Popconfirm just below the Link in the DOM rather than at the very bottom of the DOM (important for accessibility and prevent buttons being clicked underneath the Popconfirm)
              getPopupContainer={(trigger) => trigger.parentNode as HTMLElement}
            >
              <Link
                href={logoutUrl}
                className="text-red-700"
                onClick={(e) => {
                  e.preventDefault()
                }}
              >
                <LogoutOutlined
                  size={40}
                  className="mr-2 rotate-180 text-2xl"
                />
                Log Out
              </Link>
            </Popconfirm>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    )
  }
}

/**
 * Navbar component that is rendered on each page.
 */
const HeaderBar: React.FC = () => {
  const { userInfo } = useUserInfo()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 768px)')
  // This is not the usual way to get the courseId from the URL
  // (normally you're supposed to use `params` for the page.tsx and then pass it down as a prop).
  // However, doing it this way makes it much easier to add the navbar to layout.tsx.
  const pathname = usePathname()
  const isLti = pathname.startsWith('/lti')
  const URLSegments = pathname.split('/')

  const courseId = useMemo(() => {
    const temp = parseInt(URLSegments[2])
    if (!isNaN(temp)) return temp
    return undefined
  }, [URLSegments])

  const [course, setCourse] = useState<GetCourseResponse>()
  useEffect(() => {
    if (courseId != undefined) {
      API.course
        .get(courseId)
        .then((course) => setCourse(course))
        .catch(() => {
          setCourse(undefined)
        })
    } else {
      setCourse(undefined)
    }
  }, [courseId])

  const queueId =
    URLSegments[3] === 'queue' && URLSegments[4] && Number(URLSegments[4])
      ? Number(URLSegments[4])
      : null
  const isAQueuePage = URLSegments[3] === 'queue'
  const isACourseSettingsPage =
    URLSegments[3] === 'settings' && !!URLSegments[4]
  const isAnOrganizationSettingsPage = URLSegments[1] === 'organization'
  const isAnAdminPanelPage = URLSegments[1] === 'admin'
  const isProfilePage = URLSegments[1] === 'profile'

  const queueRoom = queueId
    ? course?.queues?.find((queue) => queue.id === queueId)?.room
    : ''

  // DESKTOP HEADER
  return isDesktop ? (
    <NavBar
      userInfo={userInfo}
      courseId={courseId}
      course={course}
      isAQueuePage={isAQueuePage}
      isACourseSettingsPage={isACourseSettingsPage}
      isAnOrganizationSettingsPage={isAnOrganizationSettingsPage}
      isAnAdminPanelPage={isAnAdminPanelPage}
      isProfilePage={isProfilePage}
      isLti={isLti}
    />
  ) : (
    // MOBILE HEADER AND NAV DRAWER
    <div className="flex items-center justify-between">
      <Image
        width={48}
        height={48}
        className="h-12 object-contain p-1"
        alt="Organization Logo"
        src={`/api/v1/organization/${userInfo.organization?.orgId}/get_logo/${userInfo.organization?.organizationLogoUrl}`}
      />
      <div className="flex h-14 grow flex-col items-center justify-center">
        <h1
          className={cn(
            'leading-none',
            !course?.name
              ? ''
              : course.name.length > 35
                ? 'text-xs'
                : course.name.length > 30
                  ? 'text-sm'
                  : course.name.length > 25
                    ? 'text-base'
                    : course.name.length > 20
                      ? 'text-lg'
                      : course.name.length > 15
                        ? 'text-xl'
                        : '',
          )}
        >
          {isProfilePage ? 'Profile' : course?.name}
        </h1>
        {queueRoom && (
          <h2
            className={cn(
              'leading-none text-slate-500',
              queueRoom.length > 35
                ? 'text-xs'
                : queueRoom.length > 30
                  ? 'text-sm'
                  : 'text-base',
            )}
          >
            {queueRoom}
          </h2>
        )}
      </div>
      <Drawer
        direction="left"
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
      >
        <DrawerTrigger>
          <MenuIcon size={40} className="ml-2" />
        </DrawerTrigger>
        <DrawerContent>
          {/* INSIDE DRAWER */}
          <div className="flex h-screen flex-col items-start justify-start">
            <div className="my-1 flex w-full items-center justify-center border-b border-b-zinc-200 bg-white py-1 pr-5">
              <Image
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
              course={course}
              isAQueuePage={isAQueuePage}
              isACourseSettingsPage={isACourseSettingsPage}
              isAnOrganizationSettingsPage={isAnOrganizationSettingsPage}
              isAnAdminPanelPage={isAnAdminPanelPage}
              orientation="vertical"
              isProfilePage={isProfilePage}
              setIsDrawerOpen={setIsDrawerOpen}
              isLti={isLti}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

export default HeaderBar
