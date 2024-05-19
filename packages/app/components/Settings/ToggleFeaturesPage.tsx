import { QuestionCircleOutlined } from '@ant-design/icons'
import { API } from '@koh/api-client'
import { Form, Spin, message, Switch, Tooltip } from 'antd'
import { ReactElement } from 'react'
import styled from 'styled-components'
import { mutate } from 'swr'
import { useCourseFeatures } from '../../hooks/useCourseFeatures'

type ToggleFeaturesPageProps = { courseId: number }

const ToggleFeaturesPageComponent = styled.div`
  width: 90%;
  margin-left: auto;
  margin-right: auto;
  padding-top: 50px;
`

const CustomFormItem = styled(Form.Item)`
  padding-bottom: 1rem;
  margin-bottom: 1rem;

  font-size: 1rem;
  line-height: 0.5rem;

  &:last-child {
    padding-bottom: 0;
    margin-bottom: 0;
  }
`

const CustomSwitch = styled(Switch)`
  margin-right: 1rem;
`

type FeatureSwitchProps = {
  featureName: string
  defaultChecked: boolean
  title: string
  description: string
  courseId: number
}

const FeatureSwitch = ({
  featureName,
  defaultChecked,
  title,
  description,
  courseId,
}: FeatureSwitchProps): ReactElement => {
  return (
    <CustomFormItem>
      <CustomSwitch
        defaultChecked={defaultChecked}
        onChange={async (e) => {
          await API.course
            .setCourseFeature(courseId, featureName, e.valueOf() as boolean)
            .then(() => {
              message.success(
                `Successfully set ${featureName} feature to ${e.valueOf()}`,
              )
              mutate(`${courseId}/features`)
            })
            .catch((error) => {
              message.error(
                `An error occured while toggling ${featureName} feature: ${error.message}`,
              )
            })
        }}
      />
      <span>
        {title}&nbsp;
        <Tooltip title={description}>
          <QuestionCircleOutlined />
        </Tooltip>
      </span>
    </CustomFormItem>
  )
}

export default function ToggleFeaturesPage({
  courseId,
}: ToggleFeaturesPageProps): ReactElement {
  const courseFeatures = useCourseFeatures(courseId)

  if (!courseFeatures) {
    return <Spin tip="Loading..." size="large" />
  } else {
    return (
      <ToggleFeaturesPageComponent>
        <h2>Enable/Disable Features for this Course</h2>

        <Form className="ml-2">
          <FeatureSwitch
            featureName="asyncQueueEnabled"
            defaultChecked={courseFeatures.asyncQueueEnabled}
            title="Asynchronous Question Centre"
            description="This feature allows students to ask questions asynchronously (e.g. outside of office hours or labs) that can then be answered by the professor. It also features automatic AI-generated answers based on uploaded course content."
            courseId={courseId}
          />
          <FeatureSwitch
            featureName="chatBotEnabled"
            defaultChecked={courseFeatures.chatBotEnabled}
            title="ChatBot"
            description="This feature allows students to ask an AI chatbot questions that will answer their questions based on uploaded course content (located in course admin settings)"
            courseId={courseId}
          />
          <FeatureSwitch
            featureName="queueEnabled"
            defaultChecked={courseFeatures.queueEnabled}
            title="Queues"
            description="This feature allows students to ask questions in a queue that can then be answered by the professor or a TA. Suitable for online, hybrid, and in-person office hours and labs."
            courseId={courseId}
          />
          <FeatureSwitch
            featureName="adsEnabled"
            defaultChecked={courseFeatures.adsEnabled}
            title="Advertisements (Not currently implemented)"
            description="Displays non-intrusive advertisements to help keep the servers running (and to keep us from going bankrupt from those darn OpenAI API fees)."
            courseId={courseId}
          />
        </Form>
      </ToggleFeaturesPageComponent>
    )
  }
}
