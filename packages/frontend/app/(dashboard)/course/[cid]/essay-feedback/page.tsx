import EssayFeedbackClient from './EssayFeedbackClient'

export default function EssayFeedbackPage(props: {
  params: Promise<{ cid: string }>
}) {
  return <EssayFeedbackClient params={props.params} />
}
