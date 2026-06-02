import type { AssemblyCategory } from "@/lib/validation/assembly";
import type { ClimateZoneId } from "@/lib/climate/poland-zones";

export interface Project {
  id: string;
  name: string;
  owner_id: string;
  climate_zone: ClimateZoneId | null;
  external_design_temp_c: number | null;
  created_at: string;
  updated_at: string;
}

export type ProjectInsert = Pick<Project, "name" | "owner_id">;

export type ProjectUpdate = Partial<Pick<Project, "name" | "climate_zone" | "external_design_temp_c">>;

export interface Assembly {
  id: string;
  project_id: string;
  name: string;
  category: AssemblyCategory;
  created_at: string;
  updated_at: string;
}

export type AssemblyInsert = Pick<Assembly, "project_id" | "name" | "category">;

export type AssemblyUpdate = Partial<Pick<Assembly, "name" | "category">>;

export interface AssemblyLayer {
  id: string;
  assembly_id: string;
  layer_order: number;
  material_name: string;
  lambda_w_mk: number;
  thickness_mm: number;
}

export type AssemblyLayerInsert = Pick<
  AssemblyLayer,
  "assembly_id" | "layer_order" | "material_name" | "lambda_w_mk" | "thickness_mm"
>;

export type AssemblyLayerUpdate = Partial<
  Pick<AssemblyLayer, "layer_order" | "material_name" | "lambda_w_mk" | "thickness_mm">
>;

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: Project;
        Insert: ProjectInsert;
        Update: ProjectUpdate;
        Relationships: [];
      };
      assemblies: {
        Row: Assembly;
        Insert: AssemblyInsert;
        Update: AssemblyUpdate;
        Relationships: [];
      };
      assembly_layers: {
        Row: AssemblyLayer;
        Insert: AssemblyLayerInsert;
        Update: AssemblyLayerUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
