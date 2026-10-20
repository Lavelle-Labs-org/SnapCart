"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  AlertCircle,
  ShoppingBag,
  Loader2,
} from "lucide-react";
import { toBirr, formatBirr } from "@order-by-sms/contracts";

export interface ProductItem {
  id: string;
  name: string;
  priceSantim: number;
  available: boolean;
}

export interface ProductManagerProps {
  initialProducts: ProductItem[];
}

/**
 * Validates product name and price in Birr.
 */
export function validateProductInput(
  name: string,
  priceBirr: string
): { isValid: boolean; error?: string } {
  const trimmedName = name.trim();
  if (!trimmedName || trimmedName.length < 2) {
    return { isValid: false, error: "Product name must be at least 2 characters long" };
  }
  if (trimmedName.length > 100) {
    return { isValid: false, error: "Product name cannot exceed 100 characters" };
  }

  const numPrice = Number(priceBirr);
  if (isNaN(numPrice) || numPrice <= 0) {
    return { isValid: false, error: "Price in Birr must be a positive number greater than 0" };
  }

  return { isValid: true };
}

/**
 * API submission helper: POST /api/products
 */
export async function createProductApi(
  data: { name: string; priceBirr: number; available?: boolean },
  fetchFn: typeof fetch = fetch
): Promise<ProductItem> {
  const res = await fetchFn("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    let msg = `Failed to create product (${res.status})`;
    try {
      const err = await res.json();
      msg = err.message || err.error || msg;
    } catch {
      // Ignore json parse error
    }
    throw new Error(msg);
  }

  const result = await res.json();
  return {
    id: result.id,
    name: result.name,
    priceSantim: result.priceSantim ?? result.price_santim,
    available: Boolean(result.available),
  };
}

/**
 * API submission helper: PATCH /api/products/:id (toggles availability)
 */
