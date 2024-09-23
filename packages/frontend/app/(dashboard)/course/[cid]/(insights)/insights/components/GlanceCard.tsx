type GlanceCardProps = {
  title: string
  description: string
}

export default function GlanceCard({ title, description }: GlanceCardProps) {
  return (
    <div className="flex flex-[1_1_30%] flex-row items-center justify-center gap-2 rounded-md bg-white p-4 shadow-lg transition-all">
      <b>{title}</b>
      <p>{description}</p>
    </div>
  )
}
