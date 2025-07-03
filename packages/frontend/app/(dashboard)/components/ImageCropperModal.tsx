'use client'

import { Button, Modal, Upload, message } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import React, { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'
import { getCroppedImg } from '@/app/utils/generalUtils'

interface ImageCropperModalProps {
  isOpen: boolean
  circular: boolean
  aspect: number // Fraction to represent the aspect ratio of crop
  imgName: string // Don't confuse with file names, this referring to the type of image in the app (e.g. Avatar, Banner, etc.)
  postURL: string // API URL to post the cropped image to
  onUpdateComplete: (photoURL: string) => void
  setUploading: (uploading: boolean) => void
  onCancel: () => void
}

type CroppedArea = {
  x: number
  y: number
  width: number
  height: number
}

type CroppedAreaPixels = {
  x: number
  y: number
  width: number
  height: number
}

const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  isOpen,
  circular,
  aspect,
  imgName,
  postURL,
  onUpdateComplete,
  setUploading,
  onCancel,
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] =
    useState<CroppedAreaPixels | null>(null)
  const [imageType, setImageType] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [imageSrc, setImageSrc] = useState<string | null>(null)

  const onCropCompleteCallback = useCallback(
    (croppedArea: CroppedArea, croppedAreaPixels: CroppedAreaPixels) => {
      setCroppedAreaPixels(croppedAreaPixels)
    },
    [],
  )

  // MIME types that are compatible as inputs with the sharp library in the backend
  const viableFileTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/gif',
    'image/svg+xml',
    'image/tiff',
  ]

  const beforeUpload = (file: any): boolean => {
    const isValidMimeType = viableFileTypes.includes(file.type)

    if (!isValidMimeType) {
      message.error(
        'Only the following image formats are supported: JPEG/JPG, PNG, WEBP, AVIF, GIF, SVG, and TIFF.',
      )
    }

    const isLt5M = file.size / 1024 / 1024 < 5
    if (!isLt5M) {
      message.error('Image must smaller than 5MB!')
    }

    return isValidMimeType && isLt5M
  }

  const handleUpload = async (file: any): Promise<void> => {
    const reader = new FileReader()
    reader.onload = () => {
      setImageSrc(reader.result as string)
      setImageType(file.type)
      setFileName(file.name)
    }
    reader.readAsDataURL(file)
  }

  const handleCropComplete = async () => {
    if (!imageSrc || !croppedAreaPixels || !imageType) {
      return
    }
    try {
      setUploading(true) // Start the upload state
      const croppedImage = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        imageType,
      )
      const formData = new FormData()
      formData.append('file', croppedImage)
      const response = await fetch(postURL, {
        method: 'POST',
        body: formData,
      })
      const data = await response.json()
      if (response.ok) {
        message.success(`${fileName} file uploaded successfully`)
        onUpdateComplete(data.fileName)
      } else {
        message.error(`${fileName} file upload failed: ${data.message}`)
      }
    } catch (error) {
      message.error(`Error uploading ${fileName}. Please try again.`)
    } finally {
      setUploading(false) // Reset the upload state regardless of success or error
      onCancel() // Close the modal
    }
  }

  return (
    <Modal
      title={`Crop ${imgName}`}
      open={isOpen}
      onOk={handleCropComplete}
      onCancel={() => onCancel()}
      okButtonProps={{ disabled: !imageSrc }}
      destroyOnHidden={true}
      width={{
        xs: '90%',
        sm: '85%',
        md: '80%',
        lg: '75%',
        xl: '70%',
        xxl: '65%',
      }}
      className="flex flex-col items-center justify-center"
    >
      <Upload
        customRequest={async ({ file }) => await handleUpload(file)}
        beforeUpload={beforeUpload}
        className="mb-2"
        showUploadList={false}
        maxCount={1}
        accept=".jpg,.jpeg,.png,.webp,.avif,.gif,.svg,.tiff"
      >
        <Button className="min-w-[85vw] py-5 lg:min-w-[30vw]">
          <UploadOutlined />
          <span className="ml-2">{`Upload ${imgName}`}</span>
        </Button>
      </Upload>
      <div className="relative mt-2 min-h-80 w-full">
        <Cropper
          image={imageSrc ?? ''}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropCompleteCallback}
          cropShape={circular ? 'round' : 'rect'}
          showGrid={false}
        />
      </div>
    </Modal>
  )
}

export default ImageCropperModal
