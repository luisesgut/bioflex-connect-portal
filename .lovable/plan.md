## Módulo: Destiny Weekly Production Plan

Permite planear semana por semana (viernes a jueves) la producción comprometida con Destiny en 4 familias, asignar PO's (con posibilidad de partir cantidades), congelar semanas y descargar el POTR ya acomodado por semana/familia.

### Familias (catálogo aparte)

Catálogo independiente. Las 4 familias confirmadas:
- Bag No Wicket Orders
- Bag Wicket Orders
- Pouch Orders
- Film Orders

Cada familia define:
- Nombre
- Capacidad semanal default (piezas)
- Mapeo a uno o varios `item_type` (sugerencia automática)

### Definición de "semana"

- Inicio: viernes — Fin: jueves siguiente.
- Identificador: `week_start_date` (siempre un viernes).
- Por familia + semana se puede sobreescribir la capacidad default.

### Vista de 3 semanas + congelado

La pantalla muestra **3 semanas a la vez en columnas horizontales** (semana actual, +1, +2). Selector global para mover el rango (anterior / siguiente / picker → ancla la primera semana).

Cada semana tiene un estado:
- **Open** (por defecto): se pueden agregar, mover o quitar asignaciones.
- **Frozen** (congelada): asignaciones bloqueadas, no se editan ni se mueven; visualmente con candado y badge "FROZEN" + fecha y usuario que congeló.

Acción "Freeze week" disponible por semana (botón con candado en el header de la columna). Al congelar:
- Se marca `is_frozen = true`, se guarda `frozen_at` y `frozen_by`.
- Las asignaciones de esa semana quedan inmutables (RLS + UI).
- Solo admin puede "Unfreeze" si necesita corregir.

Recordatorio operativo: cada martes el equipo congela la semana en curso + la siguiente (ej. martes 18 → freeze semanas 22 y 29). El sistema NO congela solo; muestra un banner los martes recordando "Recuerda congelar las próximas 2 semanas". Cualquier semana se puede congelar manualmente en cualquier momento.

```text
+--------------------------------------------------------------------------+
| Destiny Weekly Plan         [< Sem May 16-22 ancla >] [Export ▾]         |
| Banner martes: "Today is freeze day — lock current + next week"          |
+--------------------------------------------------------------------------+
| Week May 16-22 🔒 FROZEN | Week May 23-29 🔒 FROZEN | Week May 30-Jun 5  |
| by Toni · 5/14/26        | by Toni · 5/14/26        | (open) [🔒 Freeze] |
|--------------------------|--------------------------|--------------------|
| Bag Wicket   3,250/4,000 | Bag Wicket   2,100/4,000 | Bag Wicket   0/4,000|
| ████░ 81%                | ███░░ 52%                | ░░░░░ 0%           |
|  PO 15105 1.5M           |  PO 15110 2.1M           |  (vacío)            |
|  PO 15107 1.0M           |                          |  [+ Asignar PO]    |
|  PO 15109 0.75M          |  [+ Asignar PO]          |                     |
|                          |                          |                     |
| Bag No Wkt  1,500/1,500  | Bag No Wkt    800/1,500  | Bag No Wkt   0/1,500|
| Pouch         200/800    | Pouch         500/800    | Pouch         0/800 |
| Film            0/600    | Film            0/600    | Film          0/600 |
+--------------------------------------------------------------------------+
| Backlog (POs aceptadas sin asignar / parcialmente asignadas)              |
| PO 15120 Pouch 500K [Asignar →]   PO 15123 Wicket 2M [Asignar →]   ...   |
+--------------------------------------------------------------------------+
```

