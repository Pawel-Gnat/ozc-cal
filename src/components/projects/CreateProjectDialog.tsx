import React, { useState } from "react";
import { FolderPlus, Plus } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();

  function validate() {
    if (!name.trim()) {
      setError("Project name is required");
      return false;
    }
    if (name.trim().length > 120) {
      setError("Project name must be 120 characters or fewer");
      return false;
    }
    setError(undefined);
    return true;
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <Plus className="size-4" />
          New project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Enter a name for your project. You can import a floor plan PDF later in the editor.
          </DialogDescription>
        </DialogHeader>
        <form method="POST" action="/api/projects" className="space-y-4" onSubmit={handleSubmit} noValidate>
          <FormField
            id="name"
            name="name"
            label="Project name"
            value={name}
            onChange={(v) => {
              setName(v);
              if (error) setError(undefined);
            }}
            placeholder="e.g. Single-family house"
            error={error}
            icon={<FolderPlus className="size-4" />}
          />
          <SubmitButton pendingText="Creating..." icon={<Plus className="size-4" />}>
            Create project
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
