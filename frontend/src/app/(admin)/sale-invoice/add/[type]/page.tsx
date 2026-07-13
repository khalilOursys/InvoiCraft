"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import validator from "validator";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import * as Toast from "@radix-ui/react-toast";

interface Product {
  id: number;
  name: string;
  salePrice: number;
  purchasePrice: number;
  vat: number;
}

interface Client {
  id: number;
  name: string;
  email?: string;
  phone?: string;
}

interface Service {
  id: number;
  name: string;
  reference: string;
  description?: string;
  price: number;
  isActive: boolean;
}

interface InvoiceItem {
  productId: number;
  quantity: number;
  price: number;
  total: number;
  totalTTC: number;
  vatRate: number;
}

interface SaleInvoice {
  invoiceNumber: string;
  date: string;
  type: string;
  status: string;
  clientId: number;
  items: Array<{
    productId: number;
    quantity: number;
    price: number;
    vatRate?: number;
  }>;
  totalHT: number;
  totalTTC: number;
  serviceIds?: number[];
  serviceAmounts?: { [key: number]: number };
}

// API Functions
const fetchProducts = async (): Promise<Product[]> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}products`);
  if (!response.ok) throw new Error("Failed to fetch products");
  return response.json();
};

const fetchClients = async (): Promise<Client[]> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}clients`);
  if (!response.ok) throw new Error("Failed to fetch clients");
  return response.json();
};

const fetchServices = async (): Promise<Service[]> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}services`);
  if (!response.ok) throw new Error("Failed to fetch services");
  return response.json();
};

const generateInvoiceNumber = async (type: string): Promise<string> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}sale-invoices/generate-number/${type}`);
  if (!response.ok) throw new Error("Failed to generate invoice number");
  const data = await response.json();
  return data.nextInvoiceNumber;
};

const addSaleInvoice = async (data: SaleInvoice) => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}sale-invoices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to add sale invoice");
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
    case "SALE_INVOICE":
      return "Facture de vente";
    case "DELIVERY_NOTE":
      return "Bon de livraison";
    case "SHIPPING_NOTE_INVOICE":
      return "Facture BL";
    case "QUOTATION":
      return "Devis";
    default:
      return typeValue;
  }
};

// TVA options
const VAT_OPTIONS = [
  { value: 0, label: "0%" },
  { value: 7, label: "7%" },
  { value: 10, label: "10%" },
  { value: 13, label: "13%" },
  { value: 19, label: "19%" },
  { value: 20, label: "20%" },
];

// Helper function to round to 3 decimal places
const roundTo3Decimals = (value: number): number => {
  return Math.round(value * 1000) / 1000;
};

interface PageProps {
  params: Promise<{ type: string }>;
}

export default function AddSaleInvoicePage({ params }: PageProps) {
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

  return <AddSaleInvoiceContent type={type} />;
}

