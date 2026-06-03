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
