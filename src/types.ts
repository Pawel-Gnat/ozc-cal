/** Polish winter climate zones I–V (PN-EN 12831-1 PL annex presets). */
export const CLIMATE_ZONE_IDS = ["I", "II", "III", "IV", "V"] as const;

export type ClimateZoneId = (typeof CLIMATE_ZONE_IDS)[number];

export const ASSEMBLY_CATEGORIES = [
  "external_wall",
  "internal_partition",
  "floor",
  "ceiling",
  "roof",
  "ground_floor",
  "window",
  "door",
] as const;

export type AssemblyCategory = (typeof ASSEMBLY_CATEGORIES)[number];

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- type alias keeps Supabase schema inference stable in IDE ESLint
export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
          climate_zone: ClimateZoneId | null;
          external_design_temp_c: number | null;
          floor_plan_storage_path: string | null;
          floor_plan_filename: string | null;
          floor_plan_size_bytes: number | null;
          floor_plan_uploaded_at: string | null;
          plan_scale_point_a_x: number | null;
          plan_scale_point_a_y: number | null;
          plan_scale_point_b_x: number | null;
          plan_scale_point_b_y: number | null;
          plan_scale_known_length_m: number | null;
          plan_scale_meters_per_unit: number | null;
          storey_height_m: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          owner_id: string;
          climate_zone?: ClimateZoneId | null;
          external_design_temp_c?: number | null;
          floor_plan_storage_path?: string | null;
          floor_plan_filename?: string | null;
          floor_plan_size_bytes?: number | null;
          floor_plan_uploaded_at?: string | null;
          plan_scale_point_a_x?: number | null;
          plan_scale_point_a_y?: number | null;
          plan_scale_point_b_x?: number | null;
          plan_scale_point_b_y?: number | null;
          plan_scale_known_length_m?: number | null;
          plan_scale_meters_per_unit?: number | null;
          storey_height_m?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          owner_id?: string;
          climate_zone?: ClimateZoneId | null;
          external_design_temp_c?: number | null;
          floor_plan_storage_path?: string | null;
          floor_plan_filename?: string | null;
          floor_plan_size_bytes?: number | null;
          floor_plan_uploaded_at?: string | null;
          plan_scale_point_a_x?: number | null;
          plan_scale_point_a_y?: number | null;
          plan_scale_point_b_x?: number | null;
          plan_scale_point_b_y?: number | null;
          plan_scale_known_length_m?: number | null;
          plan_scale_meters_per_unit?: number | null;
          storey_height_m?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      assemblies: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          category: AssemblyCategory;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          category: AssemblyCategory;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          category?: AssemblyCategory;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assemblies_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      assembly_layers: {
        Row: {
          id: string;
          assembly_id: string;
          layer_order: number;
          material_name: string;
          lambda_w_mk: number;
          thickness_mm: number;
        };
        Insert: {
          id?: string;
          assembly_id: string;
          layer_order: number;
          material_name: string;
          lambda_w_mk: number;
          thickness_mm: number;
        };
        Update: {
          id?: string;
          assembly_id?: string;
          layer_order?: number;
          material_name?: string;
          lambda_w_mk?: number;
          thickness_mm?: number;
        };
        Relationships: [
          {
            foreignKeyName: "assembly_layers_assembly_id_fkey";
            columns: ["assembly_id"];
            isOneToOne: false;
            referencedRelation: "assemblies";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_nodes: {
        Row: {
          id: string;
          project_id: string;
          x: number;
          y: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          x: number;
          y: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          x?: number;
          y?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_nodes_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_segments: {
        Row: {
          id: string;
          project_id: string;
          start_node_id: string;
          end_node_id: string;
          assembly_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          start_node_id: string;
          end_node_id: string;
          assembly_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          start_node_id?: string;
          end_node_id?: string;
          assembly_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_segments_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_rooms: {
        Row: {
          id: string;
          project_id: string;
          name: string | null;
          internal_temp_c: number;
          ventilation_supply: number | null;
          ventilation_exhaust: number | null;
          ventilation_natural: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name?: string | null;
          internal_temp_c: number;
          ventilation_supply?: number | null;
          ventilation_exhaust?: number | null;
          ventilation_natural?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string | null;
          internal_temp_c?: number;
          ventilation_supply?: number | null;
          ventilation_exhaust?: number | null;
          ventilation_natural?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_rooms_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_room_segments: {
        Row: {
          room_id: string;
          segment_id: string;
          segment_order: number;
        };
        Insert: {
          room_id: string;
          segment_id: string;
          segment_order: number;
        };
        Update: {
          room_id?: string;
          segment_id?: string;
          segment_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "plan_room_segments_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "plan_rooms";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      replace_assembly_with_layers: {
        Args: {
          p_assembly_id: string;
          p_name: string;
          p_category: string;
          p_layers: {
            layer_order: number;
            material_name: string;
            lambda_w_mk: number;
            thickness_mm: number;
          }[];
        };
        Returns: undefined;
      };
      replace_editor_state: {
        Args: {
          p_project_id: string;
          p_scale: {
            point_a_x: number;
            point_a_y: number;
            point_b_x: number;
            point_b_y: number;
            known_length_m: number;
            meters_per_unit: number;
          } | null;
          p_nodes: { id: string; x: number; y: number }[];
          p_segments: {
            id: string;
            start_node_id: string;
            end_node_id: string;
            assembly_id: string;
          }[];
          p_rooms: {
            id: string;
            name: string | null;
            internal_temp_c: number;
            ventilation_supply: number | null;
            ventilation_exhaust: number | null;
            ventilation_natural: number | null;
            segment_ids: string[];
          }[];
        };
        Returns: undefined;
      };
    };
  };
};

export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];
export type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"];

export type Assembly = Database["public"]["Tables"]["assemblies"]["Row"];
export type AssemblyInsert = Database["public"]["Tables"]["assemblies"]["Insert"];
export type AssemblyUpdate = Database["public"]["Tables"]["assemblies"]["Update"];

export type AssemblyLayer = Database["public"]["Tables"]["assembly_layers"]["Row"];
export type AssemblyLayerInsert = Database["public"]["Tables"]["assembly_layers"]["Insert"];
export type AssemblyLayerUpdate = Database["public"]["Tables"]["assembly_layers"]["Update"];

export type PlanNode = Database["public"]["Tables"]["plan_nodes"]["Row"];
export type PlanNodeInsert = Database["public"]["Tables"]["plan_nodes"]["Insert"];

export type PlanSegment = Database["public"]["Tables"]["plan_segments"]["Row"];
export type PlanSegmentInsert = Database["public"]["Tables"]["plan_segments"]["Insert"];

export type PlanRoom = Database["public"]["Tables"]["plan_rooms"]["Row"];
export type PlanRoomInsert = Database["public"]["Tables"]["plan_rooms"]["Insert"];

export type PlanRoomSegment = Database["public"]["Tables"]["plan_room_segments"]["Row"];
export type PlanRoomSegmentInsert = Database["public"]["Tables"]["plan_room_segments"]["Insert"];