export async function toggleAvailabilityApi(
  productId: string,
  currentAvailable: boolean,
  fetchFn: typeof fetch = fetch
): Promise<ProductItem> {
  const res = await fetchFn(`/api/products/${encodeURIComponent(productId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ available: !currentAvailable }),
  });

  if (!res.ok) {
    let msg = `Failed to update availability (${res.status})`;
    try {
      const err = await res.json();
      msg = err.message || err.error || msg;
    } catch {
      // Ignore json parse error
    }
    throw new Error(msg);
  }

  const result = await res.json();
  return {
    id: result.id,
    name: result.name,
    priceSantim: result.priceSantim ?? result.price_santim,
    available: Boolean(result.available),
  };
}

/**
 * API submission helper: PATCH /api/products/:id (edit name/price)
 */
export async function updateProductApi(
  productId: string,
  data: { name?: string; priceBirr?: number; available?: boolean },
  fetchFn: typeof fetch = fetch
): Promise<ProductItem> {
  const res = await fetchFn(`/api/products/${encodeURIComponent(productId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    let msg = `Failed to update product (${res.status})`;
    try {
      const err = await res.json();
      msg = err.message || err.error || msg;
    } catch {
      // Ignore json parse error
    }
    throw new Error(msg);
  }

  const result = await res.json();
  return {
    id: result.id,
    name: result.name,
    priceSantim: result.priceSantim ?? result.price_santim,
    available: Boolean(result.available),
  };
}

/**
 * API submission helper: DELETE /api/products/:id (soft delete)
 */
export async function deleteProductApi(
  productId: string,
  fetchFn: typeof fetch = fetch
): Promise<{ deleted: boolean; id: string }> {
  const res = await fetchFn(`/api/products/${encodeURIComponent(productId)}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    let msg = `Failed to delete product (${res.status})`;
    try {
      const err = await res.json();
      msg = err.message || err.error || msg;
    } catch {
      // Ignore json parse error
    }
    throw new Error(msg);
  }

  return { deleted: true, id: productId };
}

export default function ProductManager({ initialProducts }: ProductManagerProps) {
  const router = useRouter();
  const [products, setProducts] = useState<ProductItem[]>(initialProducts);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProductItem | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formPriceBirr, setFormPriceBirr] = useState("");
  const [formAvailable, setFormAvailable] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const openAddModal = () => {
    setFormName("");
    setFormPriceBirr("");
    setFormAvailable(true);
    setFormError(null);
    setIsAddOpen(true);
  };

  const openEditModal = (p: ProductItem) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormPriceBirr(String(toBirr(p.priceSantim)));
    setFormAvailable(p.available);
    setFormError(null);
  };

  const closeModals = () => {
    setIsAddOpen(false);
    setEditingProduct(null);
    setDeletingProduct(null);
    setFormError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateProductInput(formName, formPriceBirr);
    if (!validation.isValid) {
      setFormError(validation.error!);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const created = await createProductApi({
        name: formName.trim(),
        priceBirr: Number(formPriceBirr),
        available: formAvailable,
      });

      setProducts((prev) => [...prev, created]);
      closeModals();
      router.refresh();
    } catch (err: any) {
      setFormError(err?.message || "Failed to create product");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const validation = validateProductInput(formName, formPriceBirr);
    if (!validation.isValid) {
      setFormError(validation.error!);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const updated = await updateProductApi(editingProduct.id, {
        name: formName.trim(),
        priceBirr: Number(formPriceBirr),
        available: formAvailable,
      });

      setProducts((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
      closeModals();
      router.refresh();
    } catch (err: any) {
      setFormError(err?.message || "Failed to update product");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleAvailability = async (p: ProductItem) => {
    setTogglingId(p.id);
    try {
      const updated = await toggleAvailabilityApi(p.id, p.available);
      setProducts((prev) =>
        prev.map((item) => (item.id === p.id ? updated : item))
      );
      router.refresh();
    } catch (err: any) {
      alert(err?.message || "Failed to toggle availability");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;
    setIsSubmitting(true);

    try {
      await deleteProductApi(deletingProduct.id);
      setProducts((prev) => prev.filter((p) => p.id !== deletingProduct.id));
      closeModals();
      router.refresh();
    } catch (err: any) {
      alert(err?.message || "Failed to delete product");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products Catalog</h1>
          <p className="text-sm text-slate-500">
            Manage item pricing in Birr and storefront availability.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 rounded-xl transition shadow-sm text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </button>
      </div>

      {/* Product List or Empty State */}
      {products.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="w-14 h-14 mx-auto mb-4 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">No products added yet</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            Add items to your catalog with prices in Birr so buyers can view and purchase them from your storefront.
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Your First Product</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Price (ETB)</th>
                  <th className="px-4 py-3">Availability</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => {
                  const priceFormatted = formatBirr(p.priceSantim);
                  const isToggling = togglingId === p.id;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3.5 font-medium text-slate-900">{p.name}</td>
                      <td className="px-4 py-3.5 font-semibold text-emerald-600">
                        {priceFormatted}
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          disabled={isToggling}
                          onClick={() => handleToggleAvailability(p)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition ${
                            p.available
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          } disabled:opacity-50`}
                          title="Click to toggle storefront availability"
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              p.available ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          <span>{p.available ? "Available" : "Hidden"}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-right space-x-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                          title="Edit product"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingProduct(p)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                          title="Delete product"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add Product */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Add New Product</h3>
              <button
                type="button"
                onClick={closeModals}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-800 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label
                  htmlFor="add-product-name"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
                >
                  Product Name *
                </label>
                <input
                  id="add-product-name"
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Special Habesha Doro Wat"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="add-product-price"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
                >
                  Price in Ethiopian Birr (ETB) *
                </label>
                <div className="relative">
                  <input
                    id="add-product-price"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formPriceBirr}
                    onChange={(e) => setFormPriceBirr(e.target.value)}
                    placeholder="350.00"
                    className="w-full pl-3.5 pr-14 py-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-semibold">
                    ETB
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="add-product-available"
                  type="checkbox"
                  checked={formAvailable}
                  onChange={(e) => setFormAvailable(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <label
                  htmlFor="add-product-available"
                  className="text-sm font-medium text-slate-700 select-none cursor-pointer"
                >
                  Visible and available on storefront immediately
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModals}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 shadow-sm"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{isSubmitting ? "Creating..." : "Create Product"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Product */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Edit Product</h3>
              <button
                type="button"
                onClick={closeModals}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-800 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label
                  htmlFor="edit-product-name"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
                >
                  Product Name *
                </label>
                <input
                  id="edit-product-name"
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-product-price"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
                >
                  Price in Ethiopian Birr (ETB) *
                </label>
                <div className="relative">
                  <input
                    id="edit-product-price"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formPriceBirr}
                    onChange={(e) => setFormPriceBirr(e.target.value)}
                    className="w-full pl-3.5 pr-14 py-2.5 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-semibold">
                    ETB
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="edit-product-available"
                  type="checkbox"
                  checked={formAvailable}
                  onChange={(e) => setFormAvailable(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <label
                  htmlFor="edit-product-available"
                  className="text-sm font-medium text-slate-700 select-none cursor-pointer"
                >
                  Visible and available on storefront
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModals}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 shadow-sm"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{isSubmitting ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {deletingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Delete Product</h3>
              <button
                type="button"
                onClick={closeModals}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-slate-700">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-slate-900">
                  &ldquo;{deletingProduct.name}&rdquo;
                </span>
                ?
              </p>
              <p className="text-xs text-slate-500">
                This item will be removed from your public storefront. Existing completed or past orders containing this product will remain completely intact.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={closeModals}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 shadow-sm"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isSubmitting ? "Deleting..." : "Delete Product"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
