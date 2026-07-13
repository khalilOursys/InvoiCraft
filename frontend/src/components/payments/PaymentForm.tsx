// src/components/payments/PaymentForm.tsx
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Select from "react-select";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import * as Toast from "@radix-ui/react-toast";

interface PaymentFormProps {
    initialData?: {
        id?: number;
        amount: number;
        method: string;
        paymentType: "purchase" | "sale";
        invoiceId: number;
        entityId: number;
        invoiceNumber?: string;
        remainingBalance?: number;
        receiptFile?: string;
        receiptFileName?: string;
        checkDate?: string;
        checkBank?: string;
        checkNumber?: string;
        traitDate?: string;
        traitNumber?: string;
    };
    isEditing?: boolean;
    supplierId?: string;
    clientId?: string;
    invoiceType?: "purchase" | "sale";
    onSubmit: (data: any) => Promise<void>;
    isLoading?: boolean;
}

interface Invoice {
    id: number;
    invoiceNumber: string;
    totalTTC: number;
    status: string;
    payments?: { amount: number }[];
}

interface Supplier {
    id: number;
    name: string;
    company?: string;
    code?: string;
}

interface Client {
    id: number;
    name: string;
    company?: string;
    code?: string;
}

interface SelectOption {
    value: string | number;
    label: string;
    data?: Invoice;
}

const paymentMethods: SelectOption[] = [
    { value: "CASH", label: "Espèces" },
    { value: "CHECK", label: "Chèque" },
    /* { value: "BANK_TRANSFER", label: "Virement Bancaire" },
    { value: "CREDIT_CARD", label: "Carte Bancaire" },
    { value: "MOBILE_PAYMENT", label: "Paiement Mobile" }, */
    { value: "TRAIT", label: "Traite" },
];

const paymentTypes: SelectOption[] = [
    { value: "purchase", label: "Paiement Fournisseur" },
    { value: "sale", label: "Paiement Client" },
];

const fetchSuppliers = async (): Promise<Supplier[]> => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}suppliers`);
    if (!response.ok) throw new Error("Failed to fetch suppliers");
    return response.json();
};

const fetchClients = async (): Promise<Client[]> => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}clients`);
    if (!response.ok) throw new Error("Failed to fetch clients");
    return response.json();
};

const fetchPurchaseInvoices = async (supplierId: number): Promise<Invoice[]> => {
    const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}purchase-invoices?supplierId=${supplierId}`
    );
    if (!response.ok) throw new Error("Failed to fetch purchase invoices");
    return response.json();
};

const fetchSaleInvoices = async (clientId: number): Promise<Invoice[]> => {
    const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}sale-invoices?clientId=${clientId}`
    );
    if (!response.ok) throw new Error("Failed to fetch sale invoices");
    return response.json();
};

