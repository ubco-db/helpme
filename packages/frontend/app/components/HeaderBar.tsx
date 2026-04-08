'use client'

import React, {
  HTMLAttributeAnchorTarget,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
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
  useNavigationOrientation,
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
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from './ui/drawer'
import {
  CalendarDays,
  LineChart,
  MenuIcon,
  MessageCircleQuestion,
  Settings,
  Undo2,
  UsersRound,
} from 'lucide-react'
import {
  HomeOutlined,
  LogoutOutlined,
  MailOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { Popconfirm } from 'antd'
import { sortQueues } from '../(dashboard)/course/[cid]/utils/commonCourseFunctions'
import { useCourseFeatures } from '../hooks/useCourseFeatures'
import CenteredSpinner from './CenteredSpinner'
import Image from 'next/image'
import { useOrganizationSettings } from '@/app/hooks/useOrganizationSettings'
import { useCourse } from '@/app/hooks/useCourse'

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
  isCompactDesktop = false,
}: {
  ref?: React.Ref<HTMLAnchorElement>
  href: string
  className?: string
  children: React.ReactNode
  isSubMenuLink?: boolean
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
  target?: HTMLAttributeAnchorTarget
  isCompactDesktop?: boolean
}) => {
  const pathname = usePathname()
  const { orientation } = useNavigationOrientation()
  const isActive = href === pathname
  const isLogout = href.startsWith('/api/v1/logout')

  return (
    <NavigationMenuLink ref={ref} asChild active={isActive}>
      <NextLink
        href={href}
        prefetch={isLogout ? false : undefined}
        className={cn(
          isSubMenuLink
            ? navigationMenuTriggerStyleForSubMenu()
            : navigationMenuTriggerStyle(orientation),
          isCompactDesktop && '!px-2',
          className,
        )}
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
  isCompactDesktop = false,
  forceDrawerPresentation = false,
  className = '',
  showViewport = true,
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
  isCompactDesktop?: boolean
  forceDrawerPresentation?: boolean
  className?: string
  showViewport?: boolean
}) => {
  const organizationSettings = useOrganizationSettings(
    userInfo?.organization?.orgId ?? -1,
  )
  const router = useRouter()
  const showDrawerPresentation =
    orientation === 'vertical' || forceDrawerPresentation
  const courseFeatures = useCourseFeatures(courseId)
  const role = courseId ? getRoleInCourse(userInfo, courseId) : null
  const compactTopLevelClass = isCompactDesktop ? '!pl-1.5 !pr-2' : ''
  const drawerTopLevelItemClass = showDrawerPresentation ? 'w-full' : ''
  const horizontalInsetClass = !showDrawerPresentation ? 'md:pl-8' : ''
  const selectedNavItemClass =
    'bg-zinc-300/80 hover:bg-zinc-300/80 focus:bg-zinc-300/80'
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
      <NavigationMenu
        orientation={orientation}
        className={className}
        showViewport={showViewport}
      >
        <NavigationMenuList>
          {!showDrawerPresentation && (
            <NextLink
              href={
                course
                  ? `${coursePrefix}/${courseId}`
                  : isLti
                    ? '/lti'
                    : '/courses'
              }
              aria-hidden="true"
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
          )}
          {course ? (
            <>
              <NavigationMenuItem className={drawerTopLevelItemClass}>
                <Link
                  className={cn('!font-bold', compactTopLevelClass)}
                  href={`${coursePrefix}/${courseId}`}
                  onClick={() => setIsDrawerOpen && setIsDrawerOpen(false)}
                  isCompactDesktop={isCompactDesktop}
                >
                  {/* <House strokeWidth={1.5} className='mr-3' /> */}
                  <HomeOutlined className="mr-3 text-2xl" />
                  {course.name}
                </Link>
              </NavigationMenuItem>
              {isLti && [Role.PROFESSOR].includes(role ?? Role.STUDENT) && (
                <NavigationMenuItem className={drawerTopLevelItemClass}>
                  <Link
                    href={`/lti/${course.id}/integration`}
                    onClick={() => setIsDrawerOpen && setIsDrawerOpen(false)}
                    className={compactTopLevelClass}
                    isCompactDesktop={isCompactDesktop}
                  >
                    <SyncOutlined className="mr-3 text-2xl" />
                    Integration
                  </Link>
                </NavigationMenuItem>
              )}
              {!isLti && (
                <>
                  {courseFeatures?.queueEnabled && (
                    <NavigationMenuItem className={drawerTopLevelItemClass}>
                      {/* This "NavigationMenuTrigger" is just the "Queues" button */}
                      <NavigationMenuTrigger
                        className={cn(
                          compactTopLevelClass,
                          isAQueuePage && selectedNavItemClass,
                        )}
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
                        {sortedQueues.length > 0 ? (
                          <ul
                            className={cn(
                              'grid gap-1 p-4',
                              showDrawerPresentation
                                ? 'w-full'
                                : 'md:grid-cols-2 lg:w-[600px] lg:gap-2',
                              sortedQueues.length > 6
                                ? 'grid-cols-2'
                                : showDrawerPresentation
                                  ? 'grid-cols-1'
                                  : 'w-[60vw]',
                              !showDrawerPresentation &&
                                sortedQueues.length > 6 &&
                                'w-[95vw]',
                            )}
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
                        ) : (
                          <div
                            className={cn(
                              'p-4 text-center text-sm text-gray-500',
                              showDrawerPresentation
                                ? 'w-full'
                                : role === Role.PROFESSOR
                                  ? 'w-[60vw] lg:w-[600px]'
                                  : 'w-[60vw] lg:w-[400px]',
                            )}
                          >
                            <p>There are no queues in this course</p>
                            {role === Role.PROFESSOR && (
                              <p>
                                You can create a queue on the{' '}
                                <NextLink
                                  href={`${coursePrefix}/${courseId}`}
                                  onClick={() =>
                                    setIsDrawerOpen && setIsDrawerOpen(false)
                                  }
                                >
                                  Course Home page
                                </NextLink>{' '}
                                or disable the Queues feature under{' '}
                                <NextLink
                                  href={`${coursePrefix}/${courseId}/settings`}
                                  onClick={() =>
                                    setIsDrawerOpen && setIsDrawerOpen(false)
                                  }
                                >
                                  Course Settings
                                </NextLink>
                                .
                              </p>
                            )}
                          </div>
                        )}
                      </NavigationMenuContent>
                    </NavigationMenuItem>
                  )}
                  {courseFeatures?.asyncQueueEnabled && (
                    <NavigationMenuItem className={drawerTopLevelItemClass}>
                      <Link
                        href={`/course/${courseId}/async_centre`}
                        onClick={() =>
                          setIsDrawerOpen && setIsDrawerOpen(false)
                        }
                        className={compactTopLevelClass}
                        isCompactDesktop={isCompactDesktop}
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
                    <NavigationMenuItem className={drawerTopLevelItemClass}>
                      <Link
                        href={`/course/${courseId}/schedule`}
                        onClick={() =>
                          setIsDrawerOpen && setIsDrawerOpen(false)
                        }
                        className={compactTopLevelClass}
                        isCompactDesktop={isCompactDesktop}
                      >
                        <CalendarDays strokeWidth={1.5} className="mr-3" />
                        Schedule
                      </Link>
                    </NavigationMenuItem>
                  )}
                  {(role === Role.TA || role === Role.PROFESSOR) && (
                    <NavigationMenuItem className={drawerTopLevelItemClass}>
                      <Link
                        className={cn(
                          compactTopLevelClass,
                          isACourseSettingsPage && selectedNavItemClass,
                        )}
                        href={`/course/${courseId}/settings${role === Role.TA ? '/edit_questions' : ''}`}
                        onClick={() =>
                          setIsDrawerOpen && setIsDrawerOpen(false)
                        }
                        isCompactDesktop={isCompactDesktop}
                      >
                        <Settings strokeWidth={1.5} className="mr-3" />
                        Course Settings
                      </Link>
                    </NavigationMenuItem>
                  )}
                  {role === Role.PROFESSOR && (
                    <NavigationMenuItem className={drawerTopLevelItemClass}>
                      <Link
                        href={`/course/${courseId}/insights`}
                        onClick={() =>
                          setIsDrawerOpen && setIsDrawerOpen(false)
                        }
                        className={compactTopLevelClass}
                        isCompactDesktop={isCompactDesktop}
                      >
                        <LineChart strokeWidth={1.5} className="mr-3" />
                        Insights
                      </Link>
                    </NavigationMenuItem>
                  )}
                </>
              )}
              <NavigationMenuItem className={drawerTopLevelItemClass}>
                <Link
                  href={isLti ? '/lti' : '/courses'}
                  onClick={() => setIsDrawerOpen && setIsDrawerOpen(false)}
                  className={compactTopLevelClass}
                  isCompactDesktop={isCompactDesktop}
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
                    className={horizontalInsetClass}
                    onClick={() => {
                      router.back()
                      if (setIsDrawerOpen) setIsDrawerOpen(false)
                    }}
                    isCompactDesktop={isCompactDesktop}
                  >
                    <Undo2 strokeWidth={1.5} className="mr-3" />
                    Back
                  </Link>
                </NavigationMenuItem>
              )}
              <NavigationMenuItem>
                <Link
                  href={isLti ? '/lti' : '/courses'}
                  className={horizontalInsetClass}
                  onClick={() => setIsDrawerOpen && setIsDrawerOpen(false)}
                  isCompactDesktop={isCompactDesktop}
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
                        !showDrawerPresentation && '!md:pl-8',
                        isAnOrganizationSettingsPage && selectedNavItemClass,
                      )}
                      href="/organization/settings"
                      onClick={() => setIsDrawerOpen && setIsDrawerOpen(false)}
                      isCompactDesktop={isCompactDesktop}
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
                      horizontalInsetClass,
                      isAnAdminPanelPage && selectedNavItemClass,
                    )}
                    onClick={() => setIsDrawerOpen && setIsDrawerOpen(false)}
                    isCompactDesktop={isCompactDesktop}
                  >
                    Admin Panel
                  </Link>
                </NavigationMenuItem>
              )}
            </>
          ) : null}
          {/* DESKTOP ONLY PART OF NAVBAR */}
          {!showDrawerPresentation && (
            <NavigationMenuItem className="!ml-auto">
              <NavigationMenuTrigger
                className={cn(
                  isCompactDesktop ? '!pl-2 !pr-2' : '!pl-4',
                  compactTopLevelClass,
                  isProfilePage && selectedNavItemClass,
                )}
                onFocus={setNavigationSubMenuRightSide}
                onClick={setNavigationSubMenuRightSide}
                onPointerMove={(e) => e.preventDefault()}
                onPointerLeave={(e) => e.preventDefault()}
              >
                <SelfAvatar size={40} className="mr-2" />
                {userInfo?.firstName}
              </NavigationMenuTrigger>
              <NavigationMenuContent className="flex">
                <ul className="grid w-max min-w-[200px] grid-cols-1 gap-1 p-2">
                  {!isLti && (
                    <ListItem key="profile" title="Profile" href="/profile">
                      {userInfo?.email}
                    </ListItem>
                  )}
                  {isLti && (
                    <NavigationMenuItem className="w-full">
                      <div className="!ml-2 flex flex-col px-2 text-xs text-gray-500">
                        <span className={'flex items-center'}>
                          <MailOutlined className={'mr-2'} />
                          {userInfo?.email}
                        </span>
                      </div>
                    </NavigationMenuItem>
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
          )}
          {/* MOBILE ONLY PART OF NAVBAR */}
          {showDrawerPresentation && (
            <>
              <div className="-mx-5 !mt-auto mb-2 block w-[calc(100%+2.5rem)] border-b border-b-zinc-200" />
              {!isLti && (
                <NavigationMenuItem>
                  <Link
                    href="/profile"
                    className="!pl-0"
                    onClick={() => setIsDrawerOpen && setIsDrawerOpen(false)}
                  >
                    <SelfAvatar size={40} className="mr-2" />
                    {userInfo?.firstName}
                  </Link>
                </NavigationMenuItem>
              )}
              {isLti && (
                <>
                  <NavigationMenuItem className="w-full">
                    <div className="!ml-2 flex flex-col gap-2 px-2 text-xs text-gray-500">
                      <div className="flex items-center">
                        <SelfAvatar size={20} className="mr-2" />
                        <span>
                          {userInfo?.firstName}
                          {userInfo?.lastName ? ` ${userInfo.lastName}` : ''}
                        </span>
                      </div>
                      <span className={'flex items-center'}>
                        <MailOutlined
                          style={{
                            fontSize: '10px',
                            paddingLeft: '5px',
                            paddingRight: '5px',
                          }}
                          className={'mr-2'}
                        />
                        {userInfo?.email}
                      </span>
                    </div>
                  </NavigationMenuItem>
                  <div className="-mx-5 block h-0.5 w-[calc(100%+2.5rem)] border-b border-b-zinc-200" />
                </>
              )}
              <NavigationMenuItem className="mb-2">
                <Popconfirm
                  title="Are you sure you want to log out?"
                  onConfirm={() => {
                    router.push(logoutUrl)
                    if (setIsDrawerOpen) setIsDrawerOpen(false)
                  }}
                  okText="Yes"
                  cancelText="No"
                  // this places the Popconfirm just below the Link in the DOM rather than at the very bottom of the DOM (important for accessibility and prevent buttons being clicked underneath the Popconfirm)
                  getPopupContainer={(trigger) =>
                    trigger.parentNode as HTMLElement
                  }
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
            </>
          )}
        </NavigationMenuList>
      </NavigationMenu>
    )
  }
}

