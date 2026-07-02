"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import * as Toast from "@radix-ui/react-toast";
import validator from "validator";

interface Car {
  registration: string;
  brand?: string;
  model?: string;
  year?: number;
}

const createCar = async (carData: Car): Promise<Car> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}cars`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(carData),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Erreur lors de la création du véhicule");
  }
  return response.json();
};

export default function AddCarPage() {
  const queryClient = useQueryClient();
  const router = useRouter();

  // États du formulaire
  const [registration, setRegistration] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMsg(msg);
    setToastType(type);
    setToastOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: createCar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cars"] });
      showToast("✅ Véhicule ajouté avec succès", "success");
      setTimeout(() => router.push("/cars"), 1500);
    },
    onError: (error: Error) => {
      showToast(`❌ ${error.message || "Problème de connexion"}`, "error");
    },
  });

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();

    let isValid = true;

    // Validation des champs obligatoires
    if (validator.isEmpty(registration)) {
      showToast("❌ L'immatriculation est requise", "error");
      isValid = false;
    }

    // Validation du format d'immatriculation (plaques tunisiennes)
    if (
      registration &&
      !validator.matches(
        registration,
        /^[0-9]{1,3}[-\s]?[A-Za-z]{1,3}[-\s]?[0-9]{1,4}$/
      )
    ) {
      showToast("❌ Format d'immatriculation invalide", "error");
      isValid = false;
    }

    // Validation de l'année si fournie
    if (year) {
      const yearNum = parseInt(year);
      const currentYear = new Date().getFullYear();
      if (yearNum < 1900 || yearNum > currentYear + 1) {
        showToast(`❌ L'année doit être comprise entre 1900 et ${currentYear + 1}`, "error");
        isValid = false;
      }
    }

    if (isValid) {
      const carData: Car = {
        registration: registration.toUpperCase(),
        brand: brand || undefined,
        model: model || undefined,
        year: year ? parseInt(year) : undefined,
      };
      createMutation.mutate(carData);
    }
  };

  const handleCancel = () => router.push("/cars");

  return (
    <Toast.Provider>
      <div className="p-6">
        <PageBreadcrumb pageTitle="Ajouter un nouveau véhicule" />

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
              Ajouter un nouveau véhicule
            </h3>
          </div>

          <form onSubmit={submitForm}>
            <div className="p-6.5">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Immatriculation */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Immatriculation <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={registration}
                    onChange={(e) => setRegistration(e.target.value.toUpperCase())}
                    placeholder="Ex: 123 Tunis 456"
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Format : 123 Tunis 456 ou 123TU456
                  </p>
                </div>

                {/* Marque */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Marque
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Ex: Toyota, Renault, Peugeot"
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Modèle */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Modèle
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Ex: Clio, 208, Corolla"
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Année */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Année
                  </label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="Ex: 2020"
                    min="1900"
                    max={new Date().getFullYear() + 1}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>
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
                  disabled={createMutation.isPending}
                  className="rounded-md border border-stroke px-6 py-3 font-medium hover:bg-gray-100 dark:hover:bg-meta-4 transition-colors"
                >
                  {createMutation.isPending ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent inline-block mr-2"></div>
                      Enregistrement...
                    </>
                  ) : (
                    "Enregistrer le véhicule"
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