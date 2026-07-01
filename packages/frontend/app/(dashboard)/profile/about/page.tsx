'use client'
import AboutPage from '@/app/components/AboutPage'
import { ReactElement } from 'react'

/* Note that this is profile/about/page.tsx
Basically the same as root /about/page.tsx except it's got the navbar and is accessible when logged in.
  Could I have done some shenanigans to make it so there's only one /about/page.tsx that displays the navbar n everything when logged in? 
  Yes, but this is just way simpler.
*/
export default function About(): ReactElement {
  return (
    <div className="flex flex-grow flex-col md:mt-2">
      <AboutPage />
    </div>
  )
}
