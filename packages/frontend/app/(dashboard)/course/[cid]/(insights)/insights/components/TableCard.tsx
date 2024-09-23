type TableCardProps = {
  title: string
  description: string
  tableData: { [key: string]: any }[]
}

export default function TableCard({
  title,
  description,
  tableData,
}: TableCardProps) {
  const header = Object.keys(tableData[0])

  return (
    header && (
      <div className="flex flex-[1_1_30%] flex-col items-center justify-center gap-2 rounded-md bg-white p-4 shadow-lg transition-all">
        <h2>{title}</h2>
        <p>{description}</p>
        <table>
          <thead>
            <tr>
              {header.map((col, index) => (
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
            {tableData.map((row, index) => {
              const cells: React.ReactNode[] = []
              const keys = Object.keys(row)
              for (let i = 0; i < header.length; i++) {
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
      </div>
    )
  )
}
