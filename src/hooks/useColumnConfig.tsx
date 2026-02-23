import { useState, useCallback, useEffect } from "react";

export interface ColumnConfig {
  id: string;
  label: string;
  adminOnly?: boolean;
  align?: "left" | "right";
  defaultWidth?: number;
  minWidth?: number;
  filterable?: boolean;
  sortable?: boolean;
  fixed?: boolean; // Cannot be reordered (e.g., actions column)
}

interface ColumnState {
  order: string[];
  widths: Record<string, number>;
}

const STORAGE_KEY = "po-table-column-config";

export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: "po_number", label: "PO Number", defaultWidth: 140, minWidth: 100 },
  { id: "product", label: "Product", defaultWidth: 200, minWidth: 120, filterable: true },
  { id: "customer", label: "Customer", defaultWidth: 120, minWidth: 80, filterable: true },
  { id: "item_type", label: "Item Type", defaultWidth: 120, minWidth: 80, filterable: true },
  { id: "dp_sales_csr", label: "DP Sales/CSR", defaultWidth: 130, minWidth: 80, filterable: true },
  { id: "pt_code", label: "PT Code", adminOnly: true, defaultWidth: 110, minWidth: 80 },
  { id: "quantity", label: "Quantity", defaultWidth: 110, minWidth: 80 },
  { id: "value", label: "Value", adminOnly: true, defaultWidth: 100, minWidth: 80 },
  { id: "status", label: "Status", defaultWidth: 120, minWidth: 90, filterable: true },
  { id: "sales_order", label: "Sales Order", adminOnly: true, defaultWidth: 120, minWidth: 80 },
  { id: "priority", label: "Priority", defaultWidth: 100, minWidth: 80, filterable: true },
  { id: "customer_delivery", label: "Customer Delivery", defaultWidth: 150, minWidth: 100, sortable: true, filterable: true },
  { id: "bioflex_delivery", label: "Bioflex Delivery", defaultWidth: 150, minWidth: 100, sortable: true, filterable: true },
  { id: "excess_stock", label: "Excess Stock", adminOnly: true, align: "right", defaultWidth: 110, minWidth: 80 },
  { id: "in_floor", label: "In Floor", align: "right", defaultWidth: 90, minWidth: 70 },
  { id: "shipped", label: "Shipped", align: "right", defaultWidth: 90, minWidth: 70 },
  { id: "pending", label: "Pending", align: "right", defaultWidth: 90, minWidth: 70 },
  { id: "stock_available", label: "Stock Available", align: "right", defaultWidth: 120, minWidth: 80 },
  { id: "percent_produced", label: "% Produced", align: "right", defaultWidth: 120, minWidth: 90 },
  { id: "actions", label: "Actions", align: "right", defaultWidth: 120, minWidth: 80, fixed: true },
];

function getDefaultState(): ColumnState {
  return {
    order: DEFAULT_COLUMNS.map((c) => c.id),
    widths: Object.fromEntries(DEFAULT_COLUMNS.map((c) => [c.id, c.defaultWidth || 120])),
  };
}

function loadState(): ColumnState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ColumnState;
      // Ensure all columns are present (in case new ones were added)
      const defaultState = getDefaultState();
      const allIds = DEFAULT_COLUMNS.map((c) => c.id);
      const existingIds = new Set(parsed.order);
      const missingIds = allIds.filter((id) => !existingIds.has(id));
      // Remove any IDs that no longer exist
      const validOrder = parsed.order.filter((id) => allIds.includes(id));
      // Insert missing before "actions"
      const actionsIdx = validOrder.indexOf("actions");
      if (actionsIdx >= 0) {
        validOrder.splice(actionsIdx, 0, ...missingIds.filter((id) => id !== "actions"));
      } else {
        validOrder.push(...missingIds);
      }
      return {
        order: validOrder,
        widths: { ...defaultState.widths, ...parsed.widths },
      };
    }
  } catch {
    // ignore
  }
  return getDefaultState();
}

export function useColumnConfig() {
  const [state, setState] = useState<ColumnState>(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const getOrderedColumns = useCallback(
    (isAdmin: boolean): ColumnConfig[] => {
      const columnsMap = new Map(DEFAULT_COLUMNS.map((c) => [c.id, c]));
      return state.order
        .map((id) => columnsMap.get(id))
        .filter((c): c is ColumnConfig => {
          if (!c) return false;
          if (c.adminOnly && !isAdmin) return false;
          return true;
        });
    },
    [state.order]
  );

  const getColumnWidth = useCallback(
    (id: string): number => {
      return state.widths[id] || 120;
    },
    [state.widths]
  );

  const setColumnWidth = useCallback((id: string, width: number) => {
    const col = DEFAULT_COLUMNS.find((c) => c.id === id);
    const minWidth = col?.minWidth || 60;
    setState((prev) => ({
      ...prev,
      widths: { ...prev.widths, [id]: Math.max(minWidth, width) },
    }));
  }, []);

  const reorderColumns = useCallback((dragId: string, dropId: string) => {
    setState((prev) => {
      const newOrder = [...prev.order];
      const dragIdx = newOrder.indexOf(dragId);
      const dropIdx = newOrder.indexOf(dropId);
      if (dragIdx < 0 || dropIdx < 0) return prev;
      // Don't allow moving to/from fixed columns
      const dragCol = DEFAULT_COLUMNS.find((c) => c.id === dragId);
      const dropCol = DEFAULT_COLUMNS.find((c) => c.id === dropId);
      if (dragCol?.fixed || dropCol?.fixed) return prev;
      newOrder.splice(dragIdx, 1);
      newOrder.splice(dropIdx, 0, dragId);
      return { ...prev, order: newOrder };
    });
  }, []);

  const resetColumns = useCallback(() => {
    setState(getDefaultState());
  }, []);

  return {
    getOrderedColumns,
    getColumnWidth,
    setColumnWidth,
    reorderColumns,
    resetColumns,
  };
}
