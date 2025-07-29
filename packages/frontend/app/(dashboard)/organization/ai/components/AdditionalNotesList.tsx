import { Button, Input, List, message } from 'antd'
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { cn } from '@/app/utils/generalUtils'

type AdditionalNotesListProps = {
  notes: string[]
  setNotes?: React.Dispatch<React.SetStateAction<string[]>>
  initialNotes?: string[]
  shortenButtons?: boolean
  allowNoteEditing?: boolean
  bordered?: boolean
}

const AdditionalNotesList: React.FC<AdditionalNotesListProps> = ({
  notes,
  setNotes,
  initialNotes,
  shortenButtons,
  allowNoteEditing,
  bordered,
}) => {
  const [input, setInput] = useState<string | undefined>()

  const [isAddingNote, setIsAddingNote] = useState(false)
  const [editingNote, setEditingNote] = useState<number | undefined>()

  useEffect(() => {
    if (initialNotes && setNotes) {
      setNotes(initialNotes)
    }
  }, [])

  const toggleCreate = (mode: boolean) => {
    if (editingNote != undefined) {
      toggleEdit(undefined, false)
    }
    if (mode) {
      setInput('')
      setIsAddingNote(true)
    } else {
      setIsAddingNote(false)
    }
  }

  const toggleEdit = (index: number | undefined, mode: boolean) => {
    if (isAddingNote) {
      toggleCreate(false)
    }

    if (mode && index != undefined) {
      setInput(notes[index])
      setEditingNote(index)
    } else {
      if (mode && index == undefined) {
        message.warning('Cannot edit note, corresponding note not found.')
      }
      setEditingNote(undefined)
    }
  }

  const handleAddNote = (note: string) => {
    if (note.trim() == '') {
      message.warning('Cannot have empty notes, the note was not added.')
      return
    }
    if (setNotes) {
      setNotes((prev) => [...prev, note])
    }
    toggleCreate(false)
  }

  const handleEditNote = (note: string) => {
    if (editingNote == undefined) return
    if (note.trim() == '') {
      message.warning('Cannot have empty notes, the edited note was deleted.')
      handleDeleteNote(editingNote)
    } else {
      if (setNotes) {
        setNotes((prev) => [
          ...prev.slice(0, editingNote),
          note,
          ...prev.slice(editingNote + 1),
        ])
      }
    }
    toggleEdit(undefined, false)
  }

  const handleDeleteNote = (index: number) => {
    if (setNotes) {
      setNotes((prev) => prev.filter((_, i) => i != index))
    }
  }

  return (
    <List
      locale={{ emptyText: 'No notes added.' }}
      bordered={bordered}
      dataSource={notes}
      renderItem={(item: string, index: number) => (
        <List.Item>
          <div className={'flex w-full items-center justify-between gap-2'}>
            {editingNote == index ? (
              <>
                <Input.TextArea
                  maxLength={100}
                  showCount={true}
                  className={'w-full'}
                  style={{ resize: 'none' }}
                  value={input}
                  onChange={(event) =>
                    setInput(
                      (prev) =>
                        event?.currentTarget?.value.replace(/\n/g, '') ?? prev,
                    )
                  }
                />
                <div className={'flex flex-col items-end justify-center gap-2'}>
                  <Button
                    className={cn(shortenButtons ? 'aspect-square' : 'w-full')}
                    icon={<CheckOutlined />}
                    color={'green'}
                    type={'primary'}
                    onClick={() =>
                      input != undefined
                        ? handleEditNote(input.trim())
                        : undefined
                    }
                  >
                    {!shortenButtons && 'Confirm'}
                  </Button>
                  <Button
                    className={cn(shortenButtons ? 'aspect-square' : 'w-full')}
                    icon={<CloseOutlined />}
                    color={'default'}
                    onClick={() => toggleEdit(undefined, false)}
                  >
                    {!shortenButtons && 'Cancel'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <span className={'w-full'}>&#8226; {item}</span>
                <div className={'flex flex-col items-end justify-center gap-2'}>
                  {allowNoteEditing && (
                    <>
                      <Button
                        className={cn(
                          shortenButtons ? 'aspect-square' : 'w-full',
                        )}
                        icon={<EditOutlined />}
                        type={'primary'}
                        onClick={() => toggleEdit(index, true)}
                      >
                        {!shortenButtons && 'Edit'}
                      </Button>
                      <Button
                        className={cn(
                          shortenButtons ? 'aspect-square' : 'w-full',
                        )}
                        icon={<DeleteOutlined />}
                        danger
                        onClick={() => handleDeleteNote(index)}
                      >
                        {!shortenButtons && 'Delete'}
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </List.Item>
      )}
      footer={
        <div className={'flex w-full items-center justify-between gap-2'}>
          {isAddingNote ? (
            <>
              <Input.TextArea
                maxLength={100}
                showCount={true}
                className={'w-full'}
                style={{ resize: 'none' }}
                value={input}
                onChange={(event) =>
                  setInput(
                    (prev) =>
                      event?.currentTarget?.value.replace(/\n/g, '') ?? prev,
                  )
                }
              />
              <div className={'flex flex-col items-end justify-center gap-2'}>
                <Button
                  className={cn(shortenButtons ? 'aspect-square' : 'w-full')}
                  icon={<CheckOutlined />}
                  color={'green'}
                  type={'primary'}
                  onClick={() =>
                    input != undefined ? handleAddNote(input.trim()) : undefined
                  }
                >
                  {!shortenButtons && 'Confirm'}
                </Button>
                <Button
                  className={cn(shortenButtons ? 'aspect-square' : 'w-full')}
                  icon={<CloseOutlined />}
                  color={'default'}
                  onClick={() => toggleCreate(false)}
                >
                  {!shortenButtons && 'Cancel'}
                </Button>
              </div>
            </>
          ) : (
            <div
              className={'flex w-full flex-col items-end justify-center gap-2'}
            >
              {allowNoteEditing && (
                <Button
                  className={cn(shortenButtons ? 'aspect-square' : '')}
                  icon={<PlusOutlined />}
                  type={'primary'}
                  onClick={() => toggleCreate(true)}
                >
                  {!shortenButtons && 'Add Note'}
                </Button>
              )}
            </div>
          )}
        </div>
      }
    />
  )
}

export default AdditionalNotesList
