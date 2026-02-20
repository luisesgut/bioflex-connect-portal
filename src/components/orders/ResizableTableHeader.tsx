import { useRef, useState, useCallback } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColumnConfig } from "@/hooks/useColumnConfig";

interface ResizableTableHeaderProps {
  column: ColumnConfig;
  width: number;
  onResize: (id: string, width: number) => void;
  onReorder: (dragId: string, dropId: string) => void;
  children: React.ReactNode;
}

export function ResizableTableHeader({
  column,
  width,
  onResize,
  onReorder,
  children,
}: ResizableTableHeaderProps) {
  const thRef = useRef<HTMLTableCellElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      const startX = e.clientX;
      const startWidth = width;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const newWidth = startWidth + (moveEvent.clientX - startX);
        onResize(column.id, newWidth);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [column.id, width, onResize]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (column.fixed) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData("text/plain", column.id);
      e.dataTransfer.effectAllowed = "move";
    },
    [column.id, column.fixed]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (column.fixed) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setIsDragOver(true);
    },
    [column.fixed]
  );

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const dragId = e.dataTransfer.getData("text/plain");
      if (dragId && dragId !== column.id) {
        onReorder(dragId, column.id);
      }
    },
    [column.id, onReorder]
  );

  return (
    <th
      ref={thRef}
      className={cn(
        "relative select-none group",
        isDragOver && "bg-primary/10",
        !column.fixed && "cursor-grab active:cursor-grabbing"
      )}
      style={{ width: `${width}px`, minWidth: `${column.minWidth || 60}px` }}
      draggable={!column.fixed}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-1">
        {!column.fixed && (
          <GripVertical className="h-3 w-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        )}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
      {/* Resize handle */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 transition-colors",
          isResizing && "bg-primary/50"
        )}
        onMouseDown={handleResizeStart}
      />
    </th>
  );
}
