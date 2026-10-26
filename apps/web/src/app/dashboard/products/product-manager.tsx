"use client";

import React, { useState, useEffect } from "react";
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
  Camera,
  UploadCloud,
  ImageIcon,
} from "lucide-react";
import { toBirr, formatBirr } from "@order-by-sms/contracts";

export interface ProductItem {
  id: string;
  name: string;
  priceSantim: number;
  available: boolean;
  imageUrl?: string | null;
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
  const item =
    result && typeof result === "object" && "data" in result && result.data
      ? result.data
      : result;
  return {
    id: String(item.id || ""),
    name: String(item.name || ""),
    priceSantim: Number(item.priceSantim ?? item.price_santim ?? 0),
    available: Boolean(item.available),
    ...(item.imageUrl || item.image_url ? { imageUrl: item.imageUrl || item.image_url } : {}),
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
  const item =
    result && typeof result === "object" && "data" in result && result.data
      ? result.data
      : result;
  return {
    id: String(item.id || ""),
    name: String(item.name || ""),
    priceSantim: Number(item.priceSantim ?? item.price_santim ?? 0),
    available: Boolean(item.available),
    ...(item.imageUrl || item.image_url ? { imageUrl: item.imageUrl || item.image_url } : {}),
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
  const item =
    result && typeof result === "object" && "data" in result && result.data
      ? result.data
      : result;
  return {
    id: String(item.id || ""),
    name: String(item.name || ""),
    priceSantim: Number(item.priceSantim ?? item.price_santim ?? 0),
    available: Boolean(item.available),
    ...(item.imageUrl || item.image_url ? { imageUrl: item.imageUrl || item.image_url } : {}),
  };
}

/**
 * API submission helper: POST /api/products/:id/image (upload photo)
 */
export async function uploadProductImageApi(
  productId: string,
  file: File,
  fetchFn: typeof fetch = fetch
): Promise<ProductItem> {
  const formData = new FormData();
  formData.append("image", file);

  const res = await fetchFn(`/api/products/${encodeURIComponent(productId)}/image`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let msg = `Failed to upload image (${res.status})`;
    try {
      const err = await res.json();
      msg = err.message || err.error?.message || err.error || msg;
    } catch {
      // Ignore json parse error
    }
    throw new Error(msg);
  }

  const result = await res.json();
  const item =
    result && typeof result === "object" && "data" in result && result.data
      ? result.data
      : result;
  return {
    id: String(item.id || ""),
    name: String(item.name || ""),
    priceSantim: Number(item.priceSantim ?? item.price_santim ?? 0),
    available: Boolean(item.available),
    imageUrl: item.imageUrl ?? item.image_url ?? null,
  };
}

/**
 * API submission helper: DELETE /api/products/:id/image (remove photo)
 */
export async function deleteProductImageApi(
  productId: string,
  fetchFn: typeof fetch = fetch
): Promise<ProductItem> {
  const res = await fetchFn(`/api/products/${encodeURIComponent(productId)}/image`, {
    method: "DELETE",
  });

  if (!res.ok) {
    let msg = `Failed to remove image (${res.status})`;
    try {
      const err = await res.json();
      msg = err.message || err.error?.message || err.error || msg;
    } catch {
      // Ignore json parse error
    }
    throw new Error(msg);
  }

  const result = await res.json();
  const item =
    result && typeof result === "object" && "data" in result && result.data
      ? result.data
      : result;
  return {
    id: String(item.id || ""),
    name: String(item.name || ""),
    priceSantim: Number(item.priceSantim ?? item.price_santim ?? 0),
    available: Boolean(item.available),
    imageUrl: null,
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
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState<string | null>(null);
  const [formRemoveImage, setFormRemoveImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const openAddModal = () => {
    setFormName("");
    setFormPriceBirr("");
    setFormAvailable(true);
    setFormImageFile(null);
    setFormImagePreview(null);
    setFormRemoveImage(false);
    setFormError(null);
    setIsAddOpen(true);
  };

  const openEditModal = (p: ProductItem) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormPriceBirr(
      String(
        toBirr(
          typeof p?.priceSantim === "number" && !isNaN(p.priceSantim)
            ? p.priceSantim
            : 0
        )
      )
    );
    setFormAvailable(p.available);
    setFormImageFile(null);
    setFormImagePreview(p.imageUrl || null);
    setFormRemoveImage(false);
    setFormError(null);
  };

  const closeModals = () => {
    setIsAddOpen(false);
    setEditingProduct(null);
    setDeletingProduct(null);
    setFormImageFile(null);
    setFormImagePreview(null);
    setFormRemoveImage(false);
    setFormError(null);
  };

  const isAnyModalOpen = isAddOpen || !!editingProduct || !!deletingProduct;

  useEffect(() => {
    if (!isAnyModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModals();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAnyModalOpen]);

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
      let created = await createProductApi({
        name: formName.trim(),
        priceBirr: Number(formPriceBirr),
        available: formAvailable,
      });

      if (formImageFile) {
        try {
          created = await uploadProductImageApi(created.id, formImageFile);
        } catch (imgErr: any) {
          console.warn("Product created but photo upload failed:", imgErr);
        }
      }

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
      let updated = await updateProductApi(editingProduct.id, {
        name: formName.trim(),
        priceBirr: Number(formPriceBirr),
        available: formAvailable,
      });

      if (formImageFile) {
        updated = await uploadProductImageApi(editingProduct.id, formImageFile);
      } else if (formRemoveImage && editingProduct.imageUrl) {
        updated = await deleteProductImageApi(editingProduct.id);
      }

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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Products Catalog</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage item pricing in Birr and storefront availability.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 rounded-xl transition shadow-xs text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </button>
      </div>

      {/* Product List or Empty State */}
      {products.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-xs">
          <div className="w-14 h-14 mx-auto mb-4 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">No products added yet</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
            Add items to your catalog with prices in Birr so buyers can view and purchase them from your storefront.
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Your First Product</span>
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          {/* Mobile Stacked Card View (< md) */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {products.map((p) => {
              const priceFormatted = formatBirr(
                typeof p?.priceSantim === "number" && !isNaN(p.priceSantim)
                  ? p.priceSantim
                  : 0
              );
              const isToggling = togglingId === p.id;

              return (
                <div key={`mobile-${p.id}`} className="p-4 space-y-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <ShoppingBag className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-base truncate">{p.name}</h4>
                        <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{priceFormatted}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => handleToggleAvailability(p)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition min-h-[36px] ${
                        p.available
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
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
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => openEditModal(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition min-h-[40px]"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingProduct(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-lg transition min-h-[40px]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-200">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3">Price (ETB)</th>
                  <th className="px-4 py-3">Availability</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {products.map((p) => {
                  const priceFormatted = formatBirr(
                    typeof p?.priceSantim === "number" && !isNaN(p.priceSantim)
                      ? p.priceSantim
                      : 0
                  );
                  const isToggling = togglingId === p.id;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <ShoppingBag className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                            )}
                          </div>
                          <span className="font-medium text-slate-900 dark:text-slate-100">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {priceFormatted}
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          disabled={isToggling}
                          onClick={() => handleToggleAvailability(p)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition ${
                            p.available
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
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
                          className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                          title="Edit product"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingProduct(p)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModals();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-product-title"
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl max-w-md w-full space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 id="add-product-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Add New Product
              </h3>
              <button
                type="button"
                onClick={closeModals}
                aria-label="Close modal"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg flex items-center gap-2 text-rose-800 dark:text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label
                  htmlFor="add-product-name"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
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
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="add-product-price"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
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
                    className="w-full pl-3.5 pr-14 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 dark:text-slate-500 font-semibold">
                    ETB
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Product Photo (Optional)
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                    {formImagePreview ? (
                      <img
                        src={formImagePreview}
                        alt="Product preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <label
                      htmlFor="add-product-photo"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>{formImagePreview ? "Change Photo" : "Upload Photo"}</span>
                    </label>
                    <input
                      id="add-product-photo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setFormImageFile(file);
                          setFormImagePreview(URL.createObjectURL(file));
                          setFormRemoveImage(false);
                        }
                      }}
                    />
                    {formImagePreview && (
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            setFormImageFile(null);
                            setFormImagePreview(null);
                            setFormRemoveImage(true);
                          }}
                          className="text-[11px] text-rose-500 hover:text-rose-700 dark:text-rose-400 font-medium transition"
                        >
                          Remove photo
                        </button>
                      </div>
                    )}
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      JPEG, PNG, WebP or AVIF up to 5MB
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="add-product-available"
                  type="checkbox"
                  checked={formAvailable}
                  onChange={(e) => setFormAvailable(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-emerald-500"
                />
                <label
                  htmlFor="add-product-available"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300 select-none cursor-pointer"
                >
                  Visible and available on storefront immediately
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeModals}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 shadow-xs"
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModals();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-product-title"
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl max-w-md w-full space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 id="edit-product-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Edit Product
              </h3>
              <button
                type="button"
                onClick={closeModals}
                aria-label="Close modal"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg flex items-center gap-2 text-rose-800 dark:text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label
                  htmlFor="edit-product-name"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
                >
                  Product Name *
                </label>
                <input
                  id="edit-product-name"
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-product-price"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
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
                    className="w-full pl-3.5 pr-14 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 dark:text-slate-500 font-semibold">
                    ETB
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Product Photo (Optional)
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                    {formImagePreview ? (
                      <img
                        src={formImagePreview}
                        alt="Product preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <label
                      htmlFor="edit-product-photo"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer transition"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>{formImagePreview ? "Change Photo" : "Upload Photo"}</span>
                    </label>
                    <input
                      id="edit-product-photo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setFormImageFile(file);
                          setFormImagePreview(URL.createObjectURL(file));
                          setFormRemoveImage(false);
                        }
                      }}
                    />
                    {formImagePreview && (
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            setFormImageFile(null);
                            setFormImagePreview(null);
                            setFormRemoveImage(true);
                          }}
                          className="text-[11px] text-rose-500 hover:text-rose-700 dark:text-rose-400 font-medium transition"
                        >
                          Remove photo
                        </button>
                      </div>
                    )}
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      JPEG, PNG, WebP or AVIF up to 5MB
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="edit-product-available"
                  type="checkbox"
                  checked={formAvailable}
                  onChange={(e) => setFormAvailable(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-emerald-500"
                />
                <label
                  htmlFor="edit-product-available"
                  className="text-sm font-medium text-slate-700 dark:text-slate-300 select-none cursor-pointer"
                >
                  Visible and available on storefront
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeModals}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 shadow-xs"
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModals();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-product-title"
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl max-w-md w-full space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 id="delete-product-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Delete Product
              </h3>
              <button
                type="button"
                onClick={closeModals}
                aria-label="Close modal"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  &ldquo;{deletingProduct.name}&rdquo;
                </span>
                ?
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This item will be removed from your public storefront. Existing completed or past orders containing this product will remain completely intact.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={closeModals}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 shadow-xs"
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
