"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import * as Toast from "@radix-ui/react-toast";

interface Category {
  id: number;
  name: string;
}

interface Brand {
  id: number;
  name: string;
}

interface Product {
  id: number;
  reference: string;
  internalCode: string;
  name: string;
  description?: string;
  stock: number;
  minStock: number;
  purchasePrice: number;
  marginPercent: number;
  salePrice: number;
  priceIncludingTax: number;
  discount: number;
  vat: number;
  fodec: number; // ADD FODEC TO INTERFACE
  categoryId: number;
  brandId?: number;
  img?: string;
}

const fetchCategories = async (): Promise<Category[]> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}categories`);
  if (!response.ok) throw new Error("Échec de la récupération des catégories");
  return response.json();
};

const fetchBrands = async (): Promise<Brand[]> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}brands`);
  if (!response.ok) throw new Error("Échec de la récupération des marques");
  return response.json();
};

const fetchProduct = async (id: string): Promise<Product> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}products/${id}`);
  if (!response.ok) throw new Error("Échec de la récupération du produit");
  return response.json();
};

const updateProduct = async ({ id, data }: { id: string; data: FormData }) => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}products/${id}`, {
    method: "PUT",
    body: data,
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Échec de la mise à jour du produit");
  }
  return response.json();
};

const vatOptions = [
  { value: 0, label: "0%" },
  { value: 7, label: "7%" },
  { value: 19, label: "19%" },
];

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditProductPage({ params }: PageProps) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);

  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  if (!resolvedParams) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return <EditProductContent id={resolvedParams.id} />;
}