Asignaciones por celda familia/semana:
- Click en una PO asignada → editar cantidad o quitar (deshabilitado si frozen)
- "+ Asignar PO": modal con buscador (PO #, customer, item) + cantidad parcial
- Drag & drop de backlog hacia celda (target deshabilitado si frozen)
- Indicador rojo si suma > capacidad (warning, no bloqueo)

Settings de familias: `/settings` → nueva sección "Destiny Families" para CRUD + capacidad default + mapeo item_type.

Export POTR: descarga .xlsx replicando el formato del archivo subido, con la(s) semana(s) seleccionadas.

### Lógica de asignación

- Una PO puede tener N entradas en `destiny_weekly_assignments` (familia × semana × cantidad).
- "Cantidad asignada total" = suma de entradas activas de la PO.
- "Cantidad pendiente" = `purchase_orders.quantity - asignada_total`.
- Solo POs `accepted` entran al backlog (admin override opcional).
- Asignaciones de semanas frozen no se pueden editar ni borrar (RLS).

### Export POTR

`.xlsx` con la misma estructura del archivo:
- Page 1: Open POs agrupadas por **semana asignada** y luego por familia. Columnas extra "Week" y "Family". POs partidas → una fila por semana.
- Page 4: Scheduled Facility Closures (`facility_closures`).
- Page 5: Capacity (Monthly + Weekly por familia).

Opciones del botón Export:
- "Solo la vista actual (3 semanas)"
- "Próximas N semanas"
- "Todas las semanas con asignación"

Reusar `ExcelJS`.

---

## Detalles técnicos

### Migraciones Supabase

```sql
CREATE TABLE public.destiny_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  default_weekly_capacity numeric NOT NULL DEFAULT 0,
  item_type_mapping text[] DEFAULT '{}',
  sort_order int NOT NULL DEFAULT 0,
  is_active bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.destiny_weekly_capacity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.destiny_families(id) ON DELETE CASCADE,
  week_start date NOT NULL,        -- viernes
  weekly_capacity numeric NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, week_start)
);

-- Estado de la semana (frozen) — independiente de la familia
CREATE TABLE public.destiny_week_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL UNIQUE,  -- viernes
  is_frozen bool NOT NULL DEFAULT false,
  frozen_at timestamptz,
  frozen_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.destiny_weekly_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.destiny_families(id),
  purchase_order_id uuid NOT NULL,
  week_start date NOT NULL,
  assigned_quantity numeric NOT NULL CHECK (assigned_quantity > 0),
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.destiny_weekly_assignments (week_start, family_id);
CREATE INDEX ON public.destiny_weekly_assignments (purchase_order_id);

CREATE TABLE public.facility_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility text NOT NULL DEFAULT 'BioFlex',
  closure_date date NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

RLS:
- SELECT: cualquier authenticated.
- INSERT/UPDATE/DELETE en `destiny_families`, `destiny_weekly_capacity`, `destiny_week_status`, `facility_closures`: solo admin.
- INSERT/UPDATE/DELETE en `destiny_weekly_assignments`: solo admin **y** la semana NO debe estar frozen:

```sql
CREATE POLICY "Admins manage open-week assignments"
ON public.destiny_weekly_assignments
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND NOT EXISTS (
    SELECT 1 FROM public.destiny_week_status s
    WHERE s.week_start = destiny_weekly_assignments.week_start
      AND s.is_frozen = true
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND NOT EXISTS (
    SELECT 1 FROM public.destiny_week_status s
    WHERE s.week_start = destiny_weekly_assignments.week_start
      AND s.is_frozen = true
  )
);
```

Trigger `update_updated_at_column` en cada tabla. Seed inicial con las 4 familias (capacidad 0).

### Frontend

Nuevos archivos:
- `src/pages/DestinyPlan.tsx` — vista de 3 semanas + backlog.
- `src/components/destiny/WeekColumn.tsx` — columna por semana (header con freeze, lista de familias).
- `src/components/destiny/FamilyCell.tsx` — celda familia × semana con barra de uso, asignaciones y CTA.
- `src/components/destiny/AssignPOToWeekDialog.tsx` — modal de asignación con buscador + cantidad parcial.
- `src/components/destiny/EditWeeklyCapacityDialog.tsx` — override capacidad.
- `src/components/destiny/FreezeWeekDialog.tsx` — confirmación freeze/unfreeze.
- `src/components/destiny/DestinyBacklog.tsx` — POs sin asignar / parcialmente asignadas.
- `src/components/settings/DestinyFamiliesManagement.tsx` — CRUD en `/settings`.
- `src/utils/destinyWeek.ts` — helpers (`getWeekStart` viernes, `addWeeks`, `getWeekRangeLabel`, `isTuesday`).
- `src/utils/generatePOTRExcel.ts` — exportador ExcelJS.
- `src/hooks/useDestinyPlan.ts` — fetch familias, capacidad, status, asignaciones, backlog para las 3 semanas visibles.

Cambios:
- `src/components/layout/Sidebar.tsx`: entrada "Destiny Plan" (admin).
- `src/App.tsx`: ruta `/destiny-plan` admin-only.
- `src/pages/Settings.tsx`: agregar `<DestinyFamiliesManagement />`.

### Helpers clave

```ts
// destinyWeek.ts — viernes = 5
export const getWeekStart = (d: Date): Date => {
  const dow = d.getDay();
  const offset = (dow - 5 + 7) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - offset);
  start.setHours(0,0,0,0);
  return start;
};
export const addWeeks = (d: Date, n: number) => {
  const r = new Date(d); r.setDate(r.getDate() + n*7); return r;
};
export const isTuesday = (d: Date) => d.getDay() === 2;
```

### Validaciones UI

- Bloqueo total de edición/asignación/drag en semanas frozen (UI + RLS).
- No permitir `assigned_quantity > pending_quantity` de la PO.
- Warning si suma asignada de una familia/semana excede capacidad.
- Sugerir familia automáticamente por `item_type` del producto vs `destiny_families.item_type_mapping`.
- Banner "freeze reminder" visible solo los martes hasta que se congelen las 2 semanas objetivo.

### Memory updates

- `mem://features/destiny-weekly-plan/overview` — semanas vie–jue, vista de 3 semanas, freeze los martes (semana actual + siguiente).
- Actualizar `mem://index.md` con la referencia.

### Fuera de alcance

- `production_capacity` actual y su gráfica en Dashboard se mantienen.
- POTR existente sigue funcionando; el nuevo export es un botón aparte dentro de Destiny Plan.
