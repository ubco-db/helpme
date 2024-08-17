type SchedulePageProps = {
  params: { cid: string }
}

export default async function SchedulePage({ params }: SchedulePageProps) {
  return (
    <div className="mt-20 flex justify-center">
      <pre>
        {`      |\\      _,,,---,,_
ZZZzz /,\`.-'\`\`'    -.  ;-;;,_
     |,4-  ) )-,_. ,\\ (  \`'-'
    '---''(_/--'  \`-'\_) Our buddy is working hard to bring you this page (don't wake him!)`}
      </pre>
    </div>
  )
}
