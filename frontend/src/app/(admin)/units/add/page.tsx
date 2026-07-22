// app/units/add/page.tsx

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import * as Toast from "@radix-ui/react-toast";

interface Unit {
  id: number;
  code: string;
  name: string;
  symbol: string;
  family: string;
  baseUnitId?: number | null;
  isActive: boolean;
  isStandard: boolean;
  conversionToBase: number;
}

const fetchUnits = async (): Promise<Unit[]> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}units`);
  if (!response.ok) throw new Error("Échec de la récupération des unités");
  return response.json();
};

const seedUnits = async () => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}units/seed`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Échec de l'initialisation des unités");
  return response.json();
};

const createUnit = async (data: any) => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}units`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Échec de la création de l'unité");
  }
  return response.json();
};

// Default families
const defaultFamilleOptions = [
  { value: "volume", label: "Volume" },
  { value: "weight", label: "Poids" },
  { value: "unit", label: "Unité" },
];

export default function AddUnitPage() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    symbol: "",
    family: "",
    baseUnitId: 0,
    conversionToBase: 1,
    description: "",
    isStandard: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [showNewFamilyInput, setShowNewFamilyInput] = useState(false);
  const [newFamily, setNewFamily] = useState("");
  const [customFamilies, setCustomFamilies] = useState<{ value: string; label: string }[]>([]);
  const [editingFamilyIndex, setEditingFamilyIndex] = useState<number | null>(null);

  const { data: units = [], refetch, isLoading } = useQuery({
    queryKey: ["units"],
    queryFn: fetchUnits,
  });

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMsg(msg);
    setToastType(type);
    setToastOpen(true);
  };

  const seedMutation = useMutation({
    mutationFn: seedUnits,
    onSuccess: () => {
      showToast("✅ Unités initialisées avec succès", "success");
      refetch();
    },
    onError: (error: Error) => {
      showToast(`❌ ${error.message || "Erreur lors de l'initialisation"}`, "error");
    },
    onSettled: () => setIsSeeding(false),
  });

  const createMutation = useMutation({
    mutationFn: createUnit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      showToast("✅ Unité créée avec succès", "success");
      setTimeout(() => router.push("/units"), 1500);
    },
    onError: (error: Error) => {
      showToast(`❌ ${error.message || "Problème de connexion"}`, "error");
    },
    onSettled: () => setIsSubmitting(false),
  });

  const handleSeed = async () => {
    setIsSeeding(true);
    seedMutation.mutate();
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    if (!formData.code) {
      showToast("Le code est requis", "error");
      setIsSubmitting(false);
      return;
    }

    if (!formData.name) {
      showToast("Le nom est requis", "error");
      setIsSubmitting(false);
      return;
    }

    if (!formData.symbol) {
      showToast("Le symbole est requis", "error");
      setIsSubmitting(false);
      return;
    }

    // Handle family - if new family was entered, use it
    let familyToUse = formData.family;
    if (showNewFamilyInput && newFamily.trim()) {
      familyToUse = newFamily.trim().toLowerCase();
    }

    if (!familyToUse) {
      showToast("La famille est requise", "error");
      setIsSubmitting(false);
      return;
    }

    if (formData.conversionToBase <= 0) {
      showToast("Le facteur de conversion doit être positif", "error");
      setIsSubmitting(false);
      return;
    }

    const submitData = {
      ...formData,
      family: familyToUse,
      baseUnitId: formData.baseUnitId || undefined,
    };

    createMutation.mutate(submitData);
  };

  const handleCancel = () => router.push("/units");

  // Get existing families from units
  const existingFamilies = units
    .map(u => u.family)
    .filter((value, index, self) => self.indexOf(value) === index)
    .sort();

  // Combine default families with existing families and custom families
  const allFamilies = [
    ...defaultFamilleOptions,
    ...existingFamilies
      .filter(f => !defaultFamilleOptions.some(d => d.value === f))
      .map(f => ({ value: f, label: f.charAt(0).toUpperCase() + f.slice(1) })),
    ...customFamilies
  ];

  // Remove duplicates
  const uniqueFamilies = allFamilies.reduce((acc, current) => {
    const exists = acc.some(item => item.value === current.value);
    if (!exists) {
      acc.push(current);
    }
    return acc;
  }, [] as { value: string; label: string }[]);

  // Filter base units (units without a baseUnitId)
  const baseUnits = units.filter((u) => !u.baseUnitId && u.id !== 0);

  // Check if we have units of a specific family
  const hasUnitsInFamily = (family: string) => {
    return units.some(u => u.family === family && !u.baseUnitId);
  };

  // Check if a family is custom (not default and not from DB)
  const isCustomFamily = (familyValue: string) => {
    return customFamilies.some(f => f.value === familyValue);
  };

  // Get custom family label
  const getCustomFamilyLabel = (familyValue: string) => {
    const found = customFamilies.find(f => f.value === familyValue);
    return found ? found.label : familyValue;
  };

  // Handle rename custom family
  const handleRenameCustomFamily = (index: number, newName: string) => {
    if (!newName.trim()) {
      showToast("Le nom de la famille ne peut pas être vide", "error");
      return;
    }

    const newValue = newName.trim().toLowerCase();
    const newLabel = newName.trim();

    // Check if the new name already exists
    const exists = uniqueFamilies.some(f => f.value === newValue);
    if (exists && customFamilies[index].value !== newValue) {
      showToast(`La famille "${newName}" existe déjà`, "error");
      return;
    }

    const updatedCustomFamilies = [...customFamilies];
    updatedCustomFamilies[index] = { value: newValue, label: newLabel };
    setCustomFamilies(updatedCustomFamilies);

    // Update form data if this family is currently selected
    if (formData.family === customFamilies[index].value) {
      setFormData({ ...formData, family: newValue });
    }

    setEditingFamilyIndex(null);
    showToast(`✅ Famille renommée en "${newLabel}"`, "success");
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </div>
    );
  }

  const hasUnits = units.length > 0;
  const selectedFamily = formData.family;

  return (
    <Toast.Provider>
      <div className="p-6">
        <PageBreadcrumb pageTitle="Ajouter une unité" />
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.push("/units")}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            ← Retour à la liste
          </button>
        </div>

        {/* Show seed button if no units exist */}
        {!hasUnits && (
          <div className="mb-6 rounded-sm border border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 p-4">
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-3">
              ⚠️ Aucune unité trouvée dans la base de données. Veuillez initialiser les unités par défaut.
            </p>
            <button
              onClick={handleSeed}
              disabled={isSeeding}
              className="rounded-md bg-yellow-600 px-4 py-2 text-white hover:bg-yellow-700 transition-colors disabled:opacity-50"
            >
              {isSeeding ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></span>
                  Initialisation...
                </>
              ) : (
                "Initialiser les unités par défaut"
              )}
            </button>
          </div>
        )}

        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
            <h3 className="text-xl font-semibold text-black dark:text-white">
              Informations de l'unité
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
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Ex: L, ml, g, kg"
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
                    placeholder="Ex: Liter, Milliliter, Gram"
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Symbole */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Symbole <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                    placeholder="Ex: L, ml, g"
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Famille */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Famille <span className="text-danger">*</span>
                  </label>

                  {!showNewFamilyInput ? (
                    <select
                      required
                      value={formData.family}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "new") {
                          setShowNewFamilyInput(true);
                          setFormData({ ...formData, family: "" });
                        } else {
                          setFormData({ ...formData, family: value });
                          // Reset editing state when selecting a different family
                          setEditingFamilyIndex(null);
                        }
                      }}
                      className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                    >
                      <option value="">Sélectionner une famille</option>
                      {uniqueFamilies.map((opt, index) => {
                        const isCustom = isCustomFamily(opt.value);
                        return (
                          <option key={opt.value} value={opt.value}>
                            {opt.label} {isCustom && "(personnalisée)"}
                          </option>
                        );
                      })}
                      <option value="new" className="text-blue-600 font-semibold">
                        + Ajouter une nouvelle famille
                      </option>
                    </select>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newFamily}
                          onChange={(e) => setNewFamily(e.target.value)}
                          placeholder="Nom de la nouvelle famille (ex: temperature)"
                          className="flex-1 w-full rounded-lg border-[1.5px] border-blue-500 bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                          autoFocus
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (newFamily.trim()) {
                              const familyValue = newFamily.trim().toLowerCase();
                              const familyLabel = newFamily.trim();

                              // Check if family already exists
                              const exists = uniqueFamilies.some(f => f.value === familyValue);
                              if (exists) {
                                showToast(`La famille "${familyLabel}" existe déjà`, "error");
                                return;
                              }

                              // Add to custom families
                              setCustomFamilies(prev => [
                                ...prev,
                                { value: familyValue, label: familyLabel }
                              ]);

                              setFormData({ ...formData, family: familyValue });
                              setShowNewFamilyInput(false);
                              setNewFamily("");
                              showToast(`✅ Famille "${familyLabel}" ajoutée`, "success");
                            } else {
                              showToast("Veuillez entrer un nom de famille", "error");
                            }
                          }}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          Confirmer
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewFamilyInput(false);
                            setNewFamily("");
                            setFormData({ ...formData, family: "" });
                          }}
                          className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}

                  {showNewFamilyInput && (
                    <p className="mt-1 text-xs text-blue-600">
                      Entrez le nom de la nouvelle famille (ex: temperature, pressure, etc.)
                    </p>
                  )}
                </div>

                {/* Custom Families Management */}
                {customFamilies.length > 0 && (
                  <div className="md:col-span-2">
                    <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                      Familles personnalisées
                    </label>
                    <div className="space-y-2">
                      {customFamilies.map((family, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          {editingFamilyIndex === index ? (
                            <div className="flex-1 flex gap-2">
                              <input
                                type="text"
                                defaultValue={family.label}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleRenameCustomFamily(index, e.currentTarget.value);
                                  }
                                }}
                                className="flex-1 px-3 py-1 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                autoFocus
                                ref={(input) => input?.focus()}
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  const input = e.currentTarget.parentElement?.querySelector('input');
                                  if (input) {
                                    handleRenameCustomFamily(index, input.value);
                                  }
                                }}
                                className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                              >
                                Valider
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingFamilyIndex(null)}
                                className="px-3 py-1 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors text-sm"
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="flex-1 text-sm text-gray-900 dark:text-white">
                                {family.label}
                              </span>
                              <span className="text-xs text-gray-500">
                                (value: {family.value})
                              </span>
                              <button
                                type="button"
                                onClick={() => setEditingFamilyIndex(index)}
                                className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded-md transition-colors text-sm"
                              >
                                ✏️ Renommer
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (formData.family === family.value) {
                                    setFormData({ ...formData, family: "" });
                                  }
                                  setCustomFamilies(prev => prev.filter((_, i) => i !== index));
                                  showToast(`✅ Famille "${family.label}" supprimée`, "success");
                                }}
                                className="px-2 py-1 text-red-600 hover:bg-red-50 rounded-md transition-colors text-sm"
                              >
                                ✕
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Les familles personnalisées apparaissent dans la liste déroulante
                    </p>
                  </div>
                )}

                {/* Unité de base */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Unité de base
                  </label>
                  <select
                    value={formData.baseUnitId}
                    onChange={(e) => setFormData({ ...formData, baseUnitId: Number(e.target.value) })}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  >
                    <option value={0}>Aucune (unité de base)</option>
                    {baseUnits
                      .filter((u) => u.family === selectedFamily)
                      .map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name} ({unit.symbol})
                        </option>
                      ))}
                  </select>
                  {selectedFamily && !hasUnitsInFamily(selectedFamily) && (
                    <p className="mt-1 text-xs text-yellow-600">
                      ⚠️ Aucune unité de base trouvée pour cette famille. Cette unité sera l'unité de base.
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Sélectionnez une unité de base si cette unité est une sous-unité
                  </p>
                </div>

                {/* Facteur de conversion */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Facteur de conversion <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={formData.conversionToBase}
                    onChange={(e) => setFormData({ ...formData, conversionToBase: Number(e.target.value) })}
                    placeholder="Ex: 1000 pour kg vers g"
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Facteur de conversion vers l'unité de base (1 pour l'unité de base)
                  </p>
                </div>

                {/* Standard */}
                {/* <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Unité standard
                  </label>
                  <div className="flex items-center gap-3 mt-2">
                    <input
                      type="checkbox"
                      checked={formData.isStandard}
                      onChange={(e) => setFormData({ ...formData, isStandard: e.target.checked })}
                      className="h-4 w-4 accent-blue-600"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Cette unité est une unité standard
                    </span>
                  </div>
                </div> */}
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
                  placeholder="Description de l'unité..."
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
                      Enregistrement...
                    </>
                  ) : (
                    "Enregistrer l'unité"
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