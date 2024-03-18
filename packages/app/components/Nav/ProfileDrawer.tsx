import { LogoutOutlined, SettingOutlined } from '@ant-design/icons'
import { Menu, Popover } from 'antd'
import Link from 'next/link'
import React, { ReactElement, useState } from 'react'
import styled from 'styled-components'
import SelfAvatar from '../common/SelfAvatar'

const StyleablePopover = ({ className, ...props }: { className: string }) => (
  <Popover {...props} overlayClassName={className} />
)
const NoPaddingPopover: typeof Popover = styled(StyleablePopover)`
  & .ant-popover-inner-content {
    padding: 0px;
  }
  // antd for some reason thinks having 24px of padding on the left and 16px of padding on the right looks good
  .ant-menu-item {
    padding: 0 16px !important;
  }
`

const AvatarButton = styled.button`
  cursor: pointer;
  border: none;
  padding: 0;
  background: none;

  // hover/focus effect
  transition: transform 0.3s ease;
  &:hover,
  &:focus {
    transform: scale(1.1);
  }

  // give it a bit of margins in the mobile navbar drawer
  @media (max-width: 650px) {
    margin-left: 1em;
    margin-top: 1em;
  }
`

export default function ProfileDrawer(ariaUser: string): ReactElement {
  return (
    <>
      <NoPaddingPopover
        content={
          <Menu mode="inline" tabIndex={-1}>
            <Menu.Item key="settings" icon={<SettingOutlined />} tabIndex={-1}>
              <Link href={{ pathname: '/settings' }}>
                <a aria-label="User Settings">Settings</a>
              </Link>
            </Menu.Item>
            <Menu.Item key="logout" icon={<LogoutOutlined />} tabIndex={-1}>
              <Link href={'/api/v1/logout'}>
                <a>Logout</a>
              </Link>
            </Menu.Item>
          </Menu>
        }
        placement="bottomLeft"
        trigger={['click']}
        // insert the popup container right after the AvatarButton in the DOM to ensure you can tab to the menu items right away after opening the dropdown (normally, it will insert the popover at the top of the DOM, which will mess up the tab order)
        getPopupContainer={(trigger) => trigger.parentNode as HTMLElement}
      >
        <AvatarButton aria-label="User Menu">
          {/* show a larger avatar icon for mobile */}
          <SelfAvatar className="hidden sm:inline-block" size={40} />
          <SelfAvatar className="inline-block sm:hidden" size={50} />
        </AvatarButton>
      </NoPaddingPopover>
    </>
  )
}
