// app/units/edit/[id]/page.tsx

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import * as Toast from "@radix-ui/react-toast";

interface Unit {
  id: number;
  code: string;
  name: string;
  symbol: string;
  description?: string;
  family: string;
  baseUnitId?: number | null;
  baseUnit?: {
    id: number;
    code: string;
    name: string;
    symbol: string;
  };
  conversionToBase: number;
  isStandard: boolean;
  isActive: boolean;
}

const fetchUnits = async (): Promise<Unit[]> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}units`);
  if (!response.ok) throw new Error("Échec de la récupération des unités");
  return response.json();
};

const fetchUnit = async (id: string): Promise<Unit> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}units/${id}`);
  if (!response.ok) throw new Error("Échec de la récupération de l'unité");
  return response.json();
};

const updateUnit = async ({ id, data }: { id: string; data: any }) => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}units/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Échec de la mise à jour de l'unité");
  }
  return response.json();
};

// Default families
const defaultFamilleOptions = [
  { value: "volume", label: "Volume" },
  { value: "weight", label: "Poids" },
  { value: "unit", label: "Unité" },
];

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditUnitPage({ params }: PageProps) {
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

  return <EditUnitContent id={resolvedParams.id} />;
}

function EditUnitContent({ id }: { id: string }) {
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
    isStandard: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [showNewFamilyInput, setShowNewFamilyInput] = useState(false);
  const [newFamily, setNewFamily] = useState("");
  const [customFamilies, setCustomFamilies] = useState<{ value: string; label: string }[]>([]);
  const [isEditingFamily, setIsEditingFamily] = useState(false);

  const { data: units = [] } = useQuery({
    queryKey: ["units"],
    queryFn: fetchUnits,
  });

  const { data: unit, isLoading: isLoadingUnit } = useQuery({
    queryKey: ["unit", id],
    queryFn: () => fetchUnit(id),
    enabled: !!id,
  });

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMsg(msg);
    setToastType(type);
    setToastOpen(true);
  };

  useEffect(() => {
    if (unit) {
      setFormData({
        code: unit.code || "",
        name: unit.name || "",
        symbol: unit.symbol || "",
        family: unit.family || "",
        baseUnitId: unit.baseUnitId || 0,
        conversionToBase: unit.conversionToBase || 1,
        description: unit.description || "",
        isStandard: unit.isStandard || false,
      });
    }
  }, [unit]);

  const updateMutation = useMutation({
    mutationFn: updateUnit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      queryClient.invalidateQueries({ queryKey: ["unit", id] });
      showToast("✅ Unité mise à jour avec succès", "success");
      setTimeout(() => router.push("/units"), 1500);
    },
    onError: (error: Error) => {
      showToast(`❌ ${error.message || "Problème de connexion"}`, "error");
    },
    onSettled: () => setIsSubmitting(false),
  });

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

    // Handle family - if editing family, use the new family name
    let familyToUse = formData.family;
    if (isEditingFamily && newFamily.trim()) {
      familyToUse = newFamily.trim().toLowerCase();
    } else if (showNewFamilyInput && newFamily.trim()) {
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

    updateMutation.mutate({ id, data: submitData });
  };

  const handleCancel = () => router.push("/units");

  if (isLoadingUnit) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </div>
    );
  }

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

  // Filter base units (units without a baseUnitId) excluding the current unit
  const baseUnits = units.filter((u) => !u.baseUnitId && u.id !== parseInt(id));

  // Check if we have units of a specific family
  const hasUnitsInFamily = (family: string) => {
    return units.some(u => u.family === family && !u.baseUnitId && u.id !== parseInt(id));
  };

  const selectedFamily = formData.family;

  // Get current family label
  const getCurrentFamilyLabel = () => {
    const found = uniqueFamilies.find(f => f.value === unit?.family);
    return found ? found.label : unit?.family || "";
  };

  return (
    <Toast.Provider>
      <div className="p-6">
        <PageBreadcrumb pageTitle="Modifier l'unité" />
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.push("/units")}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            ← Retour à la liste
          </button>
        </div>

        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
            <h3 className="text-xl font-semibold text-black dark:text-white">
              Modifier l'unité
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
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Famille */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Famille <span className="text-danger">*</span>
                  </label>

                  {!showNewFamilyInput && !isEditingFamily ? (
                    <div className="flex gap-2">
                      <select
                        required
                        value={formData.family}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "new") {
                            setShowNewFamilyInput(true);
                            setFormData({ ...formData, family: "" });
                          } else if (value === "edit") {
                            setIsEditingFamily(true);
                            setNewFamily(formData.family);
                          } else {
                            setFormData({ ...formData, family: value });
                          }
                        }}
                        className="flex-1 w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                      >
                        <option value="">Sélectionner une famille</option>
                        {uniqueFamilies.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                        <option value="edit" className="text-orange-600 font-semibold">
                          ✏️ Renommer la famille actuelle
                        </option>
                        <option value="new" className="text-blue-600 font-semibold">
                          + Ajouter une nouvelle famille
                        </option>
                      </select>
                    </div>
                  ) : showNewFamilyInput ? (
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
                            setFormData({ ...formData, family: unit?.family || "" });
                          }}
                          className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : isEditingFamily ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newFamily}
                          onChange={(e) => setNewFamily(e.target.value)}
                          placeholder="Nouveau nom pour la famille"
                          className="flex-1 w-full rounded-lg border-[1.5px] border-orange-500 bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
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

                              // Update the family name
                              setCustomFamilies(prev => {
                                // Remove old family if it exists in custom
                                const filtered = prev.filter(f => f.value !== formData.family);
                                return [...filtered, { value: familyValue, label: familyLabel }];
                              });

                              setFormData({ ...formData, family: familyValue });
                              setIsEditingFamily(false);
                              setNewFamily("");
                              showToast(`✅ Famille renommée en "${familyLabel}"`, "success");
                            } else {
                              showToast("Veuillez entrer un nom de famille", "error");
                            }
                          }}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                        >
                          Renommer
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingFamily(false);
                            setNewFamily("");
                            setFormData({ ...formData, family: unit?.family || "" });
                          }}
                          className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                        >
                          Annuler
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-orange-600">
                        ⚠️ Cela renommera la famille "{unit?.family}" en "{newFamily || '...'}"
                      </p>
                    </div>
                  ) : null}

                  {showNewFamilyInput && (
                    <p className="mt-1 text-xs text-blue-600">
                      Entrez le nom de la nouvelle famille (ex: temperature, pressure, etc.)
                    </p>
                  )}
                  {isEditingFamily && (
                    <p className="mt-1 text-xs text-orange-600">
                      Renommez la famille actuelle "{unit?.family}" en un nouveau nom
                    </p>
                  )}
                </div>

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
                  {unit?.baseUnit && (
                    <p className="mt-1 text-xs text-blue-600">
                      Actuel: {unit.baseUnit.name} ({unit.baseUnit.symbol})
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
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
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
                    "Mettre à jour l'unité"
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