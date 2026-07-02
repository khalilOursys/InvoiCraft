"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import * as Toast from "@radix-ui/react-toast";

interface Supplier {
  id: number;
  code: string;
  name: string;
  taxNumber?: string;
  phone?: string;
  address?: string;
  bankRib?: string;
  email?: string;
  cityId?: number;
}

const fetchSupplier = async (id: string): Promise<Supplier> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}suppliers/${id}`);
  if (!response.ok) throw new Error("Erreur lors du chargement du fournisseur");
  return response.json();
};

const updateSupplier = async ({ id, data }: { id: string; data: Partial<Supplier> }) => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}suppliers/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Erreur lors de la mise à jour du fournisseur");
  }

  return response.json();
};

export default function EditSupplierPage() {
  const params = useParams();
  const id = params.id as string;

  const queryClient = useQueryClient();
  const router = useRouter();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [bankRib, setBankRib] = useState("");
  const [email, setEmail] = useState("");
  const [cityId, setCityId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const { data: supplier, isLoading: isLoadingSupplier } = useQuery({
    queryKey: ["supplier", id],
    queryFn: () => fetchSupplier(id),
    enabled: !!id,
  });

  useEffect(() => {
    if (supplier) {
      setCode(supplier.code);
      setName(supplier.name);
      setTaxNumber(supplier.taxNumber || "");
      setPhone(supplier.phone || "");
      setAddress(supplier.address || "");
      setBankRib(supplier.bankRib || "");
      setEmail(supplier.email || "");
      setCityId(supplier.cityId?.toString() || "");
    }
  }, [supplier]);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMsg(msg);
    setToastType(type);
    setToastOpen(true);
  };

  const updateMutation = useMutation({
    mutationFn: updateSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["supplier", id] });
      showToast("✅ Fournisseur modifié avec succès", "success");
      setTimeout(() => router.push("/suppliers"), 1500);
    },
    onError: (error: Error) => {
      showToast(`❌ ${error.message || "Problème de connexion"}`, "error");
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!code) {
      showToast("Le code est requis", "error");
      return;
    }

    if (!name) {
      showToast("Le nom est requis", "error");
      return;
    }

    setIsSubmitting(true);

    const updateData: Partial<Supplier> = {
      code,
      name,
      taxNumber: taxNumber || undefined,
      phone: phone || undefined,
      address: address || undefined,
      bankRib: bankRib || undefined,
      email: email || undefined,
      cityId: cityId ? parseInt(cityId) : undefined,
    };

    updateMutation.mutate({ id, data: updateData });
  };

  const handleCancel = () => router.push("/suppliers");

  if (isLoadingSupplier) {
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
        <PageBreadcrumb pageTitle="Modifier le fournisseur" />

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
              Modifier le fournisseur
            </h3>
          </div>

          <form onSubmit={submitForm}>
            <div className="p-6.5">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Code */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Code <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="FRS-001"
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
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nom du fournisseur"
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Numéro fiscal */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Numéro fiscal
                  </label>
                  <input
                    type="text"
                    value={taxNumber}
                    onChange={(e) => setTaxNumber(e.target.value)}
                    placeholder="1234567X"
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Téléphone */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+216 XX XXX XXX"
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="fournisseur@exemple.com"
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* RIB Bancaire */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    RIB Bancaire
                  </label>
                  <input
                    type="text"
                    value={bankRib}
                    onChange={(e) => setBankRib(e.target.value)}
                    placeholder="Numéro de compte bancaire"
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>
              </div>

              {/* Adresse - Pleine largeur */}
              <div className="mt-6">
                <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                  Adresse
                </label>
                <textarea
                  rows={3}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Adresse complète"
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
                  className="rounded-md border border-stroke px-6 py-3 font-medium hover:bg-gray-100 dark:hover:bg-meta-4 transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent inline-block mr-2"></div>
                      Mise à jour...
                    </>
                  ) : (
                    "Mettre à jour le fournisseur"
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Notifications Toast */}
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