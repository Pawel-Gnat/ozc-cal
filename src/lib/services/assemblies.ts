import type { AppSupabaseClient } from "@/lib/database-client";
import { computeAssemblyPreview } from "@/lib/thermal/assembly-preview";
import type { AssemblyCreateInput, AssemblyUpdateInput } from "@/lib/validation/assembly";
import type { Assembly, AssemblyLayer, AssemblyLayerInsert } from "@/types";

type AssemblyLayerIdRow = Pick<AssemblyLayer, "id">;

const TEMP_LAYER_ORDER_OFFSET = 1000;

export interface AssemblyPreview {
  rTotal: number;
  uValue: number;
}

export interface AssemblyWithLayers extends Assembly {
  layers: AssemblyLayer[];
  preview: AssemblyPreview;
}

function sortLayers(layers: AssemblyLayer[]): AssemblyLayer[] {
  return [...layers].sort((a, b) => a.layer_order - b.layer_order);
}

function groupLayersByAssemblyId(layers: AssemblyLayer[]): Map<string, AssemblyLayer[]> {
  const grouped = new Map<string, AssemblyLayer[]>();

  for (const layer of layers) {
    const current = grouped.get(layer.assembly_id) ?? [];
    current.push(layer);
    grouped.set(layer.assembly_id, current);
  }

  return grouped;
}

function toAssemblyWithLayers(assembly: Assembly, layers: AssemblyLayer[]): AssemblyWithLayers {
  const sortedLayers = sortLayers(layers);
  return {
    ...assembly,
    layers: sortedLayers,
    preview: computeAssemblyPreview(sortedLayers),
  };
}

export async function listAssembliesWithLayers(
  supabase: AppSupabaseClient,
  projectId: string,
): Promise<AssemblyWithLayers[]> {
  const { data: assemblies, error: assembliesError } = await supabase
    .from("assemblies")
    .select("*")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
    .overrideTypes<Assembly[], { merge: false }>();

  if (assembliesError) {
    throw assembliesError;
  }

  if (assemblies.length === 0) {
    return [];
  }

  const assemblyIds = assemblies.map((assembly) => assembly.id);
  const { data: layers, error: layersError } = await supabase
    .from("assembly_layers")
    .select("*")
    .in("assembly_id", assemblyIds)
    .overrideTypes<AssemblyLayer[], { merge: false }>();

  if (layersError) {
    throw layersError;
  }

  const layersByAssemblyId = groupLayersByAssemblyId(layers);

  return assemblies.map((assembly) => toAssemblyWithLayers(assembly, layersByAssemblyId.get(assembly.id) ?? []));
}

async function getAssemblyWithLayersById(
  supabase: AppSupabaseClient,
  assemblyId: string,
): Promise<AssemblyWithLayers | null> {
  const assembly = await getAssemblyById(supabase, assemblyId);
  if (!assembly) {
    return null;
  }

  const { data: layers, error } = await supabase
    .from("assembly_layers")
    .select("*")
    .eq("assembly_id", assemblyId)
    .overrideTypes<AssemblyLayer[], { merge: false }>();

  if (error) {
    throw error;
  }

  return toAssemblyWithLayers(assembly, layers);
}

export async function getAssemblyById(supabase: AppSupabaseClient, assemblyId: string): Promise<Assembly | null> {
  const { data, error } = await supabase
    .from("assemblies")
    .select("*")
    .eq("id", assemblyId)
    .maybeSingle()
    .overrideTypes<Assembly, { merge: false }>();

  if (error) {
    throw error;
  }

  return data;
}

export async function createAssemblyWithLayers(
  supabase: AppSupabaseClient,
  projectId: string,
  input: AssemblyCreateInput,
): Promise<AssemblyWithLayers> {
  const { data: assembly, error: assemblyError } = await supabase
    .from("assemblies")
    .insert({
      project_id: projectId,
      name: input.name,
      category: input.category,
    })
    .select()
    .single()
    .overrideTypes<Assembly, { merge: false }>();

  if (assemblyError) {
    throw assemblyError;
  }

  const layerInserts: AssemblyLayerInsert[] = input.layers.map((layer) => ({
    assembly_id: assembly.id,
    layer_order: layer.layer_order,
    material_name: layer.material_name,
    lambda_w_mk: layer.lambda_w_mk,
    thickness_mm: layer.thickness_mm,
  }));

  const { data: insertedLayers, error: layersError } = await supabase
    .from("assembly_layers")
    .insert(layerInserts)
    .select()
    .overrideTypes<AssemblyLayer[], { merge: false }>();

  if (layersError) {
    await supabase.from("assemblies").delete().eq("id", assembly.id);
    throw layersError;
  }

  return toAssemblyWithLayers(assembly, insertedLayers);
}

export async function updateAssemblyWithLayers(
  supabase: AppSupabaseClient,
  assemblyId: string,
  input: AssemblyUpdateInput,
): Promise<AssemblyWithLayers> {
  const { error: assemblyError } = await supabase
    .from("assemblies")
    .update({
      name: input.name,
      category: input.category,
    })
    .eq("id", assemblyId);

  if (assemblyError) {
    throw assemblyError;
  }

  const { data: existingLayers, error: existingLayersError } = await supabase
    .from("assembly_layers")
    .select("id")
    .eq("assembly_id", assemblyId)
    .overrideTypes<AssemblyLayerIdRow[], { merge: false }>();

  if (existingLayersError) {
    throw existingLayersError;
  }

  const oldLayerIds = existingLayers.map((layer) => layer.id);

  const tempInserts: AssemblyLayerInsert[] = input.layers.map((layer, index) => ({
    assembly_id: assemblyId,
    layer_order: TEMP_LAYER_ORDER_OFFSET + index,
    material_name: layer.material_name,
    lambda_w_mk: layer.lambda_w_mk,
    thickness_mm: layer.thickness_mm,
  }));

  const { data: insertedLayers, error: insertError } = await supabase
    .from("assembly_layers")
    .insert(tempInserts)
    .select()
    .overrideTypes<AssemblyLayer[], { merge: false }>();

  if (insertError) {
    throw insertError;
  }

  if (oldLayerIds.length > 0) {
    const { error: deleteError } = await supabase.from("assembly_layers").delete().in("id", oldLayerIds);

    if (deleteError) {
      throw deleteError;
    }
  }

  for (let index = 0; index < insertedLayers.length; index++) {
    const layer = insertedLayers[index];
    const targetOrder = input.layers[index]?.layer_order ?? index;

    const { error: orderError } = await supabase
      .from("assembly_layers")
      .update({ layer_order: targetOrder })
      .eq("id", layer.id);

    if (orderError) {
      throw orderError;
    }
  }

  const updated = await getAssemblyWithLayersById(supabase, assemblyId);
  if (!updated) {
    throw new Error("Assembly not found after update");
  }

  return updated;
}

export async function deleteAssembly(supabase: AppSupabaseClient, assemblyId: string): Promise<void> {
  const { error } = await supabase.from("assemblies").delete().eq("id", assemblyId);

  if (error) {
    throw error;
  }
}
