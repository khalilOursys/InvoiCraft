"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import * as Toast from "@radix-ui/react-toast";

interface RawMaterial {
  id: number;
  reference: string;
  name: string;
  description?: string;
  unit: string;
  amount: number;
  purchasePrice: number;
}

const fetchRawMaterial = async (id: string): Promise<RawMaterial> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}raw-materials/${id}`);
  if (!response.ok) throw new Error("Échec de la récupération de la matière première");
  return response.json();
};

const updateRawMaterial = async ({ id, data }: { id: string; data: any }) => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}raw-materials/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Échec de la mise à jour de la matière première");
  }
  return response.json();
};

const unitOptions = [
  { value: "g", label: "Gramme (g)" },
  { value: "kg", label: "Kilogramme (kg)" },
  { value: "mg", label: "Milligramme (mg)" },
  { value: "L", label: "Litre (L)" },
  { value: "ml", label: "Millilitre (ml)" },
  { value: "unit", label: "Unité" },
];

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditRawMaterialPage({ params }: PageProps) {
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

  return <EditRawMaterialContent id={resolvedParams.id} />;
}

function EditRawMaterialContent({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [formData, setFormData] = useState({
    reference: "",
    name: "",
    description: "",
    unit: "unit",
    amount: 0,
    purchasePrice: 0,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const { data: material, isLoading: isLoadingMaterial } = useQuery({
    queryKey: ["raw-material", id],
    queryFn: () => fetchRawMaterial(id),
    enabled: !!id,
  });

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMsg(msg);
    setToastType(type);
    setToastOpen(true);
  };

  useEffect(() => {
    if (material) {
      setFormData({
        reference: material.reference || "",
        name: material.name,
        description: material.description || "",
        unit: material.unit,
        amount: material.amount,
        purchasePrice: material.purchasePrice,
      });
    }
  }, [material]);

  const updateMutation = useMutation({
    mutationFn: updateRawMaterial,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["raw-materials"] });
      queryClient.invalidateQueries({ queryKey: ["raw-material", id] });
      showToast("✅ Matière première mise à jour avec succès", "success");
      setTimeout(() => router.push("/raw-materials"), 1500);
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

    if (!formData.reference) {
      showToast("La référence est requise", "error");
      setIsSubmitting(false);
      return;
    }

    if (formData.purchasePrice <= 0) {
      showToast("Le prix d'achat doit être positif", "error");
      setIsSubmitting(false);
      return;
    }

    if (formData.amount < 0) {
      showToast("La quantité ne peut pas être négative", "error");
      setIsSubmitting(false);
      return;
    }

    updateMutation.mutate({ id, data: formData });
  };

  const handleCancel = () => router.push("/raw-materials");

  if (isLoadingMaterial) {
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
        <PageBreadcrumb pageTitle="Modifier la matière première" />
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.push("/raw-materials")}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            ← Retour à la liste
          </button>
        </div>

        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
            <h3 className="text-xl font-semibold text-black dark:text-white">
              Modifier la matière première
            </h3>
          </div>

          <form onSubmit={submitForm}>
            <div className="p-6.5">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Référence */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Référence <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
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

                {/* Unité */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Unité <span className="text-danger">*</span>
                  </label>
                  <select
                    required
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  >
                    {unitOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantité */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Quantité
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
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
                    onChange={(e) => setFormData({ ...formData, purchasePrice: Number(e.target.value) })}
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
                  className="rounded-md bg-primary px-6 py-3 font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent inline-block mr-2"></div>
                      Mise à jour...
                    </>
                  ) : (
                    "Mettre à jour la matière première"
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