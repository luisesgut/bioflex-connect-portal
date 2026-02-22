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
      access_profiles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          updated_at: string | null
          user_type: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          updated_at?: string | null
          user_type?: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
          user_type?: string
        }
        Relationships: []
      }
      customer_locations: {
        Row: {
          address: string | null
          city: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          reception_hours: string | null
          state: string | null
          warehouse_manager_id: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          reception_hours?: string | null
          state?: string | null
          warehouse_manager_id?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          reception_hours?: string | null
          state?: string | null
          warehouse_manager_id?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_locations_warehouse_manager_id_fkey"
            columns: ["warehouse_manager_id"]
            isOneToOne: false
            referencedRelation: "dp_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      dp_contacts: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      dropdown_options: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      engineering_proposals: {
        Row: {
          customer_approved: boolean | null
          customer_feedback: string | null
          customer_response_at: string | null
          flip_size_cm: number | null
          gusset_cm: number | null
          id: string
          is_active: boolean | null
          length_cm: number | null
          lip_back_cm: number | null
          lip_front_cm: number | null
          original_gusset_cm: number | null
          original_length_cm: number | null
          original_structure: string | null
          original_thickness_unit:
            | Database["public"]["Enums"]["thickness_unit"]
            | null
          original_thickness_value: number | null
          original_width_cm: number | null
          original_zipper_cm: number | null
          product_request_id: string
          proposed_at: string
          proposed_by: string
          proposed_structure: string | null
          reason: string
          thickness_unit: Database["public"]["Enums"]["thickness_unit"] | null
          thickness_value: number | null
          version_number: number
          width_cm: number | null
          zipper_cm: number | null
        }
        Insert: {
          customer_approved?: boolean | null
          customer_feedback?: string | null
          customer_response_at?: string | null
          flip_size_cm?: number | null
          gusset_cm?: number | null
          id?: string
          is_active?: boolean | null
          length_cm?: number | null
          lip_back_cm?: number | null
          lip_front_cm?: number | null
          original_gusset_cm?: number | null
          original_length_cm?: number | null
          original_structure?: string | null
          original_thickness_unit?:
            | Database["public"]["Enums"]["thickness_unit"]
            | null
          original_thickness_value?: number | null
          original_width_cm?: number | null
          original_zipper_cm?: number | null
          product_request_id: string
          proposed_at?: string
          proposed_by: string
          proposed_structure?: string | null
          reason: string
          thickness_unit?: Database["public"]["Enums"]["thickness_unit"] | null
          thickness_value?: number | null
          version_number?: number
          width_cm?: number | null
          zipper_cm?: number | null
        }
        Update: {
          customer_approved?: boolean | null
          customer_feedback?: string | null
          customer_response_at?: string | null
          flip_size_cm?: number | null
          gusset_cm?: number | null
          id?: string
          is_active?: boolean | null
          length_cm?: number | null
          lip_back_cm?: number | null
          lip_front_cm?: number | null
          original_gusset_cm?: number | null
          original_length_cm?: number | null
          original_structure?: string | null
          original_thickness_unit?:
            | Database["public"]["Enums"]["thickness_unit"]
            | null
          original_thickness_value?: number | null
          original_width_cm?: number | null
          original_zipper_cm?: number | null
          product_request_id?: string
          proposed_at?: string
          proposed_by?: string
          proposed_structure?: string | null
          reason?: string
          thickness_unit?: Database["public"]["Enums"]["thickness_unit"] | null
          thickness_value?: number | null
          version_number?: number
          width_cm?: number | null
          zipper_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "engineering_proposals_product_request_id_fkey"
            columns: ["product_request_id"]
            isOneToOne: false
            referencedRelation: "product_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_pallets: {
        Row: {
          bfx_order: string | null
          created_at: string
          customer_lot: string | null
          description: string
          fecha: string
          gross_weight: number | null
          id: string
          net_weight: number | null
          pallet_type: string | null
          pieces: number | null
          pt_code: string
          release_date: string | null
          status: Database["public"]["Enums"]["inventory_status"]
          stock: number
          traceability: string
          unit: string
          updated_at: string
        }
        Insert: {
          bfx_order?: string | null
          created_at?: string
          customer_lot?: string | null
          description: string
          fecha: string
          gross_weight?: number | null
          id?: string
          net_weight?: number | null
          pallet_type?: string | null
          pieces?: number | null
          pt_code: string
          release_date?: string | null
          status?: Database["public"]["Enums"]["inventory_status"]
          stock: number
          traceability: string
          unit?: string
          updated_at?: string
        }
        Update: {
          bfx_order?: string | null
          created_at?: string
          customer_lot?: string | null
          description?: string
          fecha?: string
          gross_weight?: number | null
          id?: string
          net_weight?: number | null
          pallet_type?: string | null
          pieces?: number | null
          pt_code?: string
          release_date?: string | null
          status?: Database["public"]["Enums"]["inventory_status"]
          stock?: number
          traceability?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      load_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          load_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          load_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          load_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "load_comments_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "shipping_loads"
            referencedColumns: ["id"]
          },
        ]
      }
      load_destination_dates: {
        Row: {
          actual_date: string | null
          created_at: string
          destination: string
          estimated_date: string | null
          id: string
          load_id: string
          updated_at: string
        }
        Insert: {
          actual_date?: string | null
          created_at?: string
          destination: string
          estimated_date?: string | null
          id?: string
          load_id: string
          updated_at?: string
        }
        Update: {
          actual_date?: string | null
          created_at?: string
          destination?: string
          estimated_date?: string | null
          id?: string
          load_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "load_destination_dates_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "shipping_loads"
            referencedColumns: ["id"]
          },
        ]
      }
      load_pallets: {
        Row: {
          created_at: string
          delivery_date: string | null
          destination: string | null
          id: string
          is_on_hold: boolean
          load_id: string
          pallet_id: string
          quantity: number
          release_number: string | null
          release_pdf_url: string | null
        }
        Insert: {
          created_at?: string
          delivery_date?: string | null
          destination?: string | null
          id?: string
          is_on_hold?: boolean
          load_id: string
          pallet_id: string
          quantity: number
          release_number?: string | null
          release_pdf_url?: string | null
        }
        Update: {
          created_at?: string
          delivery_date?: string | null
          destination?: string | null
          id?: string
          is_on_hold?: boolean
          load_id?: string
          pallet_id?: string
          quantity?: number
          release_number?: string | null
          release_pdf_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "load_pallets_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "shipping_loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_pallets_pallet_id_fkey"
            columns: ["pallet_id"]
            isOneToOne: false
            referencedRelation: "inventory_pallets"
            referencedColumns: ["id"]
          },
        ]
      }
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
      order_change_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          current_quantity: number
          id: string
          purchase_order_id: string
          reason: string
          request_type: Database["public"]["Enums"]["change_request_type"]
          requested_by: string
          requested_quantity: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["change_request_status"]
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          current_quantity: number
          id?: string
          purchase_order_id: string
          reason: string
          request_type: Database["public"]["Enums"]["change_request_type"]
          requested_by: string
          requested_quantity?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["change_request_status"]
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          current_quantity?: number
          id?: string
          purchase_order_id?: string
          reason?: string
          request_type?: Database["public"]["Enums"]["change_request_type"]
          requested_by?: string
          requested_quantity?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["change_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_change_requests_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pc_versions: {
        Row: {
          customer_feedback: string | null
          file_name: string
          file_url: string
          id: string
          product_request_id: string
          review_comments: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["pc_version_status"]
          uploaded_at: string
          uploaded_by: string
          version_number: number
        }
        Insert: {
          customer_feedback?: string | null
          file_name: string
          file_url: string
          id?: string
          product_request_id: string
          review_comments?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["pc_version_status"]
          uploaded_at?: string
          uploaded_by: string
          version_number?: number
        }
        Update: {
          customer_feedback?: string | null
          file_name?: string
          file_url?: string
          id?: string
          product_request_id?: string
          review_comments?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["pc_version_status"]
          uploaded_at?: string
          uploaded_by?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "pc_versions_product_request_id_fkey"
            columns: ["product_request_id"]
            isOneToOne: false
            referencedRelation: "product_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      po_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          is_internal: boolean
          purchase_order_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          is_internal?: boolean
          purchase_order_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          purchase_order_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_comments_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      po_status_history: {
        Row: {
          changed_at: string
          changed_by: string
          id: string
          new_status: string
          notes: string | null
          old_status: string | null
          purchase_order_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: string
          new_status: string
          notes?: string | null
          old_status?: string | null
          purchase_order_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: string
          new_status?: string
          notes?: string | null
          old_status?: string | null
          purchase_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "po_status_history_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_request_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          assigned_to: string
          assignment_type: string
          completed_at: string | null
          id: string
          is_active: boolean
          notes: string | null
          product_request_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          assigned_to: string
          assignment_type: string
          completed_at?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          product_request_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          assigned_to?: string
          assignment_type?: string
          completed_at?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          product_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_request_assignments_product_request_id_fkey"
            columns: ["product_request_id"]
            isOneToOne: false
            referencedRelation: "product_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      product_request_contacts: {
        Row: {
          contact_type: string
          created_at: string
          email: string
          id: string
          name: string
          product_request_id: string
          role_description: string | null
        }
        Insert: {
          contact_type: string
          created_at?: string
          email: string
          id?: string
          name: string
          product_request_id: string
          role_description?: string | null
        }
        Update: {
          contact_type?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          product_request_id?: string
          role_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_request_contacts_product_request_id_fkey"
            columns: ["product_request_id"]
            isOneToOne: false
            referencedRelation: "product_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      product_requests: {
        Row: {
          alto: number | null
          ancho: number | null
          artwork_files: string[] | null
          assigned_designer: string | null
          assigned_engineer: string | null
          bags_per_case: number | null
          bags_per_wicket: number | null
          bionet_code: string | null
          bionet_registered_at: string | null
          bionet_registered_by: string | null
          box_color: string | null
          cases_per_pallet: number | null
          clarity_grade: string | null
          country_of_origin: string | null
          created_at: string
          created_by: string
          customer: string | null
          customer_item_code: string | null
          design_reviewed_at: string | null
          design_reviewed_by: string | null
          design_status: string | null
          engineering_notes: string | null
          engineering_reviewed_at: string | null
          engineering_reviewed_by: string | null
          engineering_status:
            | Database["public"]["Enums"]["engineering_review_status"]
            | null
          estructura: string | null
          extrusion_type: string | null
          eye_mark: string | null
          film_type: string | null
          flip_size_cm: number | null
          flip_size_inches: number | null
          fuelle_de_fondo: number | null
          gusset_cm: number | null
          gusset_inches: number | null
          id: string
          item_description: string | null
          item_id_code: string | null
          item_type: string | null
          language: string | null
          length_cm: number | null
          length_inches: number | null
          lip_back_cm: number | null
          lip_back_inches: number | null
          lip_front_cm: number | null
          lip_front_inches: number | null
          material: string | null
          notes: string | null
          pallet_size: string | null
          paquete_por_caja: number | null
          pestana_al_alto: number | null
          pestana_al_ancho: number | null
          pieces_per_pallet: number | null
          piezas_por_paquete: number | null
          pms_colors: string[] | null
          product_id: string | null
          product_line: Database["public"]["Enums"]["product_line"] | null
          product_name: string
          sap_code: string | null
          sap_registered_at: string | null
          sap_registered_by: string | null
          seal_type: string | null
          status: Database["public"]["Enums"]["product_request_status"]
          tech_spec_filename: string | null
          tech_spec_pdf_url: string | null
          thickness_unit: Database["public"]["Enums"]["thickness_unit"] | null
          thickness_value: number | null
          tipo_embalaje: string | null
          tipo_empaque: string | null
          upc_number: string | null
          updated_at: string
          vent_size: string | null
          vents_across: number | null
          vents_count: number | null
          vents_down: number | null
          wicket_hole: string | null
          wicket_size: string | null
          width_cm: number | null
          width_inches: number | null
          zipper_cm: number | null
          zipper_inches: number | null
        }
        Insert: {
          alto?: number | null
          ancho?: number | null
          artwork_files?: string[] | null
          assigned_designer?: string | null
          assigned_engineer?: string | null
          bags_per_case?: number | null
          bags_per_wicket?: number | null
          bionet_code?: string | null
          bionet_registered_at?: string | null
          bionet_registered_by?: string | null
          box_color?: string | null
          cases_per_pallet?: number | null
          clarity_grade?: string | null
          country_of_origin?: string | null
          created_at?: string
          created_by: string
          customer?: string | null
          customer_item_code?: string | null
          design_reviewed_at?: string | null
          design_reviewed_by?: string | null
          design_status?: string | null
          engineering_notes?: string | null
          engineering_reviewed_at?: string | null
          engineering_reviewed_by?: string | null
          engineering_status?:
            | Database["public"]["Enums"]["engineering_review_status"]
            | null
          estructura?: string | null
          extrusion_type?: string | null
          eye_mark?: string | null
          film_type?: string | null
          flip_size_cm?: number | null
          flip_size_inches?: number | null
          fuelle_de_fondo?: number | null
          gusset_cm?: number | null
          gusset_inches?: number | null
          id?: string
          item_description?: string | null
          item_id_code?: string | null
          item_type?: string | null
          language?: string | null
          length_cm?: number | null
          length_inches?: number | null
          lip_back_cm?: number | null
          lip_back_inches?: number | null
          lip_front_cm?: number | null
          lip_front_inches?: number | null
          material?: string | null
          notes?: string | null
          pallet_size?: string | null
          paquete_por_caja?: number | null
          pestana_al_alto?: number | null
          pestana_al_ancho?: number | null
          pieces_per_pallet?: number | null
          piezas_por_paquete?: number | null
          pms_colors?: string[] | null
          product_id?: string | null
          product_line?: Database["public"]["Enums"]["product_line"] | null
          product_name: string
          sap_code?: string | null
          sap_registered_at?: string | null
          sap_registered_by?: string | null
          seal_type?: string | null
          status?: Database["public"]["Enums"]["product_request_status"]
          tech_spec_filename?: string | null
          tech_spec_pdf_url?: string | null
          thickness_unit?: Database["public"]["Enums"]["thickness_unit"] | null
          thickness_value?: number | null
          tipo_embalaje?: string | null
          tipo_empaque?: string | null
          upc_number?: string | null
          updated_at?: string
          vent_size?: string | null
          vents_across?: number | null
          vents_count?: number | null
          vents_down?: number | null
          wicket_hole?: string | null
          wicket_size?: string | null
          width_cm?: number | null
          width_inches?: number | null
          zipper_cm?: number | null
          zipper_inches?: number | null
        }
        Update: {
          alto?: number | null
          ancho?: number | null
          artwork_files?: string[] | null
          assigned_designer?: string | null
          assigned_engineer?: string | null
          bags_per_case?: number | null
          bags_per_wicket?: number | null
          bionet_code?: string | null
          bionet_registered_at?: string | null
          bionet_registered_by?: string | null
          box_color?: string | null
          cases_per_pallet?: number | null
          clarity_grade?: string | null
          country_of_origin?: string | null
          created_at?: string
          created_by?: string
          customer?: string | null
          customer_item_code?: string | null
          design_reviewed_at?: string | null
          design_reviewed_by?: string | null
          design_status?: string | null
          engineering_notes?: string | null
          engineering_reviewed_at?: string | null
          engineering_reviewed_by?: string | null
          engineering_status?:
            | Database["public"]["Enums"]["engineering_review_status"]
            | null
          estructura?: string | null
          extrusion_type?: string | null
          eye_mark?: string | null
          film_type?: string | null
          flip_size_cm?: number | null
          flip_size_inches?: number | null
          fuelle_de_fondo?: number | null
          gusset_cm?: number | null
          gusset_inches?: number | null
          id?: string
          item_description?: string | null
          item_id_code?: string | null
          item_type?: string | null
          language?: string | null
          length_cm?: number | null
          length_inches?: number | null
          lip_back_cm?: number | null
          lip_back_inches?: number | null
          lip_front_cm?: number | null
          lip_front_inches?: number | null
          material?: string | null
          notes?: string | null
          pallet_size?: string | null
          paquete_por_caja?: number | null
          pestana_al_alto?: number | null
          pestana_al_ancho?: number | null
          pieces_per_pallet?: number | null
          piezas_por_paquete?: number | null
          pms_colors?: string[] | null
          product_id?: string | null
          product_line?: Database["public"]["Enums"]["product_line"] | null
          product_name?: string
          sap_code?: string | null
          sap_registered_at?: string | null
          sap_registered_by?: string | null
          seal_type?: string | null
          status?: Database["public"]["Enums"]["product_request_status"]
          tech_spec_filename?: string | null
          tech_spec_pdf_url?: string | null
          thickness_unit?: Database["public"]["Enums"]["thickness_unit"] | null
          thickness_value?: number | null
          tipo_embalaje?: string | null
          tipo_empaque?: string | null
          upc_number?: string | null
          updated_at?: string
          vent_size?: string | null
          vents_across?: number | null
          vents_count?: number | null
          vents_down?: number | null
          wicket_hole?: string | null
          wicket_size?: string | null
          width_cm?: number | null
          width_inches?: number | null
          zipper_cm?: number | null
          zipper_inches?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_capacity: {
        Row: {
          created_at: string
          id: string
          item_type: string
          updated_at: string
          weekly_capacity: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_type: string
          updated_at?: string
          weekly_capacity?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_type?: string
          updated_at?: string
          weekly_capacity?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          activa: boolean | null
          alto: number | null
          ancho: number | null
          bfx_spec_url: string | null
          category: string
          codigo_producto: string | null
          created_at: string
          customer: string | null
          customer_item: string | null
          customer_tech_spec_url: string | null
          descripcion_caja: string | null
          descripcion_cliente: string | null
          dp_sales_csr_names: string | null
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
          print_card_url: string | null
          pt_code: string | null
          refilado: string | null
          size: string | null
          sku: string
          tipo_embalaje: string | null
          tipo_empaque: string | null
          unidades_en_ancho: number | null
          unidades_en_largo: number | null
          unidades_por_tarima: number | null
          units: string | null
          updated_at: string
        }
        Insert: {
          activa?: boolean | null
          alto?: number | null
          ancho?: number | null
          bfx_spec_url?: string | null
          category?: string
          codigo_producto?: string | null
          created_at?: string
          customer?: string | null
          customer_item?: string | null
          customer_tech_spec_url?: string | null
          descripcion_caja?: string | null
          descripcion_cliente?: string | null
          dp_sales_csr_names?: string | null
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
          print_card_url?: string | null
          pt_code?: string | null
          refilado?: string | null
          size?: string | null
          sku: string
          tipo_embalaje?: string | null
          tipo_empaque?: string | null
          unidades_en_ancho?: number | null
          unidades_en_largo?: number | null
          unidades_por_tarima?: number | null
          units?: string | null
          updated_at?: string
        }
        Update: {
          activa?: boolean | null
          alto?: number | null
          ancho?: number | null
          bfx_spec_url?: string | null
          category?: string
          codigo_producto?: string | null
          created_at?: string
          customer?: string | null
          customer_item?: string | null
          customer_tech_spec_url?: string | null
          descripcion_caja?: string | null
          descripcion_cliente?: string | null
          dp_sales_csr_names?: string | null
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
          print_card_url?: string | null
          pt_code?: string | null
          refilado?: string | null
          size?: string | null
          sku?: string
          tipo_embalaje?: string | null
          tipo_empaque?: string | null
          unidades_en_ancho?: number | null
          unidades_en_largo?: number | null
          unidades_por_tarima?: number | null
          units?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profile_permissions: {
        Row: {
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          id: string
          module: string
          profile_id: string
        }
        Insert: {
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          module: string
          profile_id: string
        }
        Update: {
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          module?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "access_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          access_profile_id: string | null
          company: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
          user_type: string | null
        }
        Insert: {
          access_profile_id?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
          user_type?: string | null
        }
        Update: {
          access_profile_id?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
          user_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_access_profile_id_fkey"
            columns: ["access_profile_id"]
            isOneToOne: false
            referencedRelation: "access_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          conversion_date: string | null
          created_at: string
          do_not_delay: boolean
          estimated_delivery_date: string | null
          id: string
          is_hot_order: boolean
          notes: string | null
          pallets_needed: number | null
          pdf_url: string | null
          po_date: string
          po_number: string
          price_per_thousand: number | null
          printing_date: string | null
          product_id: string | null
          quantity: number
          requested_delivery_date: string | null
          sales_order_number: string | null
          status: string
          total_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          conversion_date?: string | null
          created_at?: string
          do_not_delay?: boolean
          estimated_delivery_date?: string | null
          id?: string
          is_hot_order?: boolean
          notes?: string | null
          pallets_needed?: number | null
          pdf_url?: string | null
          po_date?: string
          po_number: string
          price_per_thousand?: number | null
          printing_date?: string | null
          product_id?: string | null
          quantity: number
          requested_delivery_date?: string | null
          sales_order_number?: string | null
          status?: string
          total_price?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          conversion_date?: string | null
          created_at?: string
          do_not_delay?: boolean
          estimated_delivery_date?: string | null
          id?: string
          is_hot_order?: boolean
          notes?: string | null
          pallets_needed?: number | null
          pdf_url?: string | null
          po_date?: string
          po_number?: string
          price_per_thousand?: number | null
          printing_date?: string | null
          product_id?: string | null
          quantity?: number
          requested_delivery_date?: string | null
          sales_order_number?: string | null
          status?: string
          total_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      release_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          customer_notes: string | null
          id: string
          is_hot_order: boolean
          load_id: string
          release_number: string | null
          release_pdf_url: string | null
          requested_at: string
          requested_by: string
          responded_by: string | null
          response_at: string | null
          status: Database["public"]["Enums"]["release_status"]
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          customer_notes?: string | null
          id?: string
          is_hot_order?: boolean
          load_id: string
          release_number?: string | null
          release_pdf_url?: string | null
          requested_at?: string
          requested_by: string
          responded_by?: string | null
          response_at?: string | null
          status?: Database["public"]["Enums"]["release_status"]
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          customer_notes?: string | null
          id?: string
          is_hot_order?: boolean
          load_id?: string
          release_number?: string | null
          release_pdf_url?: string | null
          requested_at?: string
          requested_by?: string
          responded_by?: string | null
          response_at?: string | null
          status?: Database["public"]["Enums"]["release_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "release_requests_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "shipping_loads"
            referencedColumns: ["id"]
          },
        ]
      }
      shipped_pallets: {
        Row: {
          bfx_order: string | null
          created_at: string
          customer_lot: string | null
          delivery_date: string | null
          description: string
          destination: string | null
          fecha: string | null
          id: string
          load_id: string
          load_pallet_id: string | null
          original_pallet_id: string | null
          pt_code: string
          quantity: number
          shipped_at: string
          traceability: string | null
          unit: string
        }
        Insert: {
          bfx_order?: string | null
          created_at?: string
          customer_lot?: string | null
          delivery_date?: string | null
          description: string
          destination?: string | null
          fecha?: string | null
          id?: string
          load_id: string
          load_pallet_id?: string | null
          original_pallet_id?: string | null
          pt_code: string
          quantity: number
          shipped_at?: string
          traceability?: string | null
          unit?: string
        }
        Update: {
          bfx_order?: string | null
          created_at?: string
          customer_lot?: string | null
          delivery_date?: string | null
          description?: string
          destination?: string | null
          fecha?: string | null
          id?: string
          load_id?: string
          load_pallet_id?: string | null
          original_pallet_id?: string | null
          pt_code?: string
          quantity?: number
          shipped_at?: string
          traceability?: string | null
          unit?: string
        }
        Relationships: []
      }
      shipping_loads: {
        Row: {
          border_crossed: boolean | null
          created_at: string
          created_by: string
          cross_border_actual_date: string | null
          documents_sent: boolean | null
          estimated_delivery_date: string | null
          eta_cross_border: string | null
          id: string
          invoice_number: string | null
          invoice_pdf_url: string | null
          last_reported_city: string | null
          load_number: string
          notes: string | null
          release_number: string | null
          release_pdf_url: string | null
          shipping_date: string
          status: Database["public"]["Enums"]["load_status"]
          total_pallets: number
          transit_notes: string | null
          updated_at: string
        }
        Insert: {
          border_crossed?: boolean | null
          created_at?: string
          created_by: string
          cross_border_actual_date?: string | null
          documents_sent?: boolean | null
          estimated_delivery_date?: string | null
          eta_cross_border?: string | null
          id?: string
          invoice_number?: string | null
          invoice_pdf_url?: string | null
          last_reported_city?: string | null
          load_number: string
          notes?: string | null
          release_number?: string | null
          release_pdf_url?: string | null
          shipping_date: string
          status?: Database["public"]["Enums"]["load_status"]
          total_pallets?: number
          transit_notes?: string | null
          updated_at?: string
        }
        Update: {
          border_crossed?: boolean | null
          created_at?: string
          created_by?: string
          cross_border_actual_date?: string | null
          documents_sent?: boolean | null
          estimated_delivery_date?: string | null
          eta_cross_border?: string | null
          id?: string
          invoice_number?: string | null
          invoice_pdf_url?: string | null
          last_reported_city?: string | null
          load_number?: string
          notes?: string | null
          release_number?: string | null
          release_pdf_url?: string | null
          shipping_date?: string
          status?: Database["public"]["Enums"]["load_status"]
          total_pallets?: number
          transit_notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          team_role: Database["public"]["Enums"]["team_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          team_role: Database["public"]["Enums"]["team_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          team_role?: Database["public"]["Enums"]["team_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transit_updates: {
        Row: {
          created_at: string
          eta_cross_border: string | null
          id: string
          last_reported_city: string | null
          load_id: string
          notes: string | null
          updated_by: string
        }
        Insert: {
          created_at?: string
          eta_cross_border?: string | null
          id?: string
          last_reported_city?: string | null
          load_id: string
          notes?: string | null
          updated_by: string
        }
        Update: {
          created_at?: string
          eta_cross_border?: string | null
          id?: string
          last_reported_city?: string | null
          load_id?: string
          notes?: string | null
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "transit_updates_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "shipping_loads"
            referencedColumns: ["id"]
          },
        ]
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
      change_request_status: "pending" | "approved" | "rejected"
      change_request_type: "volume_change" | "cancellation" | "do_not_delay"
      customer_location:
        | "salinas"
        | "bakersfield"
        | "coachella"
        | "yuma"
        | "tbd"
      engineering_review_status:
        | "pending"
        | "approved"
        | "changes_required"
        | "customer_review"
      inventory_status: "available" | "assigned" | "shipped"
      load_status:
        | "assembling"
        | "pending_release"
        | "approved"
        | "on_hold"
        | "shipped"
        | "in_transit"
        | "delivered"
      ncr_priority: "low" | "medium" | "high" | "critical"
      ncr_status: "open" | "under_review" | "resolved" | "closed"
      pc_version_status: "pending" | "approved" | "rejected" | "superseded"
      product_line:
        | "bag_no_wicket_zipper"
        | "bag_wicket"
        | "bag_zipper"
        | "film"
        | "pouch"
      product_request_status:
        | "draft"
        | "specs_submitted"
        | "artwork_uploaded"
        | "pc_in_review"
        | "pc_approved"
        | "bionet_pending"
        | "bionet_registered"
        | "sap_pending"
        | "sap_registered"
        | "completed"
      release_status: "pending" | "approved" | "on_hold" | "shipped"
      team_role:
        | "sales_rep"
        | "engineering_leader"
        | "engineer"
        | "design_leader"
        | "designer"
        | "customer_service"
      thickness_unit: "gauge" | "microns"
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
      change_request_status: ["pending", "approved", "rejected"],
      change_request_type: ["volume_change", "cancellation", "do_not_delay"],
      customer_location: ["salinas", "bakersfield", "coachella", "yuma", "tbd"],
      engineering_review_status: [
        "pending",
        "approved",
        "changes_required",
        "customer_review",
      ],
      inventory_status: ["available", "assigned", "shipped"],
      load_status: [
        "assembling",
        "pending_release",
        "approved",
        "on_hold",
        "shipped",
        "in_transit",
        "delivered",
      ],
      ncr_priority: ["low", "medium", "high", "critical"],
      ncr_status: ["open", "under_review", "resolved", "closed"],
      pc_version_status: ["pending", "approved", "rejected", "superseded"],
      product_line: [
        "bag_no_wicket_zipper",
        "bag_wicket",
        "bag_zipper",
        "film",
        "pouch",
      ],
      product_request_status: [
        "draft",
        "specs_submitted",
        "artwork_uploaded",
        "pc_in_review",
        "pc_approved",
        "bionet_pending",
        "bionet_registered",
        "sap_pending",
        "sap_registered",
        "completed",
      ],
      release_status: ["pending", "approved", "on_hold", "shipped"],
      team_role: [
        "sales_rep",
        "engineering_leader",
        "engineer",
        "design_leader",
        "designer",
        "customer_service",
      ],
      thickness_unit: ["gauge", "microns"],
    },
  },
} as const
