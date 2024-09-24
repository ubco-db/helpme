'use client'

import { Modal, Upload, message } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import React, { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'
import { useUserInfo } from '@/app/contexts/userContext'
import useSWR from 'swr'
import { API } from '@/app/api'
import { getCroppedImg } from '@/app/utils/generalUtils'

interface AvatarCropperModalProps {
  isOpen: boolean
  uploading: boolean
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

const AvatarCropperModal: React.FC<AvatarCropperModalProps> = ({
  isOpen,
  uploading,
  setUploading,
  onCancel,
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] =
    useState<CroppedAreaPixels | null>(null)
  const [imageType, setImageType] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const { userInfo, setUserInfo } = useUserInfo()
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

  const { data: profile, mutate } = useSWR(`api/v1/profile`, async () =>
    API.profile.index(),
  )

  const beforeUpload = (file: any): boolean => {
    const isValidMimeType = viableFileTypes.includes(file.type)

    if (!isValidMimeType) {
      message.error('You can only upload JPGs or PNGs!')
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
        imageSrc!,
        croppedAreaPixels!,
        imageType!,
      )
      const formData = new FormData()
      formData.append('file', croppedImage)
      const response = await fetch('api/v1/profile/upload_picture', {
        method: 'POST',
        body: formData,
      })
      const data = await response.json()
      if (response.ok) {
        message.success(`${fileName} file uploaded successfully`)
        const newUser = await mutate() //update the context
        setUserInfo({
          ...userInfo,
          photoURL: newUser ? newUser.photoURL : userInfo.photoURL,
        })
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
      title="Crop Avatar"
      open={isOpen}
      onOk={handleCropComplete}
      onCancel={() => onCancel()}
      destroyOnClose={true}
      width={500}
      height={700}
      className="flex flex-col items-center justify-center"
    >
      <Upload
        customRequest={async ({ file }) => await handleUpload(file)}
        beforeUpload={beforeUpload}
        className="mb-2"
        showUploadList={false}
        onChange={() => {
          mutate()
        }}
        maxCount={1}
      >
        <button className="min-w-[500px] rounded-lg border-2 bg-white p-2">
          <UploadOutlined />
          <span className="ml-2">Upload Avatar</span>
        </button>
      </Upload>
      <div className="relative mt-2 h-[300px] w-full">
        <Cropper
          image={imageSrc ?? ''}
          crop={crop}
          zoom={zoom}
          aspect={1}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropCompleteCallback}
          cropShape="round"
          showGrid={false}
        />
      </div>
    </Modal>
  )
}

export default AvatarCropperModal
