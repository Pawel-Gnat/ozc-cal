import React, { useState } from "react";
import { CircleAlert, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Button } from "@/components/ui/button";
import { getAssemblyCategoryLabel } from "@/lib/assemblies/category-labels";
import type { AssemblyWithLayers } from "@/lib/services/assemblies";
import { cn } from "@/lib/utils";
import { MAX_ASSEMBLY_LAYERS } from "@/lib/validation/assembly";
import { ASSEMBLY_CATEGORIES, type AssemblyCategory } from "@/types";

interface LayerDraft {
  material_name: string;
  lambda_w_mk: string;
  thickness_mm: string;
}

interface AssemblyCatalogProps {
  projectId: string;
  assemblies: AssemblyWithLayers[];
  categories: readonly AssemblyCategory[];
}

const selectClassName =
  "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white focus:ring-2 focus:ring-purple-400 focus:outline-none";
const inputClassName =
  "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40 focus:ring-2 focus:ring-purple-400 focus:outline-none";

function emptyLayer(): LayerDraft {
  return { material_name: "", lambda_w_mk: "", thickness_mm: "" };
}

function layersFromAssembly(assembly: AssemblyWithLayers): LayerDraft[] {
  return assembly.layers.map((layer) => ({
    material_name: layer.material_name,
    lambda_w_mk: String(layer.lambda_w_mk),
    thickness_mm: String(layer.thickness_mm),
  }));
}

function validateAssemblyForm(name: string, category: string, layers: LayerDraft[]): string | undefined {
  if (!name.trim()) {
    return "Assembly name is required";
  }
  if (name.trim().length > 120) {
    return "Assembly name must be 120 characters or fewer";
  }
  if (!ASSEMBLY_CATEGORIES.includes(category as AssemblyCategory)) {
    return "Select a category";
  }
  if (layers.length === 0) {
    return "At least one layer is required";
  }
  if (layers.length > MAX_ASSEMBLY_LAYERS) {
    return `At most ${MAX_ASSEMBLY_LAYERS} layers are allowed`;
  }

  for (const layer of layers) {
    if (!layer.material_name.trim()) {
      return "Material name is required";
    }
    if (layer.material_name.trim().length > 120) {
      return "Material name must be 120 characters or fewer";
    }
    const lambda = Number(layer.lambda_w_mk);
    if (!Number.isFinite(lambda) || lambda <= 0) {
      return "Thermal conductivity must be greater than 0";
    }
    const thickness = Number(layer.thickness_mm);
    if (!Number.isFinite(thickness) || thickness <= 0) {
      return "Thickness must be greater than 0";
    }
  }

  return undefined;
}

function formatPreviewValue(value: number, digits: number): string {
  return value.toFixed(digits);
}