export function PaymentForm({
    initialData,
    isEditing = false,
    supplierId,
    clientId,
    invoiceType,
    onSubmit,
    isLoading = false,
}: PaymentFormProps) {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    console.log(initialData);

    // CRITICAL: Add mounted state to prevent hydration mismatch
    const [isMounted, setIsMounted] = useState(false);

    // Form states
    const [amount, setAmount] = useState<string>(
        initialData?.amount?.toString() || ""
    );
    const [method, setMethod] = useState<string>(
        initialData?.method || "CASH"
    );
    const [paymentType, setPaymentType] = useState<"purchase" | "sale">(
        initialData?.paymentType || invoiceType || "purchase"
    );
    const [invoiceId, setInvoiceId] = useState<string>(
        initialData?.invoiceId?.toString() || ""
    );
    const [entityId, setEntityId] = useState<string>(
        initialData?.entityId?.toString() || ""
    );
    const [remainingBalance, setRemainingBalance] = useState<number>(
        initialData?.remainingBalance || 0
    );
    const [invoiceNumber, setInvoiceNumber] = useState<string>(
        initialData?.invoiceNumber || ""
    );
    const [originalPaymentAmount, setOriginalPaymentAmount] = useState<number>(0);

    // CHECK specific fields
    const [checkDate, setCheckDate] = useState<string>(
        initialData?.checkDate || ""
    );
    const [checkBank, setCheckBank] = useState<string>(
        initialData?.checkBank || ""
    );
    const [checkNumber, setCheckNumber] = useState<string>(
        initialData?.checkNumber || ""
    );

    // TRAIT specific fields
    const [traitDate, setTraitDate] = useState<string>(
        initialData?.traitDate || ""
    );
    const [traitNumber, setTraitNumber] = useState<string>(
        initialData?.traitNumber || ""
    );

    // File upload states
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [currentFile, setCurrentFile] = useState<{
        path: string;
        name: string;
    } | null>(
        initialData?.receiptFile && initialData?.receiptFileName
            ? {
                path: initialData.receiptFile,
                name: initialData.receiptFileName,
            }
            : null
    );
    const [removeFile, setRemoveFile] = useState<boolean>(false);

    // Options
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [purchaseInvoices, setPurchaseInvoices] = useState<Invoice[]>([]);
    const [saleInvoices, setSaleInvoices] = useState<Invoice[]>([]);

    // Selected options
    const [selectedSupplier, setSelectedSupplier] = useState<SelectOption | null>(null);
    const [selectedClient, setSelectedClient] = useState<SelectOption | null>(null);
    const [selectedPurchaseInvoice, setSelectedPurchaseInvoice] = useState<SelectOption | null>(null);
    const [selectedSaleInvoice, setSelectedSaleInvoice] = useState<SelectOption | null>(null);

    const [toastOpen, setToastOpen] = useState(false);
    const [toastMsg, setToastMsg] = useState("");
    const [toastType, setToastType] = useState<"success" | "error">("success");

    // CRITICAL: Set mounted state after hydration
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Set original payment amount when editing
    useEffect(() => {
        if (isEditing && initialData?.amount) {
            setOriginalPaymentAmount(initialData.amount);
        }
    }, [isEditing, initialData]);

    // Load suppliers and clients - only when mounted
    const { data: suppliersData, isLoading: isLoadingSuppliers } = useQuery({
        queryKey: ["suppliers"],
        queryFn: fetchSuppliers,
        enabled: paymentType === "purchase" && isMounted,
    });

    const { data: clientsData, isLoading: isLoadingClients } = useQuery({
        queryKey: ["clients"],
        queryFn: fetchClients,
        enabled: paymentType === "sale" && isMounted,
    });

    // Set supplier from initialData or supplierId prop
    useEffect(() => {
        if (suppliersData && isMounted) {
            setSuppliers(suppliersData);

            let entityIdToUse = initialData?.entityId?.toString() || supplierId;

            if (entityIdToUse) {
                const supplier = suppliersData.find((s) => s.id === parseInt(entityIdToUse));
                if (supplier) {
                    const option: SelectOption = {
                        value: supplier.id,
                        label: `${supplier.company || supplier.name} (${supplier.code || "N/A"})`,
                    };
                    setSelectedSupplier(option);
                    setEntityId(entityIdToUse);
                }
            }
        }
    }, [suppliersData, supplierId, initialData, isMounted]);

    // Set client from initialData or clientId prop
    useEffect(() => {
        if (clientsData && isMounted) {
            setClients(clientsData);

            let entityIdToUse = initialData?.entityId?.toString() || clientId;

            if (entityIdToUse) {
                const client = clientsData.find((c) => c.id === parseInt(entityIdToUse));
                if (client) {
                    const option: SelectOption = {
                        value: client.id,
                        label: `${client.company || client.name} (${client.code || "N/A"})`,
                    };
                    setSelectedClient(option);
                    setEntityId(entityIdToUse);
                }
            }
        }
    }, [clientsData, clientId, initialData, isMounted]);

    // Calculate remaining balance with edit mode support
    const calculateRemainingBalance = (invoice: Invoice, newAmount?: number) => {
        if (!invoice) return 0;

        const totalPaid = invoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;

        let adjustedTotalPaid = totalPaid;
        if (isEditing && initialData?.id && originalPaymentAmount > 0) {
            adjustedTotalPaid = totalPaid - originalPaymentAmount;
        }

        if (newAmount !== undefined && newAmount > 0) {
            adjustedTotalPaid += newAmount;
        }

        const remaining = invoice.totalTTC - adjustedTotalPaid;
        const finalRemaining = Math.max(0, remaining);
        setRemainingBalance(finalRemaining);
        setInvoiceNumber(invoice.invoiceNumber);
        return finalRemaining;
    };

    // Load invoices when entity changes - only when mounted
    useEffect(() => {
        const loadInvoices = async () => {
            if (!entityId || !isMounted) {
                if (paymentType === "purchase") setPurchaseInvoices([]);
                else setSaleInvoices([]);
                return;
            }

            try {
                if (paymentType === "purchase") {
                    const invoices = await fetchPurchaseInvoices(parseInt(entityId));
                    const filtered = invoices.filter(
                        (inv) => inv.status === "DRAFT" || inv.status === "VALIDATED"
                    );
                    setPurchaseInvoices(filtered);

                    if (isEditing && initialData?.invoiceId) {
                        const invoice = filtered.find((i) => i.id === initialData.invoiceId);
                        if (invoice) {
                            const option: SelectOption = {
                                value: invoice.id,
                                label: `Facture #${invoice.invoiceNumber} - ${invoice.totalTTC.toFixed(3)} DH`,
                                data: invoice,
                            };
                            setSelectedPurchaseInvoice(option);
                            setInvoiceId(initialData.invoiceId.toString());
                            calculateRemainingBalance(invoice, parseFloat(amount) || 0);
                        }
                    }
                } else {
                    const invoices = await fetchSaleInvoices(parseInt(entityId));
                    const filtered = invoices.filter(
                        (inv) => inv.status === "DRAFT" || inv.status === "VALIDATED"
                    );
                    setSaleInvoices(filtered);

                    if (isEditing && initialData?.invoiceId) {
                        const invoice = filtered.find((i) => i.id === initialData.invoiceId);
                        if (invoice) {
                            const option: SelectOption = {
                                value: invoice.id,
                                label: `Facture #${invoice.invoiceNumber} - ${invoice.totalTTC.toFixed(3)} DH`,
                                data: invoice,
                            };
                            setSelectedSaleInvoice(option);
                            setInvoiceId(initialData.invoiceId.toString());
                            calculateRemainingBalance(invoice, parseFloat(amount) || 0);
                        }
                    }
                }
            } catch (error) {
                console.error("Error loading invoices:", error);
                showToast("Erreur lors du chargement des factures", "error");
            }
        };

        loadInvoices();
    }, [entityId, paymentType, isMounted, isEditing, initialData]);

    // Recalculate remaining balance when amount changes in edit mode
    useEffect(() => {
        if (isEditing && initialData?.invoiceId && entityId) {
            const currentInvoice = paymentType === 'purchase'
                ? purchaseInvoices.find(inv => inv.id === parseInt(invoiceId))
                : saleInvoices.find(inv => inv.id === parseInt(invoiceId));

            if (currentInvoice) {
                calculateRemainingBalance(currentInvoice, parseFloat(amount) || 0);
            }
        }
    }, [amount, isEditing, invoiceId, entityId, paymentType, purchaseInvoices, saleInvoices]);

    // Set payment type from initialData when editing
    useEffect(() => {
        if (isEditing && initialData?.paymentType) {
            setPaymentType(initialData.paymentType);
        }
    }, [isEditing, initialData]);

    const showToast = (msg: string, type: "success" | "error" = "success") => {
        setToastMsg(msg);
        setToastType(type);
        setToastOpen(true);
    };

    const invoiceOptions = useMemo(() => {
        if (paymentType === "purchase") {
            return purchaseInvoices.map((inv) => ({
                value: inv.id,
                label: `Facture #${inv.invoiceNumber} - ${inv.totalTTC.toFixed(3)} DH`,
                data: inv,
            }));
        } else {
            return saleInvoices.map((inv) => ({
                value: inv.id,
                label: `Facture #${inv.invoiceNumber} - ${inv.totalTTC.toFixed(3)} DH`,
                data: inv,
            }));
        }
    }, [paymentType, purchaseInvoices, saleInvoices]);

    const entityOptions = useMemo(() => {
        if (paymentType === "purchase") {
            return suppliers.map((s) => ({
                value: s.id,
                label: `${s.company || s.name} (${s.code || "N/A"})`,
            }));
        } else {
            return clients.map((c) => ({
                value: c.id,
                label: `${c.company || c.name} (${c.code || "N/A"})`,
            }));
        }
    }, [paymentType, suppliers, clients]);

    const handleEntityChange = (selectedOption: SelectOption | null) => {
        const newEntityId = selectedOption?.value?.toString() || "";
        setEntityId(newEntityId);
        setInvoiceId("");
        setRemainingBalance(0);
        setInvoiceNumber("");

        if (paymentType === "purchase") {
            setSelectedSupplier(selectedOption);
            setSelectedPurchaseInvoice(null);
        } else {
            setSelectedClient(selectedOption);
            setSelectedSaleInvoice(null);
        }
    };

    const handleInvoiceChange = (selectedOption: SelectOption | null) => {
        const newInvoiceId = selectedOption?.value?.toString() || "";
        setInvoiceId(newInvoiceId);

        if (paymentType === "purchase") {
            setSelectedPurchaseInvoice(selectedOption);
        } else {
            setSelectedSaleInvoice(selectedOption);
        }

        if (selectedOption?.data) {
            calculateRemainingBalance(selectedOption.data, parseFloat(amount) || 0);
        } else {
            setRemainingBalance(0);
            setInvoiceNumber("");
        }
    };

    const handlePaymentTypeChange = (selectedOption: SelectOption | null) => {
        if (!selectedOption) return;
        const newType = selectedOption.value as "purchase" | "sale";
        setPaymentType(newType);
        setEntityId("");
        setInvoiceId("");
        setRemainingBalance(0);
        setInvoiceNumber("");
        setSelectedSupplier(null);
        setSelectedClient(null);
        setSelectedPurchaseInvoice(null);
        setSelectedSaleInvoice(null);
    };

    const handleMethodChange = (selectedOption: SelectOption | null) => {
        if (!selectedOption) return;
        setMethod(selectedOption.value as string);
        // Reset CHECK/TRAIT fields when method changes
        if (selectedOption.value !== "CHECK") {
            setCheckDate("");
            setCheckBank("");
            setCheckNumber("");
        }
        if (selectedOption.value !== "TRAIT") {
            setTraitDate("");
            setTraitNumber("");
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file size (5MB)
            if (file.size > 5 * 1024 * 1024) {
                showToast("Le fichier est trop volumineux (max 5MB)", "error");
                e.target.value = '';
                return;
            }

            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
            if (!allowedTypes.includes(file.type)) {
                showToast("Format de fichier non supporté. Utilisez JPG, PNG ou PDF.", "error");
                e.target.value = '';
                return;
            }

            setSelectedFile(file);
            setCurrentFile({
                path: URL.createObjectURL(file),
                name: file.name,
            });
            setRemoveFile(false);
        }
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
        setCurrentFile(null);
        setRemoveFile(true);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        const amountNum = parseFloat(amount);

        if (!amount || amountNum <= 0) {
            showToast("Le montant doit être positif", "error");
            return;
        }

        if (!entityId) {
            showToast(
                paymentType === "purchase"
                    ? "Veuillez sélectionner un fournisseur"
                    : "Veuillez sélectionner un client",
                "error"
            );
            return;
        }

        if (!invoiceId) {
            showToast("Veuillez sélectionner une facture", "error");
            return;
        }

        // Validate CHECK fields
        if (method === "CHECK") {
            if (!checkDate) {
                showToast("La date du chèque est requise", "error");
                return;
            }
            if (!checkBank) {
                showToast("La banque est requise", "error");
                return;
            }
            if (!checkNumber) {
                showToast("Le numéro de chèque est requis", "error");
                return;
            }
        }

        // Validate TRAIT fields
        if (method === "TRAIT") {
            if (!traitDate) {
                showToast("La date du trait est requise", "error");
                return;
            }
            if (!traitNumber) {
                showToast("Le numéro du trait est requis", "error");
                return;
            }
        }

        // Check if amount exceeds remaining balance
        if (amountNum > remainingBalance && remainingBalance > 0) {
            showToast(
                `Le montant dépasse le solde restant (${remainingBalance.toFixed(3)} DH)`,
                "error"
            );
            return;
        }

        // Prepare data for submission
        let paymentData: any = {
            amount: amountNum,
            method,
            // Add CHECK fields if method is CHECK
            ...(method === "CHECK" && {
                checkDate: checkDate,
                checkBank: checkBank,
                checkNumber: checkNumber,
            }),
            // Add TRAIT fields if method is TRAIT
            ...(method === "TRAIT" && {
                traitDate: traitDate,
                traitNumber: traitNumber,
            }),
            ...(paymentType === "purchase"
                ? {
                    purchaseInvoiceId: parseInt(invoiceId),
                    supplierId: parseInt(entityId),
                }
                : {
                    saleInvoiceId: parseInt(invoiceId),
                    clientId: parseInt(entityId),
                }),
        };

        // Handle file upload
        if (selectedFile) {
            // If there's a new file, use FormData
            const formData = new FormData();
            formData.append('amount', amountNum.toString());
            formData.append('method', method);
            formData.append('receiptFile', selectedFile);

            // Add CHECK fields
            if (method === "CHECK") {
                formData.append('checkDate', checkDate);
                formData.append('checkBank', checkBank);
                formData.append('checkNumber', checkNumber);
            }

            // Add TRAIT fields
            if (method === "TRAIT") {
                formData.append('traitDate', traitDate);
                formData.append('traitNumber', traitNumber);
            }

            if (paymentType === "purchase") {
                formData.append('purchaseInvoiceId', invoiceId);
                formData.append('supplierId', entityId);
            } else {
                formData.append('saleInvoiceId', invoiceId);
                formData.append('clientId', entityId);
            }

            // For edit mode, also send the ID
            /* if (isEditing && initialData?.id) {
                formData.append('id', initialData.id.toString());
            } */

            paymentData = formData;
        } else if (removeFile && isEditing) {
            // If removing file in edit mode, send null
            paymentData.receiptFile = null;
            paymentData.receiptFileName = null;
        }

        try {
            await onSubmit(paymentData);
            showToast(
                isEditing
                    ? "Paiement modifié avec succès"
                    : "Paiement enregistré avec succès",
                "success"
            );

            setTimeout(() => {
                if (paymentType || entityId) {
                    const params = new URLSearchParams();
                    if (paymentType) params.append('type', paymentType);
                    if (entityId) params.append('entityId', entityId);
                    router.push(`/payments?${params.toString()}`);
                } else {
                    router.push("/payments");
                }
            }, 1500);
        } catch (error) {
            console.error("Payment submission error:", error);
            showToast("Erreur lors de l'enregistrement du paiement", "error");
        }
    };

    const goToList = () => {
        router.push("/payments");
    };

    const isLoadingData = isLoadingSuppliers || isLoadingClients;

    const currentSelectedEntity = paymentType === "purchase" ? selectedSupplier : selectedClient;
    const currentSelectedInvoice = paymentType === "purchase" ? selectedPurchaseInvoice : selectedSaleInvoice;

    // Check if CHECK fields should be shown
    const showCheckFields = method === "CHECK";
    // Check if TRAIT fields should be shown
    const showTraitFields = method === "TRAIT";

    // CRITICAL: Return loading state during SSR to prevent hydration mismatch
    if (!isMounted) {
        return (
            <Toast.Provider>
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={goToList}
                            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                            ← Retour à la liste
                        </button>
                    </div>
                    <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
                        <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
                            <h3 className="text-xl font-semibold text-black dark:text-white">
                                {isEditing ? "Modifier Paiement" : "Ajouter Paiement"}
                            </h3>
                        </div>
                        <div className="p-6.5">
                            <div className="flex justify-center items-center h-64">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </Toast.Provider>
        );
    }

    return (
        <Toast.Provider>
            <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <button
                        onClick={goToList}
                        className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        ← Retour à la liste
                    </button>
                </div>

                <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
                    <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
                        <h3 className="text-xl font-semibold text-black dark:text-white">
                            {isEditing ? "Modifier Paiement" : "Ajouter Paiement"}
                        </h3>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="p-6.5">
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                {/* Payment Type */}
                                <div>
                                    <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                                        Type de Paiement *
                                    </label>
                                    <Select
                                        instanceId="payment-type-select"
                                        key="payment-type-select"
                                        placeholder="Sélectionner le type"
                                        className="react-select primary"
                                        classNamePrefix="react-select"
                                        value={paymentTypes.find((pt) => pt.value === paymentType) || null}
                                        onChange={handlePaymentTypeChange}
                                        options={paymentTypes}
                                        isDisabled={isLoadingData || isEditing}
                                    />
                                </div>

                                {/* Payment Method */}
                                <div>
                                    <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                                        Méthode de Paiement *
                                    </label>
                                    <Select
                                        instanceId="payment-method-select"
                                        key="payment-method-select"
                                        placeholder="Sélectionner la méthode"
                                        className="react-select primary"
                                        classNamePrefix="react-select"
                                        value={paymentMethods.find((pm) => pm.value === method) || null}
                                        onChange={handleMethodChange}
                                        options={paymentMethods}
                                    />
                                </div>

                                {/* Entity (Supplier/Client) */}
                                <div>
                                    <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                                        {paymentType === "purchase" ? "Fournisseur *" : "Client *"}
                                    </label>
                                    <Select
                                        instanceId="entity-select"
                                        key="entity-select"
                                        placeholder={
                                            paymentType === "purchase"
                                                ? "Sélectionner un fournisseur"
                                                : "Sélectionner un client"
                                        }
                                        className="react-select primary"
                                        classNamePrefix="react-select"
                                        value={currentSelectedEntity}
                                        onChange={handleEntityChange}
                                        options={entityOptions}
                                        isDisabled={isLoadingData || isEditing}
                                        isClearable
                                    />
                                </div>

                                {/* Invoice */}
                                <div>
                                    <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                                        Facture *
                                    </label>
                                    <Select
                                        instanceId="invoice-select"
                                        key="invoice-select"
                                        placeholder="Sélectionner une facture"
                                        className="react-select primary"
                                        classNamePrefix="react-select"
                                        value={currentSelectedInvoice}
                                        onChange={handleInvoiceChange}
                                        options={invoiceOptions}
                                        isDisabled={!entityId || invoiceOptions.length === 0 || isEditing}
                                        isClearable
                                    />
                                    {entityId && invoiceOptions.length === 0 && (
                                        <small className="text-gray-500 dark:text-gray-400">
                                            Aucune facture impayée trouvée pour
                                            {paymentType === "purchase"
                                                ? "ce fournisseur"
                                                : "ce client"}
                                        </small>
                                    )}
                                </div>
                            </div>

                            {/* Invoice Info Alert */}
                            {invoiceNumber && (
                                <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                                    <p className="text-sm text-blue-800 dark:text-blue-200">
                                        <strong>Facture #{invoiceNumber}</strong>
                                        <br />
                                        Solde restant: <strong>{remainingBalance.toFixed(3)} DH</strong>
                                        {isEditing && originalPaymentAmount > 0 && (
                                            <>
                                                <br />
                                                <span className="text-xs opacity-75">
                                                    Paiement original: {originalPaymentAmount.toFixed(3)} DH
                                                </span>
                                            </>
                                        )}
                                    </p>
                                </div>
                            )}

                            {/* Amount */}
                            <div className="mt-6">
                                <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                                    Montant (DH) *
                                </label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => {
                                        const newAmount = e.target.value;
                                        setAmount(newAmount);
                                        if (isEditing && initialData?.invoiceId) {
                                            const currentInvoice = paymentType === 'purchase'
                                                ? purchaseInvoices.find(inv => inv.id === parseInt(invoiceId))
                                                : saleInvoices.find(inv => inv.id === parseInt(invoiceId));

                                            if (currentInvoice) {
                                                calculateRemainingBalance(currentInvoice, parseFloat(newAmount) || 0);
                                            }
                                        }
                                    }}
                                    placeholder="0.00"
                                    step="0.001"
                                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                                />
                                {remainingBalance > 0 && (
                                    <small className="text-gray-500 dark:text-gray-400">
                                        Maximum: {remainingBalance.toFixed(3)} DH
                                    </small>
                                )}
                            </div>

                            {/* CHECK Fields - Conditional */}
                            {showCheckFields && (
                                <div className="mt-6 border-t border-stroke pt-6 dark:border-strokedark">
                                    <h4 className="mb-4 text-md font-semibold text-black dark:text-white">
                                        Informations du Chèque
                                    </h4>
                                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                                        <div>
                                            <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                                                Date du Chèque *
                                            </label>
                                            <input
                                                type="date"
                                                value={checkDate}
                                                onChange={(e) => setCheckDate(e.target.value)}
                                                className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                                                Banque *
                                            </label>
                                            <input
                                                type="text"
                                                value={checkBank}
                                                onChange={(e) => setCheckBank(e.target.value)}
                                                placeholder="Nom de la banque"
                                                className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                                                Numéro de Chèque *
                                            </label>
                                            <input
                                                type="text"
                                                value={checkNumber}
                                                onChange={(e) => setCheckNumber(e.target.value)}
                                                placeholder="Numéro du chèque"
                                                className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TRAIT Fields - Conditional */}
                            {showTraitFields && (
                                <div className="mt-6 border-t border-stroke pt-6 dark:border-strokedark">
                                    <h4 className="mb-4 text-md font-semibold text-black dark:text-white">
                                        Informations du Trait (Canbiala)
                                    </h4>
                                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                        <div>
                                            <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                                                Date du Trait *
                                            </label>
                                            <input
                                                type="date"
                                                value={traitDate}
                                                onChange={(e) => setTraitDate(e.target.value)}
                                                className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                                                Numéro du Trait *
                                            </label>
                                            <input
                                                type="text"
                                                value={traitNumber}
                                                onChange={(e) => setTraitNumber(e.target.value)}
                                                placeholder="Numéro du trait"
                                                className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* File Upload */}
                            <div className="mt-6">
                                <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                                    Reçu / Justificatif
                                </label>

                                <div className="flex items-center gap-4">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".jpg,.jpeg,.png,.pdf"
                                        onChange={handleFileChange}
                                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-400"
                                    />
                                    {currentFile && (
                                        <button
                                            type="button"
                                            onClick={handleRemoveFile}
                                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    )}
                                </div>

                                {currentFile && (
                                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                        📎 {currentFile.name}
                                        {isEditing && initialData?.receiptFile && !selectedFile && !removeFile && (
                                            <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                                                (fichier existant)
                                            </span>
                                        )}
                                        {selectedFile && (
                                            <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                                                (nouveau fichier)
                                            </span>
                                        )}
                                    </p>
                                )}

                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    Formats acceptés: JPG, PNG, PDF • Taille max: 5MB
                                </p>
                            </div>

                            {/* Date */}
                            <div className="mt-6">
                                <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                                    Date
                                </label>
                                <input
                                    type="datetime-local"
                                    defaultValue={new Date().toISOString().slice(0, 16)}
                                    className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                                />
                            </div>

                            {/* Buttons */}
                            <div className="mt-6 flex gap-4">
                                <button
                                    type="button"
                                    onClick={goToList}
                                    className="rounded-md border border-stroke px-6 py-3 font-medium hover:bg-gray-100 dark:hover:bg-meta-4 transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={
                                        isLoading ||
                                        !entityId ||
                                        !invoiceId ||
                                        !amount ||
                                        isLoadingData
                                    }
                                    className="rounded-md bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent inline-block mr-2"></div>
                                            {isEditing ? "Modification..." : "Enregistrement..."}
                                        </>
                                    ) : isEditing ? (
                                        "Modifier"
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