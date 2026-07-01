import React from 'react'
import HeaderBar from '@/app/components/HeaderBar'
import StandardPageContainer from '@/app/components/standardPageContainer'
import LoginPage from './components/LoginPage'

export default function Login() {
  return (
    <>
      <header className={`border-b border-b-zinc-200 bg-white`}>
        <StandardPageContainer className="!pl-0">
          <HeaderBar />
        </StandardPageContainer>
      </header>
      <LoginPage />
    </>
  )
}
