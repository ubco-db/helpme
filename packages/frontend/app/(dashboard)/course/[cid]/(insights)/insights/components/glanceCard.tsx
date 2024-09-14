type GlanceCardProps = {
  children: React.ReactNode
}

export default async function GlanceCard({ children }: GlanceCardProps) {
  return (
    <div className="hover:border-b-helpmeblue flex-[1_1_30%] rounded-md bg-white p-4 shadow-lg transition-all hover:border-b-2 hover:pb-2">
      {children}
    </div>
  )
}
