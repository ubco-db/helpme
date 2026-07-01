'use client'

import { OrganizationProfessor, OrganizationRole } from '@koh/common'
import { Select, Tag, Tooltip } from 'antd'
import { CrownFilled } from '@ant-design/icons'

import { SelectProps } from 'antd'

type ProfessorSelectorProps = {
  professors: OrganizationProfessor[]
} & SelectProps

const ProfessorSelector: React.FC<ProfessorSelectorProps> = ({
  professors,
  ...selectProps
}) => {
  return (
    <Select
      mode="multiple"
      placeholder="Select professors"
      showSearch
      optionFilterProp="name"
      options={professors.map((prof: OrganizationProfessor) => ({
        key: `${prof.organizationUser.name}-${prof.organizationUser.id}`,
        // This is the common label that's shown in both the Select box and its dropdown
        label: (
          <span>
            {prof.organizationUser.name}
            {prof.trueRole == OrganizationRole.ADMIN && (
              <Tooltip title={'This user is an organization administrator.'}>
                <CrownFilled
                  className={
                    'ml-1 text-yellow-500 transition-all hover:text-yellow-300'
                  }
                />
              </Tooltip>
            )}
          </span>
        ),
        value: prof.organizationUser.id,
        // Fun fact: you can add your own data elements to the select options. You can then use these properties in filterSort and optionRender
        name: prof.organizationUser.name,
        email: prof.organizationUser.email,
      }))}
      filterSort={(optionA, optionB) =>
        (optionA?.name ?? '')
          .toLowerCase()
          .localeCompare((optionB?.name ?? '').toLowerCase())
      }
      optionRender={(
        option, // This adds the emails to each option *only in the dropdown*
      ) => (
        <div>
          {option.data.label}
          <span className="ml-2 text-gray-400">{option.data.email}</span>
        </div>
      )}
      tagRender={(props) => {
        const { label, value, closable, onClose } = props
        const onPreventMouseDown = (
          event: React.MouseEvent<HTMLSpanElement>,
        ) => {
          event.preventDefault()
          event.stopPropagation()
        }
        // find the professor with the given id and see if they have lacksProfOrgRole
        const match = professors.find(
          (prof) => prof.organizationUser.id === value,
        )
        const lacksProfOrgRole = ![
          OrganizationRole.ADMIN,
          OrganizationRole.PROFESSOR,
        ].includes(match?.trueRole ?? OrganizationRole.MEMBER)

        return (
          <Tooltip
            title={
              lacksProfOrgRole
                ? 'This user lacks the Professor role in this organization, meaning they cannot create their own courses.'
                : ''
            }
          >
            <Tag
              color={lacksProfOrgRole ? 'orange' : 'blue'}
              onMouseDown={onPreventMouseDown}
              closable={closable}
              onClose={onClose}
              style={{ marginInlineEnd: 4 }}
            >
              <span>{label}</span>
            </Tag>
          </Tooltip>
        )
      }}
      {...selectProps}
    />
  )
}

export default ProfessorSelector
