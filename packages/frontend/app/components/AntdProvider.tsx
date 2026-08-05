'use client'
import { StyleProvider } from '@ant-design/cssinjs'
import { App, ConfigProvider } from 'antd'
import type { FC, PropsWithChildren } from 'react'

import '@ant-design/v5-patch-for-react-19'

/* This wrapper is a fix to allow turbopack (next.js 15) to work with antd.
See https://github.com/ant-design/v5-patch-for-react-19/issues/27
and https://github.com/ant-design/ant-design/discussions/52505#discussioncomment-12184111


This is also where you can configure global antd stuff. See:
- https://ant.design/components/app
- https://ant.design/components/config-provider
- https://ant.design/docs/react/customize-theme
*/
// Suppress antd static function context warning (e.g. message.success/error)
if (typeof window !== 'undefined') {
  ;(['error', 'warn'] as const).forEach((method) => {
    const original = console[method]
    console[method] = (...args: unknown[]) => {
      const match = args.some(
        (arg) =>
          typeof arg === 'string' &&
          arg.includes(
            '[antd: message] Static function can not consume context',
          ),
      )
      if (match) return
      original(...args)
    }
  })
}

const AntdProvider: FC<PropsWithChildren> = ({ children }) => {
  return (
    <StyleProvider>
      <ConfigProvider
        theme={{
          hashed: false,
          components: {
            Button: {
              colorPrimary: '#3684c6', // helpme blue
              algorithm: true,
            },
          },
        }}
      >
        <App component={false} notification={{ placement: 'bottomRight' }}>
          {children}
        </App>
      </ConfigProvider>
    </StyleProvider>
  )
}

export default AntdProvider
