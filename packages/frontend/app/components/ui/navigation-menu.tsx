import * as React from 'react'
import * as NavigationMenuPrimitive from '@radix-ui/react-navigation-menu'
import { cva } from 'class-variance-authority'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/app/utils/generalUtils'

const NavigationContext = React.createContext<{
  orientation?: 'vertical' | 'horizontal'
}>({})

const isHorizontalNavigation = (orientation?: 'vertical' | 'horizontal') =>
  !orientation || orientation === 'horizontal'

const useNavigationOrientation = () => React.useContext(NavigationContext)

type NavigationMenuProps = React.ComponentPropsWithoutRef<
  typeof NavigationMenuPrimitive.Root
> & {
  showViewport?: boolean
}

/**
 * This is a shadcn navigation menu component. It is mostly the same as the default except with darker hover styles as well as more padding on its elements.
 * It also has custom styles for the submenu (i.e. the "Queues" tab) and support for vertical orientation
 * It also has a bunch of other styles changed (e.g. shared mobile-like
 * active/hover states plus support for drawer-specific layout behavior).
 * I would not recommend updating this component to future shadcn versions of the component.
 */
const NavigationMenu = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Root>,
  NavigationMenuProps
>(({ className, children, showViewport = true, ...props }, ref) => (
  <NavigationContext.Provider value={{ orientation: props.orientation }}>
    <NavigationMenuPrimitive.Root
      ref={ref}
      className={cn(
        'child-divs-w-full relative z-10 flex w-full flex-1 justify-start bg-white',
        (!props.orientation || props.orientation === 'horizontal') &&
          'items-center',
        props.orientation === 'vertical' && 'flex-col items-start px-5',
        className,
      )}
      orientation={props.orientation}
      {...props}
    >
      {children}
      {showViewport && <NavigationMenuViewport />}
    </NavigationMenuPrimitive.Root>
  </NavigationContext.Provider>
))
NavigationMenu.displayName = NavigationMenuPrimitive.Root.displayName

const NavigationMenuList = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.List>
>(({ className, ...props }, ref) => {
  const { orientation } = React.useContext(NavigationContext)
  return (
    <NavigationMenuPrimitive.List
      ref={ref}
      className={cn(
        'group flex w-full flex-1 list-none justify-start',
        (!orientation || orientation === 'horizontal') && 'items-center',
        orientation === 'vertical' && 'h-full flex-col items-start space-y-1',
        className,
      )}
      {...props}
    />
  )
})
NavigationMenuList.displayName = NavigationMenuPrimitive.List.displayName

const NavigationMenuItem = NavigationMenuPrimitive.Item

/**
 * These are the styles that get applied to the links
 */
const navigationMenuTriggerStyle = (orientation?: 'vertical' | 'horizontal') =>
  cn(
    'group', // Grouping for hover and focus states
    'inline-flex', // Display type
    'h-10', // Height
    'items-center', // Vertical alignment
    'justify-start', // Horizontal alignment
    'rounded-md', // Border radius
    'disabled:pointer-events-none', // Disabled state pointer events
    'disabled:opacity-50', // Disabled state opacity
    'text-black',
    'bg-white', // Background color
    'pl-4 pr-8', // Horizontal padding
    'py-7', // Vertical padding
    'text-sm', // Text size
    'font-medium', // Font weight
    'transition-colors', // Transition for color changes
    'data-[state=open]:bg-zinc-300/50', // Open state background color
    'focus:outline-none', // Focus outline removal
    'hover:text-zinc-900', // Hover text color
    'focus:text-zinc-900', // Focus text color
    'hover:bg-zinc-200/70', // Hover background color
    'focus:bg-zinc-200', // Focus background color
    'data-[active]:bg-zinc-300/80', // Active state background color
    // Dark mode styles (came with shadcn, haven't touched them)
    'dark:bg-zinc-950', // Dark mode background color
    'dark:hover:bg-zinc-800', // Dark mode hover background color
    'dark:hover:text-zinc-50', // Dark mode hover text color
    'dark:focus:bg-zinc-800', // Dark mode focus background color
    'dark:focus:text-zinc-50', // Dark mode focus text color
    'dark:data-[active]:bg-zinc-800/50', // Dark mode active state background color
    'dark:data-[state=open]:bg-zinc-800/50', // Dark mode open state background color
    isHorizontalNavigation(orientation)
      ? 'w-max max-w-none'
      : 'w-full max-w-none',
  )

