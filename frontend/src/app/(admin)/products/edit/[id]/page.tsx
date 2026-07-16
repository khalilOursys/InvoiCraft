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

interface RawMaterial {
  id: number;
  name: string;
  unit: string;
}

interface Service {
  id: number;
  name: string;
  price: number;
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
  fodec: number;
  categoryId: number;
  brandId?: number;
  img?: string;
}

interface CraftProduct {
  id: number;
  reference: string;
  name: string;
  description?: string;
  unit: string;
  amount: number;
  totalCost?: number;
  salePrice?: number;
  marginPercent: number;
  vat: number;
  minStock: number;
  img?: string;
  isActive: boolean;
  productId?: number;
  craftMaterials?: { rawMaterialId: number; amount: number }[];
  craftServices?: { serviceId: number }[];
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

const fetchRawMaterials = async (): Promise<RawMaterial[]> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}raw-materials`);
  if (!response.ok) throw new Error("Échec de la récupération des matières premières");
  return response.json();
};

const fetchServices = async (): Promise<Service[]> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}services`);
  if (!response.ok) throw new Error("Échec de la récupération des services");
  return response.json();
};

const fetchProduct = async (id: string): Promise<{ product?: Product; craftProduct?: CraftProduct }> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}products/product-craft/${id}`);
  if (!response.ok) throw new Error("Échec de la récupération du produit");
  return response.json();
};

const updateProductCraft = async ({ id, data }: { id: string; data: FormData }) => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}products/product-craft/${id}`, {
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

const unitOptions = [
  { value: "mg", label: "mg" },
  { value: "ml", label: "ml" },
  { value: "g", label: "g" },
  { value: "L", label: "L" },
  { value: "kg", label: "kg" },
  { value: "unit", label: "Unité" },
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
    // Product fields
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
    fodec: 0,
    categoryId: "",
    brandId: "",
    // Craft product fields
    craftReference: "",
    craftName: "",
    craftDescription: "",
    craftUnit: "kg",
    craftAmount: 0,
    craftMarginPercent: 30,
    craftVat: 19,
    craftMinStock: 5,
    craftProductId: "",
    craftMaterials: [] as { rawMaterialId: number; amount: number }[],
    craftServiceIds: [] as number[],
  });

  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImage, setExistingImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [hasCraftProduct, setHasCraftProduct] = useState(true);
  const [craftProductId, setCraftProductId] = useState<number | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories
  });

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: fetchBrands
  });

  const { data: rawMaterials = [] } = useQuery({
    queryKey: ["rawMaterials"],
    queryFn: fetchRawMaterials
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services"],
    queryFn: fetchServices
  });

  const { data: productData, isLoading: isLoadingProduct } = useQuery({
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
    if (productData) {
      const product = productData.product;
      const craftProduct = productData.craftProduct;

      // Set product data
      if (product) {
        setFormData(prev => ({
          ...prev,
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
          fodec: product.fodec || 0,
          categoryId: String(product.categoryId),
          brandId: product.brandId ? String(product.brandId) : "",
        }));
        setExistingImage(product.img || null);
      }

      // Set craft product data if it exists
      if (craftProduct) {
        setHasCraftProduct(true);
        setCraftProductId(craftProduct.id);
        setFormData(prev => ({
          ...prev,
          craftReference: craftProduct.reference || "",
          craftName: craftProduct.name || "",
          craftDescription: craftProduct.description || "",
          craftUnit: craftProduct.unit || "kg",
          craftAmount: craftProduct.amount || 0,
          craftMarginPercent: craftProduct.marginPercent || 30,
          craftVat: craftProduct.vat || 19,
          craftMinStock: craftProduct.minStock || 5,
          craftProductId: craftProduct.productId ? String(craftProduct.productId) : "",
          craftMaterials: craftProduct.craftMaterials?.map(m => ({
            rawMaterialId: m.rawMaterialId,
            amount: m.amount
          })) || [],
          craftServiceIds: craftProduct.craftServices?.map(s => s.serviceId) || [],
        }));
      }
    }
  }, [productData]);

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
    mutationFn: updateProductCraft,
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

  const handleAddMaterial = () => {
    setFormData(prev => ({
      ...prev,
      craftMaterials: [...prev.craftMaterials, { rawMaterialId: 0, amount: 0 }]
    }));
  };

  const handleRemoveMaterial = (index: number) => {
    setFormData(prev => ({
      ...prev,
      craftMaterials: prev.craftMaterials.filter((_, i) => i !== index)
    }));
  };

  const handleMaterialChange = (index: number, field: string, value: any) => {
    const updated = [...formData.craftMaterials];
    updated[index] = { ...updated[index], [field]: value };
    setFormData(prev => ({ ...prev, craftMaterials: updated }));
  };

  const handleServiceToggle = (serviceId: number) => {
    setFormData(prev => {
      const exists = prev.craftServiceIds.includes(serviceId);
      return {
        ...prev,
        craftServiceIds: exists
          ? prev.craftServiceIds.filter(id => id !== serviceId)
          : [...prev.craftServiceIds, serviceId]
      };
    });
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    // Validate product
    if (!formData.name) {
      showToast("Le nom du produit est requis", "error");
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

    if (formData.salePrice <= 0) {
      showToast("Le prix de vente doit être positif", "error");
      setIsSubmitting(false);
      return;
    }

    if (formData.priceIncludingTax <= 0) {
      showToast("Le prix TTC doit être positif", "error");
      setIsSubmitting(false);
      return;
    }

    // Build product data
    const productData = {
      id: parseInt(id),
      reference: formData.reference,
      internalCode: formData.internalCode,
      name: formData.name,
      description: formData.description,
      stock: formData.stock,
      minStock: formData.minStock,
      purchasePrice: formData.purchasePrice,
      marginPercent: formData.marginPercent,
      salePrice: formData.salePrice,
      priceIncludingTax: formData.priceIncludingTax,
      discount: formData.discount,
      vat: parseInt(formData.vat),
      fodec: formData.fodec,
      categoryId: parseInt(formData.categoryId),
      brandId: formData.brandId ? parseInt(formData.brandId) : undefined,
    };

    // Build craft product data if it exists
    let craftProductData = null;
    if (hasCraftProduct && craftProductId) {
      craftProductData = {
        id: craftProductId,
        reference: formData.craftReference,
        name: formData.craftName,
        description: formData.craftDescription,
        unit: formData.craftUnit,
        amount: formData.craftAmount,
        marginPercent: formData.craftMarginPercent,
        vat: formData.craftVat,
        minStock: formData.craftMinStock,
        productId: formData.craftProductId ? parseInt(formData.craftProductId) : undefined,
        materials: formData.craftMaterials.filter(m => m.rawMaterialId > 0 && m.amount > 0),
        serviceIds: formData.craftServiceIds,
      };
    }

    // Create FormData
    const submitData = new FormData();

    // Add product as JSON string
    submitData.append("product", JSON.stringify(productData));

    // Add craft product as JSON string if it exists
    if (craftProductData) {
      submitData.append("craftProduct", JSON.stringify(craftProductData));
    }

    // Add image if a new one was selected
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

        {/* Info banner if craft product exists */}
        {hasCraftProduct && (
          <div className="mb-6 rounded-sm border border-green-500 bg-green-50 dark:bg-green-900/20 p-4">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              ⚡ Ce produit est lié à un produit artisanal (ID: {craftProductId})
            </p>
          </div>
        )}

        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
            <h3 className="text-xl font-semibold text-black dark:text-white">
              Informations du produit
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

                {/* Prix de vente */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Prix de vente (DT) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    required
                    value={formData.salePrice}
                    onChange={(e) => setFormData({ ...formData, salePrice: Number(e.target.value) })}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Prix TTC */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Prix TTC (DT) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={formData.priceIncludingTax}
                    onChange={(e) => setFormData({ ...formData, priceIncludingTax: Number(e.target.value) })}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* FODEC */}
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
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                />
              </div>

              {/* Image upload */}
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

              {/* Craft Product Section */}
              {hasCraftProduct && (
                <div className="mt-8 border-t border-stroke pt-6 dark:border-strokedark">
                  <h3 className="mb-4 text-xl font-semibold text-black dark:text-white">
                    Informations du produit artisanal lié
                  </h3>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {/* Craft Unit */}
                    <div>
                      <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                        Unité <span className="text-danger">*</span>
                      </label>
                      <select
                        required
                        value={formData.craftUnit}
                        onChange={(e) => setFormData({ ...formData, craftUnit: e.target.value })}
                        className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                      >
                        {unitOptions.map((unit) => (
                          <option key={unit.value} value={unit.value}>
                            {unit.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Materials Section */}
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-black dark:text-white">
                        Matières premières
                      </label>
                      <button
                        type="button"
                        onClick={handleAddMaterial}
                        className="rounded-md bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 transition-colors"
                      >
                        + Ajouter
                      </button>
                    </div>

                    {formData.craftMaterials.map((material, index) => (
                      <div key={index} className="mb-3 flex gap-3 items-end">
                        <div className="flex-1">
                          <select
                            value={material.rawMaterialId}
                            onChange={(e) => handleMaterialChange(index, 'rawMaterialId', Number(e.target.value))}
                            className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                          >
                            <option value={0}>Sélectionner une matière</option>
                            {rawMaterials.map((rm) => (
                              <option key={rm.id} value={rm.id}>
                                {rm.name} ({rm.unit})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Quantité"
                            value={material.amount}
                            onChange={(e) => handleMaterialChange(index, 'amount', Number(e.target.value))}
                            className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMaterial(index)}
                          className="rounded-md bg-red-600 px-3 py-3 text-white hover:bg-red-700 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Services Section */}
                  <div className="mt-6">
                    <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                      Services
                    </label>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                      {services.map((service) => (
                        <label key={service.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.craftServiceIds.includes(service.id)}
                            onChange={() => handleServiceToggle(service.id)}
                            className="h-4 w-4 accent-blue-600"
                          />
                          <span className="text-sm">{service.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
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
                  className="rounded-md bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent inline-block mr-2"></div>
                      Mise à jour...
                    </>
                  ) : (
                    "Mettre à jour"
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Toast Notifications */}
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