export default function AssemblyCatalog({ projectId, assemblies, categories }: AssemblyCatalogProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<AssemblyCategory>(categories[0] ?? "external_wall");
  const [layers, setLayers] = useState<LayerDraft[]>([emptyLayer()]);
  const [formError, setFormError] = useState<string | undefined>();

  const isEditing = editingId !== null;
  const formAction = isEditing
    ? `/api/projects/${projectId}/assemblies/${editingId}`
    : `/api/projects/${projectId}/assemblies`;

  function resetForm() {
    setEditingId(null);
    setName("");
    setCategory(categories[0] ?? "external_wall");
    setLayers([emptyLayer()]);
    setFormError(undefined);
  }

  function startEdit(assembly: AssemblyWithLayers) {
    setEditingId(assembly.id);
    setName(assembly.name);
    setCategory(assembly.category);
    setLayers(layersFromAssembly(assembly));
    setFormError(undefined);
  }

  function handleFormSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    const validationError = validateAssemblyForm(name, category, layers);
    if (validationError) {
      event.preventDefault();
      setFormError(validationError);
    }
  }

  function updateLayer(index: number, field: keyof LayerDraft, value: string) {
    setLayers((current) => current.map((layer, i) => (i === index ? { ...layer, [field]: value } : layer)));
    if (formError) {
      setFormError(undefined);
    }
  }

  function addLayer() {
    if (layers.length >= MAX_ASSEMBLY_LAYERS) {
      return;
    }
    setLayers((current) => [...current, emptyLayer()]);
  }

  function removeLayer(index: number) {
    if (layers.length <= 1) {
      return;
    }
    setLayers((current) => current.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-8">
      {assemblies.length === 0 ? (
        <p className="text-sm text-blue-100/60">No assemblies yet. Create your first assembly below.</p>
      ) : (
        <ul className="space-y-3">
          {assemblies.map((assembly) => (
            <li key={assembly.id} className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium text-white">{assembly.name}</p>
                  <p className="mt-1 text-sm text-blue-100/60">{getAssemblyCategoryLabel(assembly.category)}</p>
                  <p className="mt-2 text-xs text-blue-100/50">
                    Preview: R = {formatPreviewValue(assembly.preview.rTotal, 3)} m²·K/W · U ={" "}
                    {formatPreviewValue(assembly.preview.uValue, 3)} W/m²·K
                  </p>
                  <p className="mt-1 text-xs text-blue-100/40">
                    {assembly.layers.length} layer{assembly.layers.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => {
                      startEdit(assembly);
                    }}
                  >
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                  <form
                    method="POST"
                    action={`/api/projects/${projectId}/assemblies/${assembly.id}`}
                    onSubmit={(event) => {
                      if (!window.confirm(`Delete assembly "${assembly.name}"?`)) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="_action" value="delete" />
                    <Button
                      type="submit"
                      variant="outline"
                      className="border-red-400/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </Button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
        <h3 className="text-lg font-medium text-white">{isEditing ? "Edit assembly" : "New assembly"}</h3>
        <p className="mt-1 text-sm text-blue-100/60">
          {isEditing
            ? "Update the assembly and its layers. Preview values refresh after save."
            : "Define a named assembly with ordered material layers."}
        </p>

        <form method="POST" action={formAction} className="mt-5 space-y-4" onSubmit={handleFormSubmit} noValidate>
          <div>
            <label htmlFor="assembly-name" className="mb-1 block text-sm text-blue-100/80">
              Assembly name
            </label>
            <input
              id="assembly-name"
              name="name"
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (formError) {
                  setFormError(undefined);
                }
              }}
              placeholder="e.g. External wall 24 cm"
              className={cn(inputClassName, formError?.includes("name") && "border-red-400/60")}
            />
          </div>

          <div>
            <label htmlFor="assembly-category" className="mb-1 block text-sm text-blue-100/80">
              Category
            </label>
            <select
              id="assembly-category"
              name="category"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value as AssemblyCategory);
                if (formError) {
                  setFormError(undefined);
                }
              }}
              className={selectClassName}
            >
              {categories.map((item) => (
                <option key={item} value={item} className="bg-slate-900 text-white">
                  {getAssemblyCategoryLabel(item)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-blue-100/80">Layers (outside to inside)</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                onClick={addLayer}
                disabled={layers.length >= MAX_ASSEMBLY_LAYERS}
              >
                <Plus className="size-4" />
                Add layer
              </Button>
            </div>

            <div className="space-y-3">
              {layers.map((layer, index) => (
                <div key={index} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium tracking-wide text-blue-100/50 uppercase">
                      Layer {index + 1}
                    </span>
                    {layers.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                        onClick={() => {
                          removeLayer(index);
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-1">
                      <label htmlFor={`layer-${index}-material`} className="mb-1 block text-xs text-blue-100/70">
                        Material
                      </label>
                      <input
                        id={`layer-${index}-material`}
                        name={`layers[${index}][material_name]`}
                        type="text"
                        value={layer.material_name}
                        onChange={(event) => {
                          updateLayer(index, "material_name", event.target.value);
                        }}
                        placeholder="e.g. Mineral wool"
                        className={inputClassName}
                      />
                    </div>
                    <div>
                      <label htmlFor={`layer-${index}-lambda`} className="mb-1 block text-xs text-blue-100/70">
                        λ (W/m·K)
                      </label>
                      <input
                        id={`layer-${index}-lambda`}
                        name={`layers[${index}][lambda_w_mk]`}
                        type="number"
                        step="0.001"
                        min="0"
                        value={layer.lambda_w_mk}
                        onChange={(event) => {
                          updateLayer(index, "lambda_w_mk", event.target.value);
                        }}
                        placeholder="0.038"
                        className={inputClassName}
                      />
                    </div>
                    <div>
                      <label htmlFor={`layer-${index}-thickness`} className="mb-1 block text-xs text-blue-100/70">
                        Thickness (mm)
                      </label>
                      <input
                        id={`layer-${index}-thickness`}
                        name={`layers[${index}][thickness_mm]`}
                        type="number"
                        step="0.1"
                        min="0"
                        value={layer.thickness_mm}
                        onChange={(event) => {
                          updateLayer(index, "thickness_mm", event.target.value);
                        }}
                        placeholder="150"
                        className={inputClassName}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {formError && (
            <p className="flex items-center gap-1 text-xs text-red-300">
              <CircleAlert className="size-3" />
              {formError}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <SubmitButton pendingText="Saving..." icon={<Layers className="size-4" />}>
              {isEditing ? "Update assembly" : "Create assembly"}
            </SubmitButton>
            {isEditing && (
              <Button
                type="button"
                variant="outline"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                onClick={resetForm}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
