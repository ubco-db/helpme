type GlanceCardProps = {
  children: React.ReactNode
  title: string
  description: string
}

export default function GlanceCard({
  children,
  title,
  description,
}: GlanceCardProps) {
  return (
    <div className="flex flex-[1_1_30%] flex-row items-center justify-between gap-2 rounded-md bg-white p-4 shadow-lg transition-all">
      <div className="flex flex-col">
        <b>{title}</b>
        <p>{description}</p>
      </div>
      <b>{children}</b>
    </div>
  )
}
