"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import validator from "validator";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import * as Toast from "@radix-ui/react-toast";

interface Product {
  id: number;
  name: string;
  purchasePrice: number;
}

interface RawMaterial {
  id: number;
  name: string;
  purchasePrice: number;
}

interface Service {
  id: number;
  name: string;
  salePrice: number;
}

interface Material {
  rawMaterialId: number;
  amount: number;
}

interface CraftProductData {
  reference: string;
  name: string;
  description?: string;
  unit: string;
  amount: number;
  productId?: number;
  materials: Material[];
  serviceIds: number[];
  marginPercent: number;
  vat: number;
  minStock: number;
  img?: string;
}

// API Functions
const fetchProduct = async (id: number): Promise<Product> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}products/${id}`);
  if (!response.ok) throw new Error("Failed to fetch product");
  return response.json();
};

const fetchRawMaterials = async (): Promise<RawMaterial[]> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}raw-materials`);
  if (!response.ok) throw new Error("Failed to fetch raw materials");
  return response.json();
};

const fetchServices = async (): Promise<Service[]> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}services`);
  if (!response.ok) throw new Error("Failed to fetch services");
  return response.json();
};

const createCraftProduct = async (data: CraftProductData) => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}craft-products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create craft product");
  }
  return response.json();
};

const unitOptions = [
  { value: "mg", label: "Milligramme" },
  { value: "ml", label: "Millilitre" },
  { value: "g", label: "Gramme" },
  { value: "L", label: "Litre" },
  { value: "kg", label: "Kilogramme" },
  { value: "unit", label: "Unité" },
];

interface PageProps {
  params: Promise<{ idProduct: string }>;
}

export default function AddCraftProductPage({ params }: PageProps) {
  const [resolvedParams, setResolvedParams] = useState<{ idProduct: string } | null>(null);

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

  return <AddCraftProductContent idProduct={resolvedParams.idProduct} />;
}

function AddCraftProductContent({ idProduct }: { idProduct: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const productId = parseInt(idProduct);

  const [formData, setFormData] = useState<CraftProductData>({
    reference: "",
    name: "",
    description: "",
    unit: "unit",
    amount: 1,
    productId: productId,
    materials: [{ rawMaterialId: 0, amount: 0 }],
    serviceIds: [],
    marginPercent: 30,
    vat: 19,
    minStock: 0,
    img: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  // Fetch product details
  const { data: product, isLoading: isLoadingProduct } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => fetchProduct(productId),
  });

  const { data: rawMaterials = [] } = useQuery({
    queryKey: ["rawMaterials"],
    queryFn: fetchRawMaterials,
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services"],
    queryFn: fetchServices,
  });

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMsg(msg);
    setToastType(type);
    setToastOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: createCraftProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["craftProducts"] });
      showToast("✅ Produit artisanal créé avec succès", "success");
      setTimeout(() => router.push(`/craft-products/list/${productId}`), 1500);
    },
    onError: (error: Error) => {
      showToast(`❌ ${error.message || "Erreur lors de la création"}`, "error");
    },
    onSettled: () => setIsSubmitting(false),
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "amount" || name === "marginPercent" || name === "vat" || name === "minStock"
        ? parseFloat(value) || 0
        : value,
    }));
  };

  const handleMaterialChange = (index: number, field: string, value: any) => {
    const newMaterials = [...formData.materials];
    newMaterials[index] = { ...newMaterials[index], [field]: value };
    setFormData((prev) => ({ ...prev, materials: newMaterials }));
  };

  const addMaterial = () => {
    setFormData((prev) => ({
      ...prev,
      materials: [...prev.materials, { rawMaterialId: 0, amount: 0 }],
    }));
  };

  const removeMaterial = (index: number) => {
    if (formData.materials.length > 1) {
      setFormData((prev) => ({
        ...prev,
        materials: prev.materials.filter((_, i) => i !== index),
      }));
    }
  };

  const handleServiceToggle = (serviceId: number) => {
    setFormData((prev) => {
      const index = prev.serviceIds.indexOf(serviceId);
      if (index > -1) {
        return { ...prev, serviceIds: prev.serviceIds.filter(id => id !== serviceId) };
      } else {
        return { ...prev, serviceIds: [...prev.serviceIds, serviceId] };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validate
    if (validator.isEmpty(formData.reference)) {
      showToast("La référence est obligatoire", "error");
      setIsSubmitting(false);
      return;
    }
    if (validator.isEmpty(formData.name)) {
      showToast("Le nom est obligatoire", "error");
      setIsSubmitting(false);
      return;
    }
    if (formData.amount <= 0) {
      showToast("La quantité doit être supérieure à 0", "error");
      setIsSubmitting(false);
      return;
    }
    if (formData.marginPercent < 0) {
      showToast("Le pourcentage de marge doit être supérieur ou égal à 0", "error");
      setIsSubmitting(false);
      return;
    }
    if (formData.materials.some(m => m.rawMaterialId === 0 || m.amount <= 0)) {
      showToast("Tous les matériaux doivent être sélectionnés avec une quantité valide", "error");
      setIsSubmitting(false);
      return;
    }

    createMutation.mutate(formData);
  };

  const handleCancel = () => router.push(`/craft-products/list/${productId}`);

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
        <PageBreadcrumb pageTitle="Ajouter un produit artisanal" />
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleCancel}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            ← Retour à la liste
          </button>
        </div>

        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
            <h3 className="text-xl font-semibold text-black dark:text-white">
              Nouveau produit artisanal
              {product && (
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                  pour le produit: {product.name}
                </span>
              )}
            </h3>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="p-6.5">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Reference */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Référence <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    name="reference"
                    value={formData.reference}
                    onChange={handleInputChange}
                    placeholder="Ex: PROD-001"
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Nom <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Nom du produit"
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Description du produit"
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Unit */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Unité <span className="text-danger">*</span>
                  </label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  >
                    {unitOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Quantité <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    min="0.01"
                    step="0.01"
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Product (readonly) */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Produit associé <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={product?.name || ""}
                    readOnly
                    disabled
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-gray-100 px-5 py-3 outline-none dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Margin */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Marge (%) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    name="marginPercent"
                    value={formData.marginPercent}
                    onChange={handleInputChange}
                    min="0"
                    step="0.1"
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* VAT */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    TVA (%) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    name="vat"
                    value={formData.vat}
                    onChange={handleInputChange}
                    min="0"
                    max="100"
                    step="0.1"
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Min Stock */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Stock Minimum <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    name="minStock"
                    value={formData.minStock}
                    onChange={handleInputChange}
                    min="0"
                    step="1"
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Image URL */}
                <div className="md:col-span-2">
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Image URL
                  </label>
                  <input
                    type="text"
                    name="img"
                    value={formData.img}
                    onChange={handleInputChange}
                    placeholder="https://example.com/image.jpg"
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>
              </div>

              {/* Materials Section */}
              <div className="mt-6">
                <h4 className="text-lg font-semibold text-black dark:text-white mb-4">
                  Matériaux <span className="text-danger">*</span>
                </h4>
                {formData.materials.map((material, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                        Matériau
                      </label>
                      <select
                        value={material.rawMaterialId}
                        onChange={(e) => handleMaterialChange(index, "rawMaterialId", parseInt(e.target.value))}
                        className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                      >
                        <option value={0}>Sélectionner un matériau</option>
                        {rawMaterials.map((rm) => (
                          <option key={rm.id} value={rm.id}>
                            {rm.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                        Quantité
                      </label>
                      <input
                        type="number"
                        value={material.amount}
                        onChange={(e) => handleMaterialChange(index, "amount", parseFloat(e.target.value) || 0)}
                        min="0.01"
                        step="0.01"
                        className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeMaterial(index)}
                        className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 transition-colors"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addMaterial}
                  className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700 transition-colors"
                >
                  + Ajouter un matériau
                </button>
              </div>

              {/* Services Section */}
              <div className="mt-6">
                <h4 className="text-lg font-semibold text-black dark:text-white mb-4">
                  Services
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {services.map((service) => (
                    <label key={service.id} className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={formData.serviceIds.includes(service.id)}
                        onChange={() => handleServiceToggle(service.id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-black dark:text-white">{service.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Buttons */}
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
                  className="rounded-md bg-primary px-6 py-3 font-medium text-white hover:bg-opacity-90 transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent inline-block mr-2"></div>
                      Création...
                    </>
                  ) : (
                    "Créer le produit"
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