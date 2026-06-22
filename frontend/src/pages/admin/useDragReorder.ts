import { useRef, useState } from 'react'

// Lightweight native HTML5 drag-to-reorder. Attach dragHandleProps to a small
// grip element and dropTargetProps to each row; onReorder receives the new order.
export function useDragReorder<T extends { id: number }>(
  items: T[],
  onReorder: (next: T[]) => void,
) {
  const dragId = useRef<number | null>(null)
  const [overId, setOverId] = useState<number | null>(null)

  const dragHandleProps = (id: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      dragId.current = id
      e.dataTransfer.effectAllowed = 'move'
    },
    onDragEnd: () => { dragId.current = null; setOverId(null) },
  })

  const dropTargetProps = (id: number) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (overId !== id) setOverId(id)
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      const from = dragId.current
      dragId.current = null
      setOverId(null)
      if (from == null || from === id) return
      const arr = [...items]
      const fromIdx = arr.findIndex(i => i.id === from)
      const toIdx = arr.findIndex(i => i.id === id)
      if (fromIdx === -1 || toIdx === -1) return
      const [moved] = arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, moved)
      onReorder(arr)
    },
  })

  return { dragHandleProps, dropTargetProps, overId }
}
