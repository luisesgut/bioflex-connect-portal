export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ncr_submissions: {
        Row: {
          attachments: string[] | null
          created_at: string
          description: string
          id: string
          issue_type: string
          po_number: string
          priority: Database["public"]["Enums"]["ncr_priority"]
          status: Database["public"]["Enums"]["ncr_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          attachments?: string[] | null
          created_at?: string
          description: string
          id?: string
          issue_type: string
          po_number: string
          priority?: Database["public"]["Enums"]["ncr_priority"]
          status?: Database["public"]["Enums"]["ncr_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          attachments?: string[] | null
          created_at?: string
          description?: string
          id?: string
          issue_type?: string
          po_number?: string
          priority?: Database["public"]["Enums"]["ncr_priority"]
          status?: Database["public"]["Enums"]["ncr_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          activa: boolean | null
          alto: number | null
          ancho: number | null
          category: string
          codigo_producto: string | null
          created_at: string
          customer: string | null
          customer_item: string | null
          descripcion_caja: string | null
          descripcion_cliente: string | null
          empacado_de_producto_por: string | null
          estructura: string | null
          et: string | null
          et_verificada: boolean | null
          fuelle_de_fondo: number | null
          id: string
          image: string | null
          item_description: string | null
          item_type: string | null
          material: string | null
          metros_x_bobina: number | null
          name: string
          nombre_producto_2: string | null
          paquete_por_caja: number | null
          pc_number: string | null
          pestana_al_alto: number | null
          pestana_al_ancho: number | null
          pieces_per_pallet: number | null
          piezas_por_paquete: number | null
          piezas_totales_por_caja: number | null
          pisos: number | null
          print_card: string | null
          pt_code: string | null
          refilado: string | null
          size: string | null
          sku: string
          tipo_embalaje: string | null
          tipo_empaque: string | null
          unidades_en_ancho: number | null
          unidades_en_largo: number | null
          unidades_por_tarima: number | null
          updated_at: string
        }
        Insert: {
          activa?: boolean | null
          alto?: number | null
          ancho?: number | null
          category?: string
          codigo_producto?: string | null
          created_at?: string
          customer?: string | null
          customer_item?: string | null
          descripcion_caja?: string | null
          descripcion_cliente?: string | null
          empacado_de_producto_por?: string | null
          estructura?: string | null
          et?: string | null
          et_verificada?: boolean | null
          fuelle_de_fondo?: number | null
          id?: string
          image?: string | null
          item_description?: string | null
          item_type?: string | null
          material?: string | null
          metros_x_bobina?: number | null
          name: string
          nombre_producto_2?: string | null
          paquete_por_caja?: number | null
          pc_number?: string | null
          pestana_al_alto?: number | null
          pestana_al_ancho?: number | null
          pieces_per_pallet?: number | null
          piezas_por_paquete?: number | null
          piezas_totales_por_caja?: number | null
          pisos?: number | null
          print_card?: string | null
          pt_code?: string | null
          refilado?: string | null
          size?: string | null
          sku: string
          tipo_embalaje?: string | null
          tipo_empaque?: string | null
          unidades_en_ancho?: number | null
          unidades_en_largo?: number | null
          unidades_por_tarima?: number | null
          updated_at?: string
        }
        Update: {
          activa?: boolean | null
          alto?: number | null
          ancho?: number | null
          category?: string
          codigo_producto?: string | null
          created_at?: string
          customer?: string | null
          customer_item?: string | null
          descripcion_caja?: string | null
          descripcion_cliente?: string | null
          empacado_de_producto_por?: string | null
          estructura?: string | null
          et?: string | null
          et_verificada?: boolean | null
          fuelle_de_fondo?: number | null
          id?: string
          image?: string | null
          item_description?: string | null
          item_type?: string | null
          material?: string | null
          metros_x_bobina?: number | null
          name?: string
          nombre_producto_2?: string | null
          paquete_por_caja?: number | null
          pc_number?: string | null
          pestana_al_alto?: number | null
          pestana_al_ancho?: number | null
          pieces_per_pallet?: number | null
          piezas_por_paquete?: number | null
          piezas_totales_por_caja?: number | null
          pisos?: number | null
          print_card?: string | null
          pt_code?: string | null
          refilado?: string | null
          size?: string | null
          sku?: string
          tipo_embalaje?: string | null
          tipo_empaque?: string | null
          unidades_en_ancho?: number | null
          unidades_en_largo?: number | null
          unidades_por_tarima?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      ncr_priority: "low" | "medium" | "high" | "critical"
      ncr_status: "open" | "under_review" | "resolved" | "closed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      ncr_priority: ["low", "medium", "high", "critical"],
      ncr_status: ["open", "under_review", "resolved", "closed"],
    },
  },
} as const
