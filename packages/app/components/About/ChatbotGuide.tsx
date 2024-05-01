//ChatbotGuide.tsx
import React from 'react'
import { Layout, Menu, Breadcrumb } from 'antd'
import { ChatbotDetails } from './GuideDetails/ChatbotDetails'
import { CustomizeAssistant } from './GuideDetails/CustomizeAssistant'
import NavBar from '../Nav/NavBar'
const { Header, Content, Footer } = Layout

const ChatbotGuide: React.FC = () => {
  return (
    <Layout>
      <Header>
        <NavBar />
      </Header>
      <Content className="bg-white p-10">
        <ChatbotDetails />
        <CustomizeAssistant />
      </Content>
    </Layout>
  )
}

export default ChatbotGuide
