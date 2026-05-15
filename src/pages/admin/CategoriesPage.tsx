import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAdminMutation, useCategories, useHomepageRows } from "@/hooks/useAdminConsole";

const CategoriesPage = () => {
  const { data: categories = [] } = useCategories();
  const [rowsQuery] = useHomepageRows();
  const rows = rowsQuery.data || [];
  const { saveCategory } = useAdminMutation();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  const handleSaveCategory = async () => {
    try {
      await saveCategory.mutateAsync({
        name,
        slug,
        description: description || null,
      });
      toast.success("Category save requested.");
      setName("");
      setSlug("");
      setDescription("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Category save failed.");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="border-gray-800 bg-gray-950 text-white">
        <CardHeader>
          <CardTitle className="text-white">Create or update category</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Category name"
            className="border-gray-700 bg-gray-900 text-white"
          />
          <Input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="Slug"
            className="border-gray-700 bg-gray-900 text-white"
          />
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Description"
            className="min-h-[120px] border-gray-700 bg-gray-900 text-white"
          />
          <Button
            type="button"
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={handleSaveCategory}
            disabled={saveCategory.isPending}
          >
            Save category
          </Button>
        </CardContent>
      </Card>

      <Card className="border-gray-800 bg-gray-950 text-white">
        <CardHeader>
          <CardTitle className="text-white">Categories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {categories.map((category) => (
            <div key={category.$id} className="rounded-2xl border border-gray-800 bg-black/30 p-4">
              <p className="font-semibold text-white">{category.name}</p>
              <p className="mt-2 text-sm text-gray-400">{category.slug}</p>
            </div>
          ))}
          {!categories.length ? (
            <div className="rounded-2xl border border-gray-800 bg-black/30 p-6 text-sm text-gray-400">
              No categories found yet. Create them through the admin console function backend.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-gray-800 bg-gray-950 text-white lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-white">Homepage collections</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((row) => (
            <div key={row.$id} className="rounded-2xl border border-gray-800 bg-black/30 p-4">
              <p className="font-semibold text-white">{row.name}</p>
              <p className="mt-2 text-sm text-gray-400">{row.slug}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default CategoriesPage;
