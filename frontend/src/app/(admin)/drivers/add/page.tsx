"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import Select from "react-select";
import validator from "validator";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import * as Toast from "@radix-ui/react-toast";

interface Car {
  id: number;
  registration: string;
  brand?: string;
  model?: string;
}

interface Driver {
  id?: number;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  cin?: string | null;
  licenseNumber?: string | null;
  active: boolean;
  carId?: number | null;
}

const fetchCars = async (): Promise<Car[]> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}cars`);
  if (!response.ok) throw new Error("Erreur lors du chargement des véhicules");
  return response.json();
};

const createDriver = async (driverData: Driver): Promise<Driver> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}driver`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(driverData),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Erreur lors de la création du chauffeur");
  }
  return response.json();
};

export default function AjouterDriver() {
  const queryClient = useQueryClient();
  const router = useRouter();

  // États du formulaire
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [cin, setCin] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [active, setActive] = useState(true);
  const [selectedCar, setSelectedCar] = useState<{ value: number; label: string } | null>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  // Chargement des véhicules pour le menu déroulant
  const { data: cars = [], isLoading: isLoadingCars } = useQuery({
    queryKey: ["cars"],
    queryFn: fetchCars,
  });

  const carOptions = cars.map((car) => ({
    value: car.id,
    label: `${car.brand || ""} ${car.model || ""} - ${car.registration}`.trim(),
  }));

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMsg(msg);
    setToastType(type);
    setToastOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: createDriver,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      showToast("✅ Chauffeur ajouté avec succès", "success");
      setTimeout(() => router.push("/drivers"), 1500);
    },
    onError: (error: Error) => {
      let errorMessage = error.message || "Problème de connexion";

      // Vérification des erreurs spécifiques aux champs
      if (errorMessage.toLowerCase().includes("cin")) {
        showToast(`❌ ${errorMessage}`, "error");
      } else if (errorMessage.toLowerCase().includes("email")) {
        showToast(`❌ ${errorMessage}`, "error");
      } else if (errorMessage.toLowerCase().includes("permis") || errorMessage.toLowerCase().includes("license")) {
        showToast(`❌ ${errorMessage}`, "error");
      } else {
        showToast(`❌ ${errorMessage}`, "error");
      }
    },
  });

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();

    let isValid = true;

    // Validation des champs obligatoires
    if (validator.isEmpty(firstName)) {
      showToast("❌ Le prénom est requis", "error");
      isValid = false;
    }

    if (validator.isEmpty(lastName)) {
      showToast("❌ Le nom est requis", "error");
      isValid = false;
    }

    // Validation du format email si fourni
    if (email && !validator.isEmail(email)) {
      showToast("❌ Format d'email invalide", "error");
      isValid = false;
    }

    // Validation du format CIN
    if (cin) {
      if (!validator.isLength(cin, { min: 8, max: 12 })) {
        showToast("❌ Le CIN doit contenir entre 8 et 12 caractères", "error");
        isValid = false;
      }
      if (!validator.matches(cin, /^[A-Z0-9]+$/)) {
        showToast("❌ Le CIN ne peut contenir que des lettres majuscules et des chiffres", "error");
        isValid = false;
      }
    }

    // Validation du téléphone si fourni
    if (phone && !validator.isMobilePhone(phone, "any")) {
      showToast("❌ Format de téléphone invalide", "error");
      isValid = false;
    }

    // Validation du numéro de permis si fourni
    if (licenseNumber && !validator.isLength(licenseNumber, { min: 5 })) {
      showToast("❌ Le numéro de permis doit contenir au moins 5 caractères", "error");
      isValid = false;
    }

    if (isValid) {
      const driverData: Driver = {
        firstName,
        lastName,
        phone: phone || null,
        email: email || null,
        cin: cin || null,
        licenseNumber: licenseNumber || null,
        active,
        carId: selectedCar?.value || null,
      };

      createMutation.mutate(driverData);
    }
  };

  const handleCancel = () => router.push("/drivers");

  return (
    <Toast.Provider>
      <div className="p-6">
        <PageBreadcrumb pageTitle="Ajouter un chauffeur" />

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
              Ajouter un chauffeur
            </h3>
          </div>

          <form onSubmit={submitForm}>
            <div className="p-6.5">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Prénom */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Prénom <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Prénom"
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
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Nom"
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
                    placeholder="Numéro de téléphone"
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
                    placeholder="Adresse email"
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Utilisé comme identifiant de connexion
                  </p>
                </div>

                {/* CIN */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    CIN
                  </label>
                  <input
                    type="text"
                    value={cin}
                    onChange={(e) => setCin(e.target.value.toUpperCase())}
                    placeholder="Carte d'identité nationale"
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Utilisé comme mot de passe initial
                  </p>
                </div>

                {/* Numéro de permis */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Numéro de permis
                  </label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="Numéro de permis de conduire"
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Véhicule assigné */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Véhicule assigné
                  </label>
                  <Select
                    placeholder="Sélectionner un véhicule"
                    value={selectedCar}
                    isClearable
                    isLoading={isLoadingCars}
                    onChange={(value) => setSelectedCar(value)}
                    options={carOptions}
                    noOptionsMessage={() => "Aucun véhicule disponible"}
                    className="react-select-container"
                    classNamePrefix="react-select"
                    theme={(theme) => ({
                      ...theme,
                      colors: {
                        ...theme.colors,
                        primary: "#3b82f6",
                        primary75: "#60a5fa",
                        primary50: "#93c5fd",
                        primary25: "#bfdbfe",
                      },
                    })}
                  />
                </div>

                {/* Statut */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Statut
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                      {active ? "Actif" : "Inactif"}
                    </span>
                  </label>
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
                    "Enregistrer le chauffeur"
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