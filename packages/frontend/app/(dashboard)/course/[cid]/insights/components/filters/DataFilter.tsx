import React, { useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, Dropdown, MenuProps } from 'antd'
import FilterWrapper from '@/app/(dashboard)/course/[cid]/insights/components/filters/FilterWrapper'

type DataFilterProps = {
  dataKeys: string[]
  selectedData: string[]
  setSelectedData: (arr: string[]) => void
}
const DataFilter: React.FC<DataFilterProps> = ({
  dataKeys,
  selectedData,
  setSelectedData,
}) => {
  useEffect(() => {
    setSelectedData(dataKeys)
  }, [dataKeys, setSelectedData])

  const [open, setOpen] = useState<boolean>(false)

  const items = useMemo(
    () =>
      dataKeys.map((key, index) => {
        return {
          key: index,
          label: (
            <Checkbox
              checked={selectedData.includes(key)}
              onChange={() => {
                setSelectedData(
                  selectedData.includes(key)
                    ? dataKeys.filter(
                        (s) => selectedData.includes(s) && s != key,
                      )
                    : dataKeys.filter(
                        (s) => selectedData.includes(s) || s == key,
                      ),
                )
              }}
            >
              {(key + '').replace(/_/g, ' ')}
            </Checkbox>
          ),
        }
      }) as MenuProps['items'],
    [dataKeys, selectedData, setSelectedData],
  )

  return (
    items != undefined && (
      <FilterWrapper title={'Data Sets'}>
        <Dropdown
          menu={{
            items,
            onClick: () => undefined,
          }}
          trigger={['click']}
          onOpenChange={(open, info) => {
            if (info.source == 'trigger' || open) {
              setOpen(open)
            }
          }}
          open={open}
        >
          <Button>Selected Data Sets ({selectedData.length})</Button>
        </Dropdown>
      </FilterWrapper>
    )
  )
}

export default DataFilter