function AddSaleInvoiceContent({ type }: { type: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");
  const dateString = `${year}-${month}-${day}`;

  const [date, setDate] = useState(dateString);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [clientId, setClientId] = useState<number>(0);
  const [totalHT, setTotalHT] = useState(0);
  const [totalTTC, setTotalTTC] = useState(0);
  const [status, setStatus] = useState("DRAFT");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingNumber, setIsGeneratingNumber] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);

  const [selectedServices, setSelectedServices] = useState<Service[]>([]);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: fetchClients
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services"],
    queryFn: fetchServices
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowServiceDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const autoGenerateNumber = async () => {
      setIsGeneratingNumber(true);
      try {
        const generatedNumber = await generateInvoiceNumber(type);
        setInvoiceNumber(generatedNumber);
      } catch (error) {
        console.error("Failed to generate invoice number:", error);
        showToast("❌ Erreur lors de la génération du numéro de facture", "error");
      } finally {
        setIsGeneratingNumber(false);
      }
    };

    autoGenerateNumber();
  }, [type]);

  const calculateServiceTotal = useCallback(() => {
    return selectedServices.reduce((sum, service) => sum + service.price, 0);
  }, [selectedServices]);

  const calculateTotals = useCallback(() => {
    let ht = invoiceItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0,
    );
    ht += calculateServiceTotal();

    const ttc = invoiceItems.reduce(
      (total, item) => total + item.totalTTC,
      0
    ) + (calculateServiceTotal() * 1.19);

    setTotalHT(roundTo3Decimals(ht));
    setTotalTTC(roundTo3Decimals(ttc));
  }, [invoiceItems, calculateServiceTotal]);

  useEffect(() => {
    calculateTotals();
  }, [calculateTotals]);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMsg(msg);
    setToastType(type);
    setToastOpen(true);
  };

  const addMutation = useMutation({
    mutationFn: addSaleInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saleInvoices"] });
      showToast("✅ Facture de vente ajoutée avec succès", "success");
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
          updatedItem.price = selectedProduct ? roundTo3Decimals(selectedProduct.salePrice) : 0;
          updatedItem.vatRate = selectedProduct?.vat || 19;
          updatedItem.total = roundTo3Decimals(updatedItem.price * updatedItem.quantity);
          updatedItem.totalTTC = roundTo3Decimals(
            updatedItem.price * updatedItem.quantity * (1 + updatedItem.vatRate / 100)
          );
        } else if (field === "quantity") {
          updatedItem.total = roundTo3Decimals(updatedItem.price * updatedItem.quantity);
          updatedItem.totalTTC = roundTo3Decimals(
            updatedItem.price * updatedItem.quantity * (1 + updatedItem.vatRate / 100)
          );
        } else if (field === "price") {
          const price = typeof value === 'number' ? value : 0;
          updatedItem.price = roundTo3Decimals(price);
          updatedItem.total = roundTo3Decimals(updatedItem.price * updatedItem.quantity);
          updatedItem.totalTTC = roundTo3Decimals(
            updatedItem.price * updatedItem.quantity * (1 + updatedItem.vatRate / 100)
          );
        } else if (field === "totalTTC") {
          const newTotalTTC = typeof value === 'number' ? value : 0;
          updatedItem.totalTTC = roundTo3Decimals(newTotalTTC);
          if (updatedItem.quantity > 0) {
            updatedItem.price = roundTo3Decimals(newTotalTTC / (updatedItem.quantity * (1 + updatedItem.vatRate / 100)));
            updatedItem.total = roundTo3Decimals(updatedItem.price * updatedItem.quantity);
          }
        } else if (field === "vatRate") {
          const vatRate = typeof value === 'number' ? value : 19;
          updatedItem.vatRate = vatRate;
          updatedItem.totalTTC = roundTo3Decimals(
            updatedItem.price * updatedItem.quantity * (1 + vatRate / 100)
          );
        }

        return updatedItem;
      }
      return item;
    });
    setInvoiceItems(newItems);
  };

  const handleAddItem = () => {
    setInvoiceItems([
      ...invoiceItems,
      { productId: 0, quantity: 1, price: 0, total: 0, totalTTC: 0, vatRate: 19 },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = invoiceItems.filter((_, i) => i !== index);
    setInvoiceItems(newItems);
  };

  const handleAddService = (service: Service) => {
    if (!selectedServices.find(s => s.id === service.id)) {
      setSelectedServices([...selectedServices, service]);
      setShowServiceDropdown(false);
      showToast(`✅ Service "${service.name}" ajouté`, "success");
    } else {
      showToast(`⚠️ Service déjà sélectionné`, "error");
    }
  };

  const handleRemoveService = (serviceId: number) => {
    const service = selectedServices.find(s => s.id === serviceId);
    setSelectedServices(selectedServices.filter(s => s.id !== serviceId));
    if (service) {
      showToast(`🗑️ Service "${service.name}" supprimé`, "success");
    }
  };

  const handleToggleDropdown = () => {
    setShowServiceDropdown(!showServiceDropdown);
  };

  const redirectToTypeList = () => {
    router.push("/sale-invoice/list/" + type);
  };

  const regenerateInvoiceNumber = async () => {
    setIsGeneratingNumber(true);
    try {
      const generatedNumber = await generateInvoiceNumber(type);
      setInvoiceNumber(generatedNumber);
      showToast("✅ Numéro de facture régénéré avec succès", "success");
    } catch (error) {
      showToast("❌ Erreur lors de la régénération du numéro", "error");
    } finally {
      setIsGeneratingNumber(false);
    }
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    if (validator.isEmpty(invoiceNumber)) {
      showToast("Numéro de facture est obligatoire", "error");
      setIsSubmitting(false);
      return;
    }
    if (!clientId) {
      showToast("Client est obligatoire", "error");
      setIsSubmitting(false);
      return;
    }
    if (invoiceItems.length === 0) {
      showToast("Au moins un article est obligatoire", "error");
      setIsSubmitting(false);
      return;
    }

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
      price: roundTo3Decimals(item.price),
      vatRate: item.vatRate,
    }));

    const serviceAmounts: { [key: number]: number } = {};
    selectedServices.forEach(service => {
      serviceAmounts[service.id] = service.price;
    });

    const invoiceData: SaleInvoice = {
      invoiceNumber,
      date,
      type,
      status,
      clientId,
      items,
      totalHT: roundTo3Decimals(totalHT),
      totalTTC: roundTo3Decimals(totalTTC),
      serviceIds: selectedServices.map(s => s.id),
      serviceAmounts: serviceAmounts,
    };

    addMutation.mutate(invoiceData);
  };

  const handleCancel = () => redirectToTypeList();

  const getPageTitle = () => {
    switch (type) {
      case "DELIVERY_NOTE":
        return "Ajouter Bon de Livraison";
      case "SHIPPING_NOTE_INVOICE":
        return "Ajouter Facture BL";
      default:
        return "Ajouter Facture de Vente";
    }
  };

  const availableServices = services.filter(
    s => !selectedServices.find(selected => selected.id === s.id)
  );

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
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Numéro <span className="text-danger">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={invoiceNumber}
                      placeholder="Ex: FAC-2023-001"
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      disabled={isGeneratingNumber}
                      className="flex-1 rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={regenerateInvoiceNumber}
                      disabled={isGeneratingNumber}
                      className="rounded-md bg-gray-600 px-4 py-2 text-white hover:bg-gray-700 transition-colors flex items-center gap-2"
                      title="Générer un nouveau numéro"
                    >
                      {isGeneratingNumber ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

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

                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Client <span className="text-danger">*</span>
                  </label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(Number(e.target.value))}
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  >
                    <option value={0}>Sélectionner un client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>

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
                        <th className="border-b p-4 text-left">Qté</th>
                        <th className="border-b p-4 text-left">Prix unitaire (TND)</th>
                        <th className="border-b p-4 text-left">TVA</th>
                        <th className="border-b p-4 text-left">Total HT (TND)</th>
                        <th className="border-b p-4 text-left">Total TTC (TND)</th>
                        <th className="border-b p-4 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceItems.map((item, index) => (
                        <tr key={index} className="border-b">
                          <td className="p-4">
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
                              step="0.001"
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
                          <td className="p-4">
                            <select
                              value={item.vatRate}
                              onChange={(e) =>
                                handleItemChange(index, "vatRate", Number(e.target.value))
                              }
                              className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-3 py-2 outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                            >
                              {VAT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-4">{item.total.toFixed(3)}</td>
                          <td className="p-4">
                            <input
                              type="number"
                              step="0.001"
                              value={item.totalTTC}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  "totalTTC",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-3 py-2 outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input"
                            />
                          </td>
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

              <div className="mt-6">
                <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                  Services <span className="text-xs text-gray-500">(optionnel)</span>
                </label>

                <div className="min-h-[42px] rounded-lg border-[1.5px] border-stroke bg-transparent px-3 py-2 dark:border-form-strokedark dark:bg-form-input">
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedServices.map((service) => (
                      <span
                        key={service.id}
                        className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                      >
                        {service.name} ({service.price.toFixed(3)} TND)
                        <button
                          type="button"
                          onClick={() => handleRemoveService(service.id)}
                          className="ml-1 text-blue-600 hover:text-red-600 dark:text-blue-400 dark:hover:text-red-400"
                        >
                          ×
                        </button>
                      </span>
                    ))}

                    <div className="relative" ref={dropdownRef}>
                      <button
                        type="button"
                        onClick={handleToggleDropdown}
                        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        + Ajouter un service
                      </button>

                      {showServiceDropdown && (
                        <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-64 overflow-y-auto rounded-lg border border-stroke bg-white shadow-lg dark:border-strokedark dark:bg-boxdark">
                          {availableServices.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                              Tous les services sont sélectionnés
                            </div>
                          ) : (
                            availableServices.map((service) => (
                              <button
                                key={service.id}
                                type="button"
                                onClick={() => handleAddService(service)}
                                className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-meta-4"
                              >
                                <span>{service.name}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {service.price.toFixed(3)} TND
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <small className="text-muted mt-1 block text-sm">
                  Sélectionnez les services à ajouter à la facture
                </small>

                {selectedServices.length > 0 && (
                  <div className="mt-2 bg-gray-50 dark:bg-meta-4 rounded-lg p-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Total services:</span>
                      <span className="font-bold text-primary">
                        {calculateServiceTotal().toFixed(3)} TND
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Total HT (TND)
                  </label>
                  <input
                    type="text"
                    value={totalHT.toFixed(3)}
                    readOnly
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-gray-100 px-5 py-3 outline-none dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    TVA (TND)
                  </label>
                  <input
                    type="text"
                    value={(totalTTC - totalHT).toFixed(3)}
                    readOnly
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-gray-100 px-5 py-3 outline-none dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                    Total TTC (TND)
                  </label>
                  <input
                    type="text"
                    value={totalTTC.toFixed(3)}
                    readOnly
                    className="w-full rounded-lg border-[1.5px] border-stroke bg-gray-100 px-5 py-3 outline-none dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  />
                </div>
              </div>

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