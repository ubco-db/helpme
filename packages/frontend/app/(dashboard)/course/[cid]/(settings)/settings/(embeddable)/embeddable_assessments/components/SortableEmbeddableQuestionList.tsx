import type { DragEndEvent, DraggableAttributes } from '@dnd-kit/core'
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { GetProps } from 'antd'
import { Button, List } from 'antd'
import {
  AssignmentQuestionEntry,
} from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/embeddable_assessments/components/UpsertEmbeddableAssignmentModal'
import { EmbeddableQuestion } from '@koh/common'
import EmbeddableQuestionDisplay
  from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/components/EmbeddableQuestionDisplay'
import { DeleteOutlined, HolderOutlined } from '@ant-design/icons'
import { createContext, useContext, useMemo } from 'react'
import { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities'

interface SortableListItemContextProps {
  setActivatorNodeRef?: (element: HTMLElement | null) => void;
  listeners?: SyntheticListenerMap;
  attributes?: DraggableAttributes;
}

const SortableListItemContext = createContext<SortableListItemContextProps>({});

const DragHandle: React.FC = () => {
  const { setActivatorNodeRef, listeners, attributes } = useContext(SortableListItemContext);
  return (
    <Button
      type="text"
      size="small"
      icon={<HolderOutlined />}
      style={{ cursor: 'move' }}
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
    />
  );
};

const SortableListItem: React.FC<GetProps<typeof List.Item> & { itemKey: number }> = (props) => {
  const { itemKey, style, ...rest } = props;

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: itemKey });

  const listStyle: React.CSSProperties = {
    ...style,
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: 'relative', zIndex: 9999 } : {}),
  };

  const memoizedValue = useMemo<SortableListItemContextProps>(
    () => ({ setActivatorNodeRef, listeners, attributes }),
    [setActivatorNodeRef, listeners, attributes],
  );

  return (
    <SortableListItemContext.Provider value={memoizedValue}>
      <List.Item {...rest} ref={setNodeRef} style={listStyle} />
    </SortableListItemContext.Provider>
  );
};

type SortableEmbeddableQuestionListProps = {
  questions: AssignmentQuestionEntry[],
  setQuestions: React.Dispatch<React.SetStateAction<AssignmentQuestionEntry[]>>,
  allQuestions: EmbeddableQuestion[],
}

const SortableEmbeddableQuestionList: React.FC<SortableEmbeddableQuestionListProps> = ({
  questions,
  setQuestions,
  allQuestions
}) => {

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 1,
      },
    }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!active || !over) {
      return;
    }
    if (active.id !== over.id) {
      setQuestions((prev) => {
        const activeIndex = prev.findIndex((i) => i.key === active.id);
        const overIndex = prev.findIndex((i) => i.key === over.id);
        return arrayMove(prev, activeIndex, overIndex);
      });
    }
  };

  return (
    <div className={'max-h-[50vh] overflow-y-auto overflow-x-hidden'}>
      <DndContext
        sensors={sensors}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={onDragEnd}
        id="list-drag-sorting"
      >
        <SortableContext items={questions.map((item) => item.key)} strategy={verticalListSortingStrategy}>
          <List
            dataSource={questions}
            renderItem={(item) => (
              <SortableListItem key={item.key} itemKey={item.key}>
                <div className={'w-full flex'}>
                  <DragHandle />
                  <EmbeddableQuestionDisplay
                    item={item.questionId ? allQuestions.find(v => v.id == item.questionId)! : ({
                      ...item.createParams,
                      name: !item.createParams?.name ? `New Question` : item.createParams?.name,
                    } as unknown as EmbeddableQuestion)}
                    showDates={false}
                  />
                  <Button className={'ml-2'} icon={<DeleteOutlined/>} danger onClick={() => setQuestions(prev => prev.filter(v => v.key !== item.key))}/>
                </div>
              </SortableListItem>
            )}
          />
        </SortableContext>
      </DndContext>
    </div>
  )
}

export default SortableEmbeddableQuestionList