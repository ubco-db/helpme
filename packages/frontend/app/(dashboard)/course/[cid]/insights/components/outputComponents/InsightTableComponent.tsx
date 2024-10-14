import { TableOutputType } from '@koh/common'
import React, { useMemo } from 'react'
import { GenericInsightComponentProps } from '@/app/(dashboard)/course/[cid]/insights/components/outputComponents/InsightComponent'
import { Empty } from 'antd'

const InsightTableComponent: React.FC<GenericInsightComponentProps> = ({
  insight,
  filterContent,
}) => {
  const tableData = useMemo(
    () => insight.output as TableOutputType,
    [insight.output],
  )

  return (
    <div className="flex flex-[1_1_30%] flex-col items-center justify-center gap-2 rounded-md bg-white p-4 shadow-lg transition-all">
      <h2>{insight.title}</h2>
      <p>{insight.description}</p>
      {filterContent}
      {tableData != undefined ? (
        <table>
          <thead>
            <tr>
              {tableData.headerRow.map((col, index) => (
                <th
                  key={'col-' + index}
                  className={'border-b-2 border-b-zinc-600 p-2'}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.data.map((row, index) => {
              const cells: React.ReactNode[] = []
              const keys = Object.keys(row)
              for (let i = 0; i < tableData.headerRow.length; i++) {
                const cellKey = keys[i]
                if (cellKey) {
                  cells.push(
                    <td
                      key={index + '-' + i}
                      className={i == 0 ? 'p-2' : 'p-2 text-center'}
                    >
                      {row[keys[i]]}
                    </td>,
                  )
                } else {
                  cells.push(<td key={index + '-' + i} className={'p-2'}></td>)
                }
              }
              return <tr key={index}>{cells}</tr>
            })}
          </tbody>
        </table>
      ) : (
        <div className="mx-auto mt-8 w-full p-4">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      )}
    </div>
  )
}

export default InsightTableComponent
