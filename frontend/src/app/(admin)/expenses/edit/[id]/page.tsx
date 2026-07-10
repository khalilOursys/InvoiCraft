"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import * as Toast from "@radix-ui/react-toast";
import Image from "next/image";
import { FileText, X } from "lucide-react";

interface Expense {
  id: number;
  title: string;
  amount: number;
  date: string;
  receiptImage?: string;
}

const fetchExpense = async (id: string): Promise<Expense> => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}expenses/${id}`
  );
  if (!response.ok) throw new Error("Échec de la récupération de la dépense");
  return response.json();
};

const updateExpense = async ({ id, data }: { id: string; data: FormData }) => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}expenses/${id}`,
    {
      method: "PUT",
      body: data,
    }
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Échec de la mise à jour de la dépense");
  }
  return response.json();
};

// Helper function to get full logo URL
const getUrl = (logoPath?: string): string => {
  if (!logoPath) return "";
  // If it's already a full URL, return it
  if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) {
    return logoPath;
  }
  // If it's a relative path starting with /uploads, prepend the API URL
  if (logoPath.startsWith('/uploads')) {
    return `${process.env.NEXT_PUBLIC_API_URL}${logoPath}`;
  }
  // Otherwise, assume it's just the filename and construct the full path
  return `${process.env.NEXT_PUBLIC_API_URL}uploads/expenses/${logoPath}`;
};

// Helper to check if file is PDF
const isPDFFile = (url: string): boolean => {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return lowerUrl.endsWith('.pdf') || lowerUrl.includes('.pdf?');
};

// Helper to get filename from URL
const getFileNameFromUrl = (url: string): string => {
  if (!url) return '';
  const parts = url.split('/');
  return parts[parts.length - 1];
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditExpensePage({ params }: PageProps) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(
    null
  );

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

  return <EditExpenseContent id={resolvedParams.id} />;
}

function EditExpenseContent({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [formData, setFormData] = useState({
    title: "",
    amount: "",
    date: "",
  });

  const [receiptImage, setReceiptImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImage, setExistingImage] = useState<string | null>(null);
  const [existingFileName, setExistingFileName] = useState<string>("");
  const [isExistingPDF, setIsExistingPDF] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const { data: expense, isLoading: isLoadingExpense } = useQuery({
    queryKey: ["expense", id],
    queryFn: () => fetchExpense(id),
    enabled: !!id,
  });

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMsg(msg);
    setToastType(type);
    setToastOpen(true);
  };

  useEffect(() => {
    if (expense) {
      setFormData({
        title: expense.title,
        amount: expense.amount.toString(),
        date: new Date(expense.date).toISOString().split("T")[0],
      });

      const imageUrl = getUrl(expense.receiptImage);
      console.log(imageUrl);

      setExistingImage(imageUrl);

      // Check if existing file is PDF
      const isPdf = isPDFFile(imageUrl);
      setIsExistingPDF(isPdf);

      // Get filename from URL
      if (imageUrl) {
        setExistingFileName(getFileNameFromUrl(imageUrl));
      }
    }
  }, [expense]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.match(/\/(jpg|jpeg|png|gif|pdf)$/)) {
        showToast(
          "Seuls les fichiers image (jpg, jpeg, png, gif) et PDF sont autorisés",
          "error"
        );
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast("La taille du fichier ne doit pas dépasser 5 Mo", "error");
        return;
      }
      setReceiptImage(file);

      // Check if file is PDF
      const isPdfFile = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      if (!isPdfFile) {
        // Only create image preview for non-PDF files
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        // Clear image preview for PDF
        setImagePreview(null);
      }
    }
  };

  const removeNewFile = () => {
    setReceiptImage(null);
    setImagePreview(null);
    // Reset the file input
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const removeExistingFile = () => {
    setExistingImage(null);
    setExistingFileName("");
    setIsExistingPDF(false);
    // Note: This would need a DELETE endpoint to remove the actual file from server
  };

  const updateMutation = useMutation({
    mutationFn: updateExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense", id] });
      showToast("✅ Dépense mise à jour avec succès", "success");
      setTimeout(() => router.push("/expenses"), 1500);
    },
    onError: (error: Error) => {
      showToast(`❌ ${error.message || "Problème de connexion"}`, "error");
    },
    onSettled: () => setIsSubmitting(false),
  });

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    if (!formData.title) {
      showToast("La raison est requise", "error");
      setIsSubmitting(false);
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      showToast("Le montant doit être positif", "error");
      setIsSubmitting(false);
      return;
    }

    if (!formData.date) {
      showToast("La date est requise", "error");
      setIsSubmitting(false);
      return;
    }

    const submitData = new FormData();
    submitData.append("title", formData.title);
    submitData.append("amount", formData.amount);
    submitData.append("date", formData.date);
    if (receiptImage) {
      submitData.append("receiptImage", receiptImage);
    }

    updateMutation.mutate({ id, data: submitData });
  };

  const handleCancel = () => router.push("/expenses");

  if (isLoadingExpense) {
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
        <PageBreadcrumb pageTitle="Modifier la dépense" />
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.push("/expenses")}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            ← Retour à la liste
          </button>
        </div>

        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
            <h3 className="text-xl font-semibold text-black dark:text-white">
              Modifier la dépense
            </h3>
          </div>

          <form onSubmit={submitForm}>
            <div className="p-6.5">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Raison */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Raison <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                    placeholder="Ex: Achat de fournitures"
                  />
                </div>

                {/* Montant */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Montant (DT) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    required
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                    placeholder="0.000"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Date <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>
              </div>

              {/* Justificatif (File) */}
              <div className="mt-6">
                <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                  Justificatif
                </label>
                <input
                  id="file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,application/pdf"
                  onChange={handleImageChange}
                  className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Formats acceptés : JPG, JPEG, PNG, GIF, PDF (Max : 5 Mo).
                  Laissez vide pour conserver le justificatif actuel.
                </p>

                {/* Existing file preview */}
                {existingImage && !receiptImage && (
                  <div className="mt-4">
                    {isExistingPDF ? (
                      // PDF Preview - Show only file name
                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <FileText className="w-8 h-8 text-red-500" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {existingFileName || "Document PDF"}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Document PDF existant
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={removeExistingFile}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                        >
                          <X className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    ) : (
                      // Image Preview
                      <div className="text-center relative">
                        <p className="mb-2 text-sm font-medium text-black dark:text-white">
                          Justificatif actuel :
                        </p>
                        <div className="relative w-48 h-48 mx-auto">
                          <Image
                            src={existingImage}
                            alt="Justificatif actuel"
                            fill
                            className="object-contain rounded-lg border"
                            unoptimized={true}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={removeExistingFile}
                          className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* New file preview */}
                {receiptImage && (
                  <div className="mt-4">
                    {imagePreview ? (
                      // Image Preview
                      <div className="text-center relative">
                        <p className="mb-2 text-sm font-medium text-black dark:text-white">
                          Nouvel aperçu :
                        </p>
                        <div className="relative w-48 h-48 mx-auto">
                          <Image
                            src={imagePreview}
                            alt="Nouvel aperçu"
                            fill
                            className="object-contain rounded-lg border"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={removeNewFile}
                          className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      // PDF Preview - Show only file name
                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <FileText className="w-8 h-8 text-red-500" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {receiptImage.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Document PDF
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={removeNewFile}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                        >
                          <X className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    )}
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
                  className="rounded-md bg-primary px-6 py-3 font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent inline-block mr-2"></div>
                      Mise à jour...
                    </>
                  ) : (
                    "Mettre à jour la dépense"
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