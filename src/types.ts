export interface Project {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export type ProjectInsert = Pick<Project, "name" | "owner_id">;

export type ProjectUpdate = Partial<Pick<Project, "name">>;
