"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import validator from "validator";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import * as Toast from "@radix-ui/react-toast";

interface Product {
  id: number;
  name: string;
  salePrice: number;
  purchasePrice: number;
}

interface Supplier {
  id: number;
  name: string;
  email?: string;
  phone?: string;
}

interface InvoiceItem {
  productId: number;
  quantity: number;
  price: number;
  total: number;
}

interface PurchaseInvoice {
  invoiceNumber: string;
  date: string;
  type: string;
  status: string;
  supplierId: number;
  items: Array<{
    productId: number;
    quantity: number;
    price: number;
  }>;
  totalHT: number;
  totalTTC: number;
}

// API Functions
const fetchProducts = async (): Promise<Product[]> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}products`);
  if (!response.ok) throw new Error("Failed to fetch products");
  return response.json();
};

const fetchSuppliers = async (): Promise<Supplier[]> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}suppliers`);
  if (!response.ok) throw new Error("Failed to fetch suppliers");
  return response.json();
};

const addPurchaseInvoice = async (data: PurchaseInvoice) => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}purchase-invoices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to add purchase invoice");
  }
  return response.json();
};

const statusOptions = [
  { value: "DRAFT", label: "Brouillon" },
  { value: "VALIDATED", label: "Validée" },
  { value: "PAID", label: "Payée" },
  { value: "CANCELLED", label: "Annulée" },
];

const getTypeLabel = (typeValue: string) => {
  switch (typeValue) {
    case "PURCHASE_ORDER":
      return "Bon de commande";
    case "PURCHASE_INVOICE":
      return "Facture achat";
    case "PURCHASE_REFUND":
      return "Avoir fournisseur";
    default:
      return typeValue;
  }
};

interface PageProps {
  params: Promise<{ type: string }>;
}

export default function AddPurchaseInvoicePage({ params }: PageProps) {
  const [resolvedParams, setResolvedParams] = useState<{ type: string } | null>(null);

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

  let type = resolvedParams.type;

  return <AddPurchaseInvoiceContent type={type} />;
}

