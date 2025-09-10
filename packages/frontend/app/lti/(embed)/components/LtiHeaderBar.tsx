'use client'

import React, {
  HTMLAttributeAnchorTarget,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useUserInfo } from '@/app/contexts/userContext'
import { cn, getRoleInCourse } from '@/app/utils/generalUtils'
import Image from 'next/image'
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
import { GetCourseResponse, OrganizationRole, Role, User } from '@koh/common'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import {
  ExpandOutlined,
  HomeOutlined,
  LogoutOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { MenuIcon, Undo2 } from 'lucide-react'
import { SelfAvatar } from '@/app/components/UserAvatar'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from '@/app/components/ui/drawer'
import { API } from '@/app/api'
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

  return (
    <NavigationMenuLink ref={ref} asChild active={isActive}>
      <NextLink
        href={href}
        prefetch={undefined}
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
  course,
  setIsDrawerOpen,
  orientation = 'horizontal',
}: {
  userInfo: User
  course?: GetCourseResponse
  setIsDrawerOpen?: React.Dispatch<React.SetStateAction<boolean>>
  orientation?: 'horizontal' | 'vertical'
}) => {
  const role = getRoleInCourse(userInfo, course?.id ?? -1)
  const router = useRouter()

  const setNavigationSubMenuRightSide = useCallback(() => {
    const viewportElement = document.getElementById('navigation-menu-viewport')
    if (viewportElement) {
      viewportElement.classList.remove('left-0')
      viewportElement.classList.add('right-0')
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
    router.push('lti')
    return <CenteredSpinner tip="Course is archived. Redirecting..." />
  } else {
    return (
      <NavigationMenu orientation={orientation} style={{ zIndex: 1100 }}>
        <NavigationMenuList>
          <NextLink
            href={course ? `/lti/${course.id}` : '/lti'}
            aria-hidden="true"
            className="hidden md:block"
            tabIndex={-1}
            onClick={() => setIsDrawerOpen && setIsDrawerOpen(false)}
          >
            {/* This organization logo is only visible on desktop */}
            <Image
              width={48}
              height={48}
              className="h-12 w-full object-contain p-1 pl-4"
              alt="Organization Logo"
              src={`/api/v1/organization/${userInfo.organization?.orgId}/get_logo/${userInfo.organization?.organizationLogoUrl}`}
            />
          </NextLink>
          {course ? (
            <>
              <NavigationMenuItem>
                <Link
                  className="!font-bold "
                  href={`/lti/${course.id}`}
                  onClick={() => setIsDrawerOpen && setIsDrawerOpen(false)}
                >
                  {/* <House strokeWidth={1.5} className='mr-3' /> */}
                  <HomeOutlined className="mr-3 text-2xl" />
                  {course.name}
                </Link>
              </NavigationMenuItem>
              {[Role.PROFESSOR].includes(role) && (
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
              <NavigationMenuItem>
                <Link
                  href={`/lti`}
                  onClick={() => setIsDrawerOpen && setIsDrawerOpen(false)}
                >
                  <Undo2 strokeWidth={1.5} className="mr-3" />
                  My Courses
                </Link>
              </NavigationMenuItem>
            </>
          ) : !course ? (
            <>
              <NavigationMenuItem>
                <Link
                  href="/lti"
                  className="md:pl-8"
                  onClick={() => setIsDrawerOpen && setIsDrawerOpen(false)}
                >
                  My Courses
                </Link>
              </NavigationMenuItem>
            </>
          ) : null}
          {/* DESKTOP ONLY PART OF NAVBAR */}
          <div className={'!ml-auto hidden items-center md:flex'}>
            <NavigationMenuItem>
              <Link
                href={`${process.env.NEXT_PUBLIC_HOST_PROTOCOL}://${process.env.NEXT_PUBLIC_HOSTNAME}${process.env.NEXT_PUBLIC_DEV_PORT ? `:${process.env.NEXT_PUBLIC_DEV_PORT}` : ''}/`}
                target={'_blank'}
              >
                <ExpandOutlined className={'mr-2'} /> Open HelpMe
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem className="!ml-auto hidden md:block">
              <NavigationMenuTrigger
                className={`!pl-4`}
                onFocus={setNavigationSubMenuRightSide}
                onClick={setNavigationSubMenuRightSide}
                onMouseEnter={setNavigationSubMenuRightSide}
              >
                <SelfAvatar size={40} className="mr-2" />
                {userInfo?.firstName}
              </NavigationMenuTrigger>
              <NavigationMenuContent className="hidden md:flex">
                <ul className="grid w-max min-w-[200px] grid-cols-1 gap-1 p-2">
                  <ListItem
                    style={{ zIndex: 2000 }}
                    key="logout"
                    title="Logout"
                    titleElement={<span className="text-red-700">Log Out</span>}
                    href="/api/v1/logout?lti=true"
                  ></ListItem>
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </div>
          {/* MOBILE ONLY PART OF NAVBAR */}
          <div className="!mb-2 !mt-auto -mr-5 block w-[calc(100%+1.25rem)] border-b border-b-zinc-200 md:hidden" />
          <div className={'flex flex-col md:hidden'}>
            <NavigationMenuItem>
              <Link
                href={`${process.env.NEXT_PUBLIC_HOST_PROTOCOL}://${process.env.NEXT_PUBLIC_HOSTNAME}${process.env.NEXT_PUBLIC_DEV_PORT ? `:${process.env.NEXT_PUBLIC_DEV_PORT}` : ''}/`}
                target={'_blank'}
              >
                <ExpandOutlined className={'mr-2'} /> Open HelpMe
              </Link>
            </NavigationMenuItem>
            <NavigationMenuItem className="md:hidden">
              <SelfAvatar size={40} className="mr-2" />
              {userInfo?.firstName}
            </NavigationMenuItem>
            <NavigationMenuItem className="mb-2 md:hidden">
              <Popconfirm
                title="Are you sure you want to log out?"
                onConfirm={() => {
                  router.push('/api/v1/logout?lti=true')
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
                  href="/api/v1/logout?lti=true"
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
          </div>
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
  const pathname = usePathname()

  const courseId = useMemo(() => {
    const urlSegments = pathname.split('/')
    const temp = parseInt(urlSegments[2])
    if (!isNaN(temp)) return temp
    return undefined
  }, [pathname])

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

  // DESKTOP HEADER
  return isDesktop ? (
    <NavBar userInfo={userInfo} course={course} />
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
          {course?.name}
        </h1>
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
              course={course}
              orientation="vertical"
              setIsDrawerOpen={setIsDrawerOpen}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

export default HeaderBar
