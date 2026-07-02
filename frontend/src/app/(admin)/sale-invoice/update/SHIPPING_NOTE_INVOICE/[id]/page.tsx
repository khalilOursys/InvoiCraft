"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Select from "react-select";
import validator from "validator";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import * as Toast from "@radix-ui/react-toast";
import { useInvoiceData } from "@/hooks/useInvoiceData";

const updateSaleInvoice = async ({ id, data }: { id: string; data: any }) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}sale-invoices/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update shipping note invoice");
    }
    return response.json();
};

const fetchSaleInvoice = async (id: string) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}sale-invoices/${id}`);
    if (!response.ok) throw new Error("Failed to fetch invoice");
    return response.json();
};

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function UpdateShippingNoteInvoicePage({ params }: PageProps) {
    const [resolvedParams, setResolvedParams] = React.useState<{ id: string } | null>(null);

    React.useEffect(() => {
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

    return <UpdateShippingNoteInvoiceContent id={resolvedParams.id} />;
}

function UpdateShippingNoteInvoiceContent({ id }: { id: string }) {
    const queryClient = useQueryClient();
    const router = useRouter();
    const [toastOpen, setToastOpen] = React.useState(false);
    const [toastMsg, setToastMsg] = React.useState("");
    const [toastType, setToastType] = React.useState<"success" | "error">("success");
    const [isLoading, setIsLoading] = React.useState(true);

    const {
        date,
        setDate,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        invoiceItems,
        setInvoiceItems,
        invoiceNumber,
        setInvoiceNumber,
        products,
        drivers,
        cities,
        selectedCities,
        setSelectedCities,
        driver,
        setDriver,
        totalHT,
        totalTTC,
        totalVAT,
        status,
        setStatus,
        calculateTotals,
    } = useInvoiceData("SHIPPING_NOTE_INVOICE", true);

    // Fetch invoice data
    React.useEffect(() => {
        const loadInvoice = async () => {
            try {
                const data = await fetchSaleInvoice(id);

                setInvoiceNumber(data.invoiceNumber);
                setDate(data.date.split("T")[0]);
                setStartDate(data.startDate ? data.startDate.split("T")[0] : "");
                setEndDate(data.endDate ? data.endDate.split("T")[0] : "");
                setStatus(data.status);

                if (data.cities && data.cities.length > 0) {
                    const citiesFromInvoice = data.cities.map((cityRelation: any) => ({
                        value: cityRelation.city.id,
                        label: cityRelation.city.name,
                    }));
                    setSelectedCities(citiesFromInvoice);
                }

                if (data.driver) {
                    setDriver({
                        value: data.driver.id,
                        label: `${data.driver.firstName} ${data.driver.lastName}`,
                        driver: data.driver,
                        car: data.driver.car,
                    });
                }

                setInvoiceItems(
                    data.items.map((item: any) => ({
                        id: item.id,
                        productId: item.productId,
                        quantity: item.quantity,
                        price: item.price,
                        vatRate: item.vatRate,
                        vatAmount: item.vatAmount,
                        totalHT: (item.price || 0) * (item.quantity || 0),
                        totalTTC: (item.price || 0) * (item.quantity || 0) * (1 + (item.vatRate || 0) / 100),
                        total: (item.price || 0) * (item.quantity || 0),
                    }))
                );
            } catch (error) {
                console.error("Error fetching invoice:", error);
                showToast("Erreur lors du chargement de la facture", "error");
            } finally {
                setIsLoading(false);
            }
        };

        loadInvoice();
    }, [id]);

    useEffect(() => {
        calculateTotals();
    }, [invoiceItems, calculateTotals]);

    const showToast = (msg: string, type: "success" | "error" = "success") => {
        setToastMsg(msg);
        setToastType(type);
        setToastOpen(true);
    };

    const updateMutation = useMutation({
        mutationFn: updateSaleInvoice,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["saleInvoices"] });
            showToast("✅ Facture bon sortie mise à jour avec succès", "success");
            setTimeout(() => router.push("/sale-invoices/list/SHIPPING_NOTE_INVOICE"), 1500);
        },
        onError: (error: Error) => {
            showToast(`❌ ${error.message || "Erreur lors de la mise à jour"}`, "error");
        },
    });

    const handleItemChange = (index: number, field: string, value: number | string) => {
        const newItems = invoiceItems.map((item: any, i: number) => {
            if (i === index) {
                let updatedItem = { ...item, [field]: value };

                if (field === "productId") {
                    const selectedProduct = products.find((p: any) => p.id === value);
                    if (selectedProduct) {
                        updatedItem.price = selectedProduct.salePrice || selectedProduct.price || 0;
                        updatedItem.vatRate = selectedProduct.vat || 0;
                    }
                }

                const itemHT = (updatedItem.price || 0) * (updatedItem.quantity || 0);
                const itemVAT = itemHT * ((updatedItem.vatRate || 0) / 100);

                updatedItem.totalHT = itemHT;
                updatedItem.vatAmount = itemVAT;
                updatedItem.totalTTC = itemHT + itemVAT;
                updatedItem.total = itemHT;

                return updatedItem;
            }
            return item;
        });

        setInvoiceItems(newItems);
    };

    const handleAddItem = () => {
        setInvoiceItems([
            ...invoiceItems,
            {
                productId: 0,
                quantity: 1,
                price: 0,
                vatRate: 0,
                vatAmount: 0,
                totalHT: 0,
                totalTTC: 0,
                total: 0,
            },
        ]);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = invoiceItems.filter((_: any, i: number) => i !== index);
        setInvoiceItems(newItems);
    };

    const submitForm = async (event: React.FormEvent) => {
        event.preventDefault();

        if (validator.isEmpty(invoiceNumber)) {
            showToast("Numéro de facture est obligatoire", "error");
            return;
        }

        if (!driver) {
            showToast("Chauffeur est obligatoire", "error");
            return;
        }

        if (selectedCities.length === 0) {
            showToast("Au moins une ville doit être sélectionnée", "error");
            return;
        }

        if (!startDate) {
            showToast("Date de début est obligatoire", "error");
            return;
        }

        if (!endDate) {
            showToast("Date de fin est obligatoire", "error");
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            showToast("La date de début doit être antérieure à la date de fin", "error");
            return;
        }

        if (invoiceItems.length === 0) {
            showToast("Au moins un article est obligatoire", "error");
            return;
        }

        for (let i = 0; i < invoiceItems.length; i++) {
            if (!invoiceItems[i].productId) {
                showToast(`L'article ${i + 1} doit avoir un produit sélectionné`, "error");
                return;
            }
        }

        const items = invoiceItems.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            vatRate: item.vatRate,
            vatAmount: item.vatAmount,
        }));

        const invoiceData = {
            invoiceNumber,
            date,
            startDate,
            endDate,
            type: "SHIPPING_NOTE_INVOICE",
            status,
            items,
            totalHT,
            totalTTC,
            driverId: driver.value,
            cityIds: selectedCities.map((city: any) => city.value),
        };

        updateMutation.mutate({ id, data: invoiceData });
    };

    const statusOptions = [
        { value: "DRAFT", label: "Brouillon" },
        { value: "VALIDATED", label: "Validée" },
        { value: "PAID", label: "Payée" },
        { value: "CANCELLED", label: "Annulée" },
    ];

    if (isLoading) {
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
                <PageBreadcrumb pageTitle="Modifier facture bon sortie" />

                <div className="flex items-center justify-between mb-4">
                    <button
                        onClick={() => router.push("/sale-invoices/list/SHIPPING_NOTE_INVOICE")}
                        className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        ← Retour à la liste
                    </button>
                </div>

                <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
                    <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
                        <h3 className="text-xl font-semibold text-black dark:text-white">
                            Modifier facture bon sortie
                        </h3>
                    </div>

                    <form onSubmit={submitForm}>
                        <div className="p-6.5">
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <div>
                                    <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                                        Numéro de facture <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={invoiceNumber}
                                        placeholder="Ex: BS-2023-001"
                                        onChange={(e) => setInvoiceNumber(e.target.value)}
                                        className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                                        Type de facture <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value="Facture bon sortie"
                                        readOnly
                                        disabled
                                        className="w-full rounded-lg border-[1.5px] border-stroke bg-gray-100 px-5 py-3 outline-none dark:border-form-strokedark dark:bg-form-input dark:text-white"
                                    />
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

                                <div className="md:col-span-2">
                                    <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                                        Chauffeur <span className="text-danger">*</span>
                                    </label>
                                    <Select
                                        placeholder="Sélectionner un chauffeur"
                                        value={driver}
                                        options={drivers.map((driver: any) => ({
                                            label: `${driver.firstName} ${driver.lastName}`,
                                            value: driver.id,
                                            driver: driver,
                                        }))}
                                        onChange={(e) => setDriver(e)}
                                        className="react-select-container"
                                        classNamePrefix="react-select"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                                        Villes desservies <span className="text-danger">*</span>
                                    </label>
                                    <Select
                                        isMulti
                                        placeholder="Sélectionner une ou plusieurs villes"
                                        value={selectedCities}
                                        options={cities.map((city: any) => ({
                                            value: city.id,
                                            label: city.name,
                                        }))}
                                        onChange={(selected) => setSelectedCities([...selected])}
                                        className="react-select-container"
                                        classNamePrefix="react-select"
                                    />
                                </div>

                                <div>
                                    <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                                        Date de début <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        min={date}
                                        className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                                        Date de fin <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        min={startDate || date}
                                        className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                                    />
                                </div>
                            </div>

                            {/* Items Table */}
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
                                                <th className="border-b p-4 text-left">Prix unitaire (TND)</th>
                                                <th className="border-b p-4 text-left">Total (TND)</th>
                                                <th className="border-b p-4 text-left">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {invoiceItems.map((item, index) => (
                                                <tr key={index} className="border-b">
                                                    <td className="p-4">
                                                        <select
                                                            value={item.productId}
                                                            onChange={(e) => handleItemChange(index, "productId", Number(e.target.value))}
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
                                                            onChange={(e) => handleItemChange(index, "quantity", parseInt(e.target.value) || 0)}
                                                            className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-3 py-2 outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input"
                                                        />
                                                    </td>
                                                    <td className="p-4">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={item.price}
                                                            onChange={(e) => handleItemChange(index, "price", parseFloat(e.target.value) || 0)}
                                                            className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-3 py-2 outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input"
                                                        />
                                                    </td>
                                                    <td className="p-4">{item.total.toFixed(3)}</td>
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
                                    <label className="mb-3 block text-sm font-medium">Total HT (TND)</label>
                                    <input
                                        type="text"
                                        value={(totalHT || 0).toFixed(3)}
                                        readOnly
                                        className="w-full rounded-lg border-[1.5px] border-stroke bg-gray-100 px-5 py-3 outline-none font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="mb-3 block text-sm font-medium">TVA (19%) (TND)</label>
                                    <input
                                        type="text"
                                        value={(totalVAT || 0).toFixed(3)}
                                        readOnly
                                        className="w-full rounded-lg border-[1.5px] border-stroke bg-gray-100 px-5 py-3 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="mb-3 block text-sm font-medium">Total TTC (TND)</label>
                                    <input
                                        type="text"
                                        value={(totalTTC || 0).toFixed(3)}
                                        readOnly
                                        className="w-full rounded-lg border-[1.5px] border-stroke bg-gray-100 px-5 py-3 outline-none font-bold text-primary"
                                    />
                                </div>
                            </div>

                            {/* Buttons */}
                            <div className="mt-6 flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => router.push("/sale-invoices/list/SHIPPING_NOTE_INVOICE")}
                                    className="rounded-md border border-stroke px-6 py-3 font-medium hover:bg-gray-100"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={updateMutation.isPending}
                                    className="rounded-md border border-stroke px-6 py-3 font-medium hover:bg-gray-100"
                                >
                                    {updateMutation.isPending ? "Mise à jour..." : "Mettre à jour"}
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