function AddPurchaseInvoiceContent({ type }: { type: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");
  const dateString = `${year}-${month}-${day}`;

  const [date, setDate] = useState(dateString);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [supplierId, setSupplierId] = useState<number>(0);
  const [totalHT, setTotalHT] = useState(0);
  const [totalTTC, setTotalTTC] = useState(0);
  const [status, setStatus] = useState("DRAFT");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: fetchSuppliers
  });

  const calculateTotals = useCallback(() => {
    let ht = invoiceItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0,
    );
    const ttc = ht * 1.19;
    setTotalHT(ht);
    setTotalTTC(ttc);
  }, [invoiceItems]);

  useEffect(() => {
    calculateTotals();
  }, [calculateTotals]);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMsg(msg);
    setToastType(type);
    setToastOpen(true);
  };

  const addMutation = useMutation({
    mutationFn: addPurchaseInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchaseInvoices"] });
      showToast("✅ Facture d'achat ajoutée avec succès", "success");
      setTimeout(() => redirectToTypeList(), 1500);
    },
    onError: (error: Error) => {
      showToast(`❌ ${error.message || "Erreur lors de l'enregistrement"}`, "error");
    },
    onSettled: () => setIsSubmitting(false),
  });

  const handleItemChange = (index: number, field: string, value: number | string) => {
    const newItems = invoiceItems.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, [field]: value };

        if (field === "productId") {
          const selectedProduct = products.find((p) => p.id === value);
          updatedItem.price = selectedProduct ? selectedProduct.salePrice : 0;
        }

        updatedItem.total = updatedItem.price * updatedItem.quantity;
        return updatedItem;
      }
      return item;
    });
    setInvoiceItems(newItems);
  };

  const handleAddItem = () => {
    setInvoiceItems([
      ...invoiceItems,
      { productId: 0, quantity: 1, price: 0, total: 0 },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = invoiceItems.filter((_, i) => i !== index);
    setInvoiceItems(newItems);
  };

  const redirectToTypeList = () => {
    router.push("/purchase-invoice/list/" + type);
    /* if (type === "PURCHASE_ORDER") {
      router.push("/purchase-invoice/list/purchase-order");
    } else if (type === "PURCHASE_REFUND") {
      router.push("/purchase-invoice/list/purchase-refund");
    } else {
      router.push("/purchase-invoice/list/purchase-invoice");
    } */
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    if (validator.isEmpty(invoiceNumber)) {
      showToast("Numéro de facture est obligatoire", "error");
      setIsSubmitting(false);
      return;
    }
    if (!supplierId) {
      showToast("Fournisseur est obligatoire", "error");
      setIsSubmitting(false);
      return;
    }
    if (invoiceItems.length === 0) {
      showToast("Au moins un article est obligatoire", "error");
      setIsSubmitting(false);
      return;
    }

    // Validate each item has a product selected
    for (const item of invoiceItems) {
      if (!item.productId) {
        showToast("Veuillez sélectionner un produit pour chaque article", "error");
        setIsSubmitting(false);
        return;
      }
      if (item.quantity <= 0) {
        showToast("La quantité doit être supérieure à 0", "error");
        setIsSubmitting(false);
        return;
      }
    }

    const items = invoiceItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      price: item.price,
    }));

    const invoiceData: PurchaseInvoice = {
      invoiceNumber,
      date,
      type,
      status,
      supplierId,
      items,
      totalHT,
      totalTTC,
    };

    addMutation.mutate(invoiceData);
  };

  const handleCancel = () => redirectToTypeList();

  // Get page title based on type
  const getPageTitle = () => {
    switch (type) {
      case "PURCHASE_ORDER":
        return "Ajouter Bon de Commande";
      case "PURCHASE_REFUND":
        return "Ajouter Avoir Fournisseur";
      default:
        return "Ajouter Facture d'Achat";
    }
  };

  return (
    <Toast.Provider>
      <div className="p-6">
        <PageBreadcrumb pageTitle={getPageTitle()} />
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={redirectToTypeList}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            ← Retour à la liste
          </button>
        </div>

        <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
            <h3 className="text-xl font-semibold text-black dark:text-white">
              {getPageTitle()}
            </h3>
          </div>

          <form onSubmit={submitForm}>
            <div className="p-6.5">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Numéro de facture */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Numéro <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    placeholder="Ex: FAC-2023-001"
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Date <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Type (readonly) */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Type <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={getTypeLabel(type)}
                    readOnly
                    disabled
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-gray-100 px-5 py-3 outline-none dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>

                {/* Fournisseur - Native Select */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Fournisseur <span className="text-danger">*</span>
                  </label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(Number(e.target.value))}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  >
                    <option value={0}>Sélectionner un fournisseur</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Statut - Native Select */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Statut
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Articles Table */}
              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700 transition-colors flex items-center gap-2 mb-4"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Ajouter un article
                </button>

                <div className="overflow-x-auto">
                  <table className="w-full table-auto border-collapse">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-800">
                        <th className="border-b p-4 text-left">Produit</th>
                        <th className="border-b p-4 text-left">Quantité</th>
                        <th className="border-b p-4 text-left">Prix unitaire (€)</th>
                        <th className="border-b p-4 text-left">Total (€)</th>
                        <th className="border-b p-4 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceItems.map((item, index) => (
                        <tr key={index} className="border-b">
                          <td className="p-4">
                            {/* Product Select - Native HTML */}
                            <select
                              value={item.productId}
                              onChange={(e) =>
                                handleItemChange(index, "productId", Number(e.target.value))
                              }
                              className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-3 py-2 outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                            >
                              <option value={0}>Sélectionner un produit</option>
                              {products.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-4">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  "quantity",
                                  parseInt(e.target.value) || 0
                                )
                              }
                              className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-3 py-2 outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input"
                            />
                          </td>
                          <td className="p-4">
                            <input
                              type="number"
                              step="0.01"
                              value={item.price}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  "price",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-3 py-2 outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input"
                            />
                          </td>
                          <td className="p-4">{item.total.toFixed(2)}</td>
                          <td className="p-4">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="rounded-md bg-red-600 px-3 py-1 text-white hover:bg-red-700 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Total HT (€)
                  </label>
                  <input
                    type="text"
                    value={totalHT.toFixed(2)}
                    readOnly
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-gray-100 px-5 py-3 outline-none dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    TVA (19%) (€)
                  </label>
                  <input
                    type="text"
                    value={(totalTTC - totalHT).toFixed(2)}
                    readOnly
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-gray-100 px-5 py-3 outline-none dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Total TTC (€)
                  </label>
                  <input
                    type="text"
                    value={totalTTC.toFixed(2)}
                    readOnly
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-gray-100 px-5 py-3 outline-none dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
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
                  className="rounded-md border border-stroke px-6 py-3 font-medium hover:bg-gray-100 dark:hover:bg-meta-4 transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent inline-block mr-2"></div>
                      Enregistrement...
                    </>
                  ) : (
                    "Enregistrer"
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