/**
 * This is the same as above except without the text and formatting changes.
 * It's only used for the submenu in the navigation bar (i.e. the "Queues" tab)
 */
const navigationMenuTriggerStyleForSubMenu = cva([
  'hover:bg-zinc-200/70',
  'hover:text-zinc-900', // Hover state
  'text-black',
  'transition-colors', // Transition for color changes
  'disabled:pointer-events-none',
  'disabled:opacity-50', // Disabled state
  'data-[active]:bg-zinc-300/90',
  'data-[state=open]:bg-zinc-300/50', // Active and open state backgrounds
  'dark:bg-zinc-950', // Dark mode background
  'dark:data-[active]:bg-zinc-800/50',
  'dark:data-[state=open]:bg-zinc-800/50', // Dark mode active and open state backgrounds
])

const NavigationMenuTrigger = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  const { orientation } = useNavigationOrientation()

  return (
    <NavigationMenuPrimitive.Trigger
      ref={ref}
      className={cn(
        navigationMenuTriggerStyle(orientation),
        'group',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown
        className="relative top-[1px] ml-1 h-3 w-3 transition duration-200 group-data-[state=open]:rotate-180"
        aria-hidden="true"
      />
    </NavigationMenuPrimitive.Trigger>
  )
})
NavigationMenuTrigger.displayName = NavigationMenuPrimitive.Trigger.displayName

const NavigationMenuContent = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Content>
>(({ className, ...props }, ref) => {
  const { orientation } = useNavigationOrientation()

  return (
    <NavigationMenuPrimitive.Content
      ref={ref}
      className={cn(
        'data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52 left-0 top-0 w-full',
        isHorizontalNavigation(orientation) && 'absolute w-auto',
        className,
      )}
      {...props}
    />
  )
})
NavigationMenuContent.displayName = NavigationMenuPrimitive.Content.displayName

const NavigationMenuLink = NavigationMenuPrimitive.Link

const NavigationMenuViewport = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Viewport>
>(({ className, ...props }, ref) => {
  const { orientation } = useNavigationOrientation()
  return (
    <div
      id="navigation-menu-viewport"
      className={cn(
        'absolute flex justify-center',
        (!orientation || orientation === 'horizontal') && 'left-0 top-full',
        orientation === 'vertical' && 'left-2 top-[7.1rem]',
      )}
    >
      <NavigationMenuPrimitive.Viewport
        className={cn(
          'origin-top-center data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-90 relative mt-1.5 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-md border border-zinc-200 bg-white text-zinc-950 shadow-lg dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50',
          isHorizontalNavigation(orientation) &&
            'w-[var(--radix-navigation-menu-viewport-width)]',
          className,
        )}
        ref={ref}
        {...props}
      />
    </div>
  )
})
NavigationMenuViewport.displayName =
  NavigationMenuPrimitive.Viewport.displayName

const NavigationMenuIndicator = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Indicator>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Indicator>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Indicator
    ref={ref}
    className={cn(
      'data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:fade-in top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden',
      className,
    )}
    {...props}
  >
    <div className="relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-zinc-200 shadow-md dark:bg-zinc-800" />
  </NavigationMenuPrimitive.Indicator>
))
NavigationMenuIndicator.displayName =
  NavigationMenuPrimitive.Indicator.displayName

export {
  navigationMenuTriggerStyle,
  navigationMenuTriggerStyleForSubMenu,
  useNavigationOrientation,
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport,
}
