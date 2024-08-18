import React from 'react'
import { Col, ColorPicker, ColorPickerProps, Divider, Row, theme } from 'antd'
import {
  generate,
  green,
  presetPalettes,
  red,
  gold,
  magenta,
} from '@ant-design/colors'

type Presets = Required<ColorPickerProps>['presets'][number]

/**
 * A simple antd ColorPicker with some preset color palettes.
 */
const ColorPickerWithPresets: React.FC<ColorPickerProps> = ({ ...props }) => {
  const { token } = theme.useToken()
  const genColorPresets = (presets = presetPalettes) =>
    Object.entries(presets).map<Presets>(([label, colors]) => ({
      label,
      colors,
    }))
  const colorPresets = genColorPresets({
    primary: generate(token.colorPrimary),
    red,
    green,
    gold,
    magenta,
  })

  const customPanelRender: ColorPickerProps['panelRender'] = (
    _,
    { components: { Picker, Presets } },
  ) => (
    <Row justify="space-between" wrap={false}>
      <Col span={13}>
        <Presets />
      </Col>
      <Divider type="vertical" style={{ height: 'auto' }} />
      <Col flex="auto">
        <Picker />
      </Col>
    </Row>
  )

  return (
    <ColorPicker
      {...props}
      styles={{ popupOverlayInner: { width: 480 } }}
      panelRender={customPanelRender}
      presets={colorPresets}
    />
  )
}

export default ColorPickerWithPresets
