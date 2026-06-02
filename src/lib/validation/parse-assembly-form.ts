/**
 * Parse indexed HTML form fields: layers[0][material_name], layers[0][lambda_w_mk], etc.
 */
export function parseAssemblyFormData(form: FormData): {
  name: FormDataEntryValue | null;
  category: FormDataEntryValue | null;
  layers: {
    layer_order: number;
    material_name: FormDataEntryValue | null;
    lambda_w_mk: FormDataEntryValue | null;
    thickness_mm: FormDataEntryValue | null;
  }[];
} {
  const indices = new Set<number>();

  for (const key of form.keys()) {
    const match = /^layers\[(\d+)\]\[/.exec(key);
    if (match) {
      indices.add(Number(match[1]));
    }
  }

  const layers = [...indices]
    .sort((a, b) => a - b)
    .map((index) => ({
      layer_order: index,
      material_name: form.get(`layers[${index}][material_name]`),
      lambda_w_mk: form.get(`layers[${index}][lambda_w_mk]`),
      thickness_mm: form.get(`layers[${index}][thickness_mm]`),
    }));

  return {
    name: form.get("name"),
    category: form.get("category"),
    layers,
  };
}