function EditProductContent({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [formData, setFormData] = useState({
    reference: "",
    internalCode: "",
    name: "",
    description: "",
    stock: 0,
    minStock: 0,
    purchasePrice: 0,
    marginPercent: 0,
    salePrice: 0,
    priceIncludingTax: 0,
    discount: 0,
    vat: "19",
    fodec: 0, // ADD FODEC FIELD
    categoryId: "",
    brandId: "",
  });

  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImage, setExistingImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories
  });

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: fetchBrands
  });

  const { data: product, isLoading: isLoadingProduct } = useQuery({
    queryKey: ["product", id],
    queryFn: () => fetchProduct(id),
    enabled: !!id,
  });

  const calculateSalePrice = () => {
    if (formData.purchasePrice && formData.marginPercent) {
      const calculatedPrice = formData.purchasePrice * (1 + formData.marginPercent / 100);
      setFormData(prev => ({
        ...prev,
        salePrice: parseFloat(calculatedPrice.toFixed(3))
      }));
    }
  };

  const calculatePriceIncludingTax = () => {
    if (formData.salePrice) {
      const calculatedPrice = formData.salePrice * (1 + parseFloat(formData.vat) / 100);
      setFormData(prev => ({
        ...prev,
        priceIncludingTax: parseFloat(calculatedPrice.toFixed(3))
      }));
    }
  };

  useEffect(() => {
    calculatePriceIncludingTax();
  }, [formData.salePrice, formData.vat]);

  useEffect(() => {
    if (product) {
      setFormData({
        reference: product.reference || "",
        internalCode: product.internalCode || "",
        name: product.name,
        description: product.description || "",
        stock: product.stock,
        minStock: product.minStock,
        purchasePrice: product.purchasePrice,
        marginPercent: product.marginPercent,
        salePrice: product.salePrice,
        priceIncludingTax: product.priceIncludingTax,
        discount: product.discount,
        vat: String(product.vat),
        fodec: product.fodec || 0, // ADD FODEC FROM PRODUCT
        categoryId: String(product.categoryId),
        brandId: product.brandId ? String(product.brandId) : "",
      });
      setExistingImage(product.img || null);
    }
  }, [product]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
        showToast("Seuls les fichiers image sont autorisés (jpg, jpeg, png, gif, webp)", "error");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast("La taille de l'image ne doit pas dépasser 5 Mo", "error");
        return;
      }
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMsg(msg);
    setToastType(type);
    setToastOpen(true);
  };

  const updateMutation = useMutation({
    mutationFn: updateProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      showToast("✅ Produit mis à jour avec succès", "success");
      setTimeout(() => router.push("/products"), 1500);
    },
    onError: (error: Error) => {
      showToast(`❌ ${error.message || "Problème de connexion"}`, "error");
    },
    onSettled: () => setIsSubmitting(false),
  });

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    if (!formData.name) {
      showToast("Le nom est requis", "error");
      setIsSubmitting(false);
      return;
    }

    if (formData.purchasePrice <= 0) {
      showToast("Le prix d'achat doit être positif", "error");
      setIsSubmitting(false);
      return;
    }

    if (!formData.categoryId) {
      showToast("Veuillez sélectionner une catégorie", "error");
      setIsSubmitting(false);
      return;
    }

    const submitData = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (value !== "" && value !== null && key !== "brandId") {
        submitData.append(key, String(value));
      }
    });
    if (formData.brandId) submitData.append("brandId", formData.brandId);
    if (image) submitData.append("image", image);

    updateMutation.mutate({ id, data: submitData });
  };

  const handleCancel = () => router.push("/products");

  if (isLoadingProduct) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <Toast.Provider>
      <div className="p-6">
        <PageBreadcrumb pageTitle="Modifier le produit" />
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.push("/products")}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            ← Retour à la liste
          </button>
        </div>

        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
            <h3 className="text-xl font-semibold text-black dark:text-white">
              Modifier le produit
            </h3>
          </div>

          <form onSubmit={submitForm}>
            <div className="p-6.5">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Référence */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Référence
                  </label>
                  <input
                    type="text"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Code interne */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Code interne
                  </label>
                  <input
                    type="text"
                    value={formData.internalCode}
                    onChange={(e) => setFormData({ ...formData, internalCode: e.target.value })}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Nom */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Nom <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Catégorie */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Catégorie <span className="text-danger">*</span>
                  </label>
                  <select
                    required
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  >
                    <option value="">Sélectionner une catégorie</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Marque */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Marque
                  </label>
                  <select
                    value={formData.brandId}
                    onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  >
                    <option value="">Sélectionner une marque</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stock */}
                {/* <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div> */}

                {/* Stock minimum */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Stock minimum
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Prix d'achat */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Prix d'achat (DT) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    required
                    value={formData.purchasePrice}
                    onChange={(e) => {
                      setFormData({ ...formData, purchasePrice: Number(e.target.value) });
                      calculateSalePrice();
                    }}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Marge (%) */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Marge (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData.marginPercent}
                    onChange={(e) => {
                      setFormData({ ...formData, marginPercent: Number(e.target.value) });
                      calculateSalePrice();
                    }}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Prix de vente */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Prix de vente (DT)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={formData.salePrice}
                    onChange={(e) => setFormData({ ...formData, salePrice: Number(e.target.value) })}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Prix TTC */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Prix TTC (DT)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.priceIncludingTax}
                    readOnly
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-gray-100 px-5 py-3 outline-none dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* FODEC - NEW FIELD */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    FODEC (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.fodec}
                    onChange={(e) => setFormData({ ...formData, fodec: Number(e.target.value) })}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    FODEC (Fonds de Développement de la Compétitivité)
                  </p>
                </div>

                {/* TVA */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    TVA (%)
                  </label>
                  <select
                    value={formData.vat}
                    onChange={(e) => setFormData({ ...formData, vat: e.target.value })}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  >
                    {vatOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Remise */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Remise (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.discount}
                    onChange={(e) => setFormData({ ...formData, discount: Number(e.target.value) })}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="mt-6">
                <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                  Description
                </label>
                <textarea
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                />
              </div>

              {/* Téléchargement d'image */}
              <div className="mt-6">
                <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                  Image du produit
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleImageChange}
                  className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Formats acceptés : JPG, JPEG, PNG, GIF, WEBP (Max : 5 Mo). Laissez vide pour conserver l'image actuelle.
                </p>

                {(imagePreview || existingImage) && (
                  <div className="mt-4 text-center">
                    <p className="mb-2 text-sm font-medium text-black dark:text-white">Aperçu :</p>
                    <img
                      src={imagePreview || existingImage || ""}
                      alt="Aperçu"
                      className="mx-auto max-h-48 rounded-lg border object-contain"
                    />
                  </div>
                )}
              </div>

              {/* Boutons */}
              <div className="mt-6 flex gap-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-md border border-stroke px-6 py-3 font-medium hover:bg-gray-100 dark:hover:bg-meta-4 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md border border-stroke px-6 py-3 font-medium hover:bg-gray-100 dark:hover:bg-meta-4 transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent inline-block mr-2"></div>
                      Mise à jour...
                    </>
                  ) : (
                    "Mettre à jour le produit"
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        <Toast.Root
          open={toastOpen}
          onOpenChange={setToastOpen}
          className={`fixed top-20 right-4 w-80 rounded-md p-4 shadow-lg z-50 ${toastType === "success"
            ? "bg-green-600 dark:bg-green-700 text-white"
            : "bg-red-600 dark:bg-red-700 text-white"
            }`}
          duration={3000}
        >
          <Toast.Title className="font-medium">{toastMsg}</Toast.Title>
        </Toast.Root>
        <Toast.Viewport className="fixed top-4 right-4 z-50 outline-none" />
      </div>
    </Toast.Provider>
  );
}