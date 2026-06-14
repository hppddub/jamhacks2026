// Shared drag-and-drop payload keys + readers for the projects/folders view.

export const DND_PROJECT = 'application/x-bananamov-project';
export const DND_FOLDER = 'application/x-bananamov-folder';

export interface DraggedItem {
  kind: 'project' | 'folder';
  id: string;
}

/** Read the dragged item on drop (getData only works inside onDrop). */
export function readDraggedItem(dt: DataTransfer): DraggedItem | null {
  const project = dt.getData(DND_PROJECT);
  if (project) return { kind: 'project', id: project };
  const folder = dt.getData(DND_FOLDER);
  if (folder) return { kind: 'folder', id: folder };
  return null;
}

/** Whether the current drag carries a movable item (types are readable during dragover). */
export function isDraggingItem(dt: DataTransfer): boolean {
  return dt.types.includes(DND_PROJECT) || dt.types.includes(DND_FOLDER);
}