/**
 * Navbar component that is rendered on each page.
 */

type NavMode = 'desktop' | 'compact' | 'drawer'

const HeaderBar: React.FC = () => {
  const { userInfo } = useUserInfo()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [navMode, setNavMode] = useState<NavMode>('drawer')
  const isPhone = useMediaQuery('(max-width: 768px)')
  const availableWidthRef = useRef<HTMLDivElement>(null)
  const regularMeasureRef = useRef<HTMLDivElement>(null)
  const compactMeasureRef = useRef<HTMLDivElement>(null)

  // This is not the usual way to get the courseId from the URL
  // (normally you're supposed to use `params` for the page.tsx and then pass it down as a prop).
  // However, doing it this way makes it much easier to add the navbar to layout.tsx.
  const pathname = usePathname()
  const isLti = pathname.startsWith('/lti')
  const URLSegments = pathname.split('/')

  const courseId = useMemo(() => {
    // LTI only uses a numeric parameter in segment 2 for courses
    if (!isLti && URLSegments[1] !== 'course') {
      return undefined
    }
    const temp = parseInt(URLSegments[2])
    if (!isNaN(temp)) return temp
    return undefined
  }, [URLSegments, isLti])

  const { course } = useCourse(courseId ?? null)

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

  const updateNavMode = useCallback(() => {
    if (isPhone) {
      setNavMode('drawer')
      return
    }

    const availableWidth =
      availableWidthRef.current?.getBoundingClientRect().width ?? 0
    const regularWidth =
      regularMeasureRef.current?.getBoundingClientRect().width ?? 0
    const compactWidth =
      compactMeasureRef.current?.getBoundingClientRect().width ?? 0
    const buffer = 24

    if (regularWidth > 0 && regularWidth <= availableWidth - buffer) {
      setNavMode('desktop')
      return
    }

    if (compactWidth > 0 && compactWidth <= availableWidth - buffer) {
      setNavMode('compact')
      return
    }

    setNavMode('drawer')
  }, [isPhone])

  // Recalculate nav mode before paint based on the measured widths of the
  // available space plus the regular/compact hidden navbars. Those measured
  // widths change when route/course/user state changes which top-level nav
  // items exist (organization vs course, professor vs TA vs student, queue
  // features on/off, etc.), so observing the measurement nodes lets us react
  // without depending on a larger arbitrary dependency list here.
  useLayoutEffect(() => {
    const nodes = [
      availableWidthRef.current,
      regularMeasureRef.current,
      compactMeasureRef.current,
    ].filter(Boolean) as HTMLElement[]

    const observer = new ResizeObserver(() => {
      updateNavMode()
    })

    updateNavMode()
    nodes.forEach((node) => observer.observe(node))

    return () => observer.disconnect()
  }, [updateNavMode])

  return (
    <div ref={availableWidthRef} className="relative w-full">
      {/* These hidden navbars are only used for width measurement. One renders
      the regular desktop nav and the other renders the compact desktop nav so
      we can choose the visible presentation. Below the md breakpoint we force
      drawer mode, which keeps CSS/mobile shrinking from affecting these
      desktop-width measurements. */}
      <div className="pointer-events-none invisible absolute left-0 top-0 -z-10 h-0 w-0 overflow-hidden">
        <div ref={regularMeasureRef} className="w-max">
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
            className="w-max"
            showViewport={false}
          />
        </div>
        <div ref={compactMeasureRef} className="w-max">
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
            isCompactDesktop={true}
            className="w-max"
            showViewport={false}
          />
        </div>
      </div>

      {navMode === 'drawer' ? (
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
            <DrawerContent aria-description="Drawer for main navigation menu">
              {/* INSIDE DRAWER */}
              <div className="flex min-h-[100dvh] flex-col items-start justify-start">
                <DrawerTitle className="my-1 flex w-full items-center justify-center border-b border-b-zinc-200 bg-white py-1 pr-5">
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
                </DrawerTitle>
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
                  forceDrawerPresentation={true}
                />
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      ) : (
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
          isCompactDesktop={navMode === 'compact'}
        />
      )}
    </div>
  )
}

export default HeaderBar
