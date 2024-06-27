import { Card, Row, Avatar, Button, ButtonProps } from 'antd'
import { ReactElement } from 'react'
import styled from 'styled-components'

export const HorizontalStudentCard = styled(Card)`
  margin-bottom: 8px;
  box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.15);
  background: #ffffff;
  border-radius: 6px;
  padding-left: 8px;
  padding-right: 8px;
  color: #595959;
  .ant-card-body {
    padding: 10px 8px;
  }
`
export const Text = styled.div`
  font-size: 14px;
  line-height: 22px;
  color: #595959;
`

export const CenterRow = styled(Row)`
  align-items: center;
`

export const Photo = styled(Avatar)`
  margin-right: 16px;

  @media (max-width: 992px) {
    display: none;
  }
`

export const VerticalDivider = styled.div`
  @media (min-width: 650px) {
    border-right: 1px solid #cfd6de;
    margin: 0 1rem;
  }
  @media (min-width: 1000px) {
    margin: 0 2rem;
  }
`
export const QueueInfoColumnButtonStyle = styled(Button)<{
  hasdemos?: boolean
  isstudent?: boolean
}>`
  font-weight: 500;
  font-size: 14px;
  border: 1px solid #cfd6de;
  border-radius: 6px;
  margin-bottom: 12px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  // less margin and width on mobile
  @media (max-width: 650px) {
    margin-bottom: 0;
    width: ${(props) =>
      props.isstudent ? '100%' : props.hasdemos ? '45%' : '30%'};
  }
`

export const QueueInfoColumnButton = (props: ButtonProps): ReactElement => (
  <QueueInfoColumnButtonStyle size="large" {...props} />
)

export const EditQueueButton = styled(QueueInfoColumnButton)`
  color: #212934;
`
