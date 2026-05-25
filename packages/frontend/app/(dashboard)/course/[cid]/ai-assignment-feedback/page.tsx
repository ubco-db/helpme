import AssignmentFeedbackClient from './AssignmentFeedbackClient'

export default function AssignmentFeedbackPage(props: {
  params: Promise<{ cid: string }>
}) {
  return <AssignmentFeedbackClient params={props.params} />
}
