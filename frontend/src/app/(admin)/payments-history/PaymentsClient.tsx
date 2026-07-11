// src/app/payments/PaymentsClient.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import * as Toast from "@radix-ui/react-toast";
import { useRouter } from "next/navigation";
import {
    Plus,
    Building2,
    User,
    Filter,
    X,
    RefreshCw,
    Eye,
    Loader2
} from "lucide-react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

// Type for invoice payment data from API
interface InvoicePaymentSummary {
    id: number;
    invoiceNumber: string;
    date: string;
    type: string;
    status: string;
    totalHT: number;
    totalTTC: number;
    totalPaid: number;
    remainingAmount: number;
    paidPercentage: number;
    paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
    statusLabel: string;
    paymentCount: number;
    payments: Array<{
        id: number;
        amount: number;
        method: string;
        createdAt: string;
    }>;
    items: Array<{
        id: number;
        productId: number;
        productName: string;
        quantity: number;
        price: number;
        total: number;
    }>;
}

interface PaymentsClientProps {
    typeFilter?: "purchase" | "sale";
    entityIdFilter?: string;
}

// API Calls
const fetchSupplierInvoicesWithPayments = async (supplierId: number): Promise<InvoicePaymentSummary[]> => {
    const url = `${process.env.NEXT_PUBLIC_API_URL}purchase-invoices/supplier/${supplierId}/payments`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Échec de la récupération des factures fournisseur");
    return response.json();
};

const fetchClientInvoicesWithPayments = async (clientId: number): Promise<InvoicePaymentSummary[]> => {
    const url = `${process.env.NEXT_PUBLIC_API_URL}sale-invoices/client/${clientId}/payments`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Échec de la récupération des factures client");
    return response.json();
};

const paymentStatusBadgeClasses = {
    PAID: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    PARTIAL: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    UNPAID: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
} as const;

export default function PaymentsClient({ typeFilter, entityIdFilter }: PaymentsClientProps) {
    const router = useRouter();

    const [toastOpen, setToastOpen] = useState(false);
    const [toastMsg, setToastMsg] = useState("");
    const [toastType, setToastType] = useState<"success" | "error">("success");
    const [theme, setTheme] = useState<"light" | "dark">("light");
    const [entityName, setEntityName] = useState<string>("");
    const [showInvoiceDetails, setShowInvoiceDetails] = useState(true);
    const [invoiceData, setInvoiceData] = useState<InvoicePaymentSummary[]>([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);
    const [stats, setStats] = useState<{
        totalInvoices: number;
        totalAmount: number;
        totalPaid: number;
        totalRemaining: number;
        paidPercentage: number;
        statusCount: { PAID: number; PARTIAL: number; UNPAID: number };
    } | null>(null);

    // Detect theme on mount
    useEffect(() => {
        const isDark = document.documentElement.classList.contains("dark");
        setTheme(isDark ? "dark" : "light");

        const observer = new MutationObserver(() => {
            const isDarkNow = document.documentElement.classList.contains("dark");
            setTheme(isDarkNow ? "dark" : "light");
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
        });

        return () => observer.disconnect();
    }, []);

    const showToast = (msg: string, type: "success" | "error" = "success") => {
        setToastMsg(msg);
        setToastType(type);
        setToastOpen(true);
    };

    // Fetch invoice data when entityIdFilter is present
    useEffect(() => {
        const fetchInvoiceData = async () => {
            if (!entityIdFilter) {
                setInvoiceData([]);
                setStats(null);
                setEntityName("");
                return;
            }

            const entityId = parseInt(entityIdFilter);
            if (isNaN(entityId)) return;

            setLoadingInvoices(true);
            try {
                let data: InvoicePaymentSummary[] = [];
                if (typeFilter === 'purchase') {
                    data = await fetchSupplierInvoicesWithPayments(entityId);
                    if (data.length > 0) {
                        setEntityName(`Fournisseur #${entityId}`);
                    }
                } else if (typeFilter === 'sale') {
                    data = await fetchClientInvoicesWithPayments(entityId);
                    if (data.length > 0) {
                        setEntityName(`Client #${entityId}`);
                    }
                }
                setInvoiceData(data);

                // Calculate stats from the data
                if (data.length > 0) {
                    const totalAmount = data.reduce((sum, inv) => sum + inv.totalTTC, 0);
                    const totalPaid = data.reduce((sum, inv) => sum + inv.totalPaid, 0);
                    const totalRemaining = data.reduce((sum, inv) => sum + inv.remainingAmount, 0);
                    const paidPercentage = totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;

                    const statusCount = {
                        PAID: data.filter(inv => inv.paymentStatus === 'PAID').length,
                        PARTIAL: data.filter(inv => inv.paymentStatus === 'PARTIAL').length,
                        UNPAID: data.filter(inv => inv.paymentStatus === 'UNPAID').length,
                    };

                    setStats({
                        totalInvoices: data.length,
                        totalAmount,
                        totalPaid,
                        totalRemaining,
                        paidPercentage: Math.round(paidPercentage * 100) / 100,
                        statusCount,
                    });
                } else {
                    setStats(null);
                }
            } catch (error) {
                console.error('Error fetching invoice data:', error);
                showToast('Erreur lors du chargement des données des factures', 'error');
                setInvoiceData([]);
                setStats(null);
            } finally {
                setLoadingInvoices(false);
            }
        };

        fetchInvoiceData();
    }, [typeFilter, entityIdFilter]);

    const clearFilters = () => {
        router.push("/payments");
        setInvoiceData([]);
        setStats(null);
        setEntityName("");
    };

    const refreshInvoices = async () => {
        if (!entityIdFilter) return;

        const entityId = parseInt(entityIdFilter);
        if (isNaN(entityId)) return;

        setLoadingInvoices(true);
        try {
            let data: InvoicePaymentSummary[] = [];
            if (typeFilter === 'purchase') {
                data = await fetchSupplierInvoicesWithPayments(entityId);
            } else if (typeFilter === 'sale') {
                data = await fetchClientInvoicesWithPayments(entityId);
            }
            setInvoiceData(data);

            if (data.length > 0) {
                const totalAmount = data.reduce((sum, inv) => sum + inv.totalTTC, 0);
                const totalPaid = data.reduce((sum, inv) => sum + inv.totalPaid, 0);
                const totalRemaining = data.reduce((sum, inv) => sum + inv.remainingAmount, 0);
                const paidPercentage = totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;

                const statusCount = {
                    PAID: data.filter(inv => inv.paymentStatus === 'PAID').length,
                    PARTIAL: data.filter(inv => inv.paymentStatus === 'PARTIAL').length,
                    UNPAID: data.filter(inv => inv.paymentStatus === 'UNPAID').length,
                };

                setStats({
                    totalInvoices: data.length,
                    totalAmount,
                    totalPaid,
                    totalRemaining,
                    paidPercentage: Math.round(paidPercentage * 100) / 100,
                    statusCount,
                });
            } else {
                setStats(null);
            }
            showToast('✅ Données actualisées avec succès', 'success');
        } catch (error) {
            showToast('Erreur lors de l\'actualisation', 'error');
        } finally {
            setLoadingInvoices(false);
        }
    };

    // Get header content based on filters
    const getHeaderContent = useMemo(() => {
        const hasTypeFilter = typeFilter === 'purchase' || typeFilter === 'sale';
        const hasEntityFilter = !!entityIdFilter;

        if (hasEntityFilter && hasTypeFilter) {
            const entityType = typeFilter === 'purchase' ? 'fournisseur' : 'client';
            const entityDisplayName = entityName || `#${entityIdFilter}`;

            return {
                title: `Paiements ${entityType} - ${entityDisplayName}`,
                buttonText: `Ajouter un paiement ${entityType}`,
                buttonAction: () => {
                    if (typeFilter === 'purchase') {
                        router.push(`/payments/add?supplierId=${entityIdFilter}&type=purchase`);
                    } else {
                        router.push(`/payments/add?clientId=${entityIdFilter}&type=sale`);
                    }
                },
                showAddButton: true,
            };
        }

        if (hasTypeFilter) {
            const entityType = typeFilter === 'purchase' ? 'Fournisseurs' : 'Clients';
            return {
                title: `Paiements ${entityType}`,
                buttonText: 'Ajouter un paiement',
                buttonAction: () => router.push("/payments/add"),
                showAddButton: true,
            };
        }

        return {
            title: 'Liste des paiements',
            buttonText: 'Ajouter un paiement',
            buttonAction: () => router.push("/payments/add"),
            showAddButton: true,
        };
    }, [typeFilter, entityIdFilter, entityName, router]);

    // Render invoice details section
    const renderInvoiceDetails = () => {
        if (!invoiceData || invoiceData.length === 0 || !showInvoiceDetails) return null;

        const isPurchase = typeFilter === 'purchase';

        return (
            <div className="mb-6 space-y-4">
                {/* Summary Cards */}
                {stats && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
                        <div className="rounded-lg border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4">
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Factures</p>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.totalInvoices}</p>
                        </div>
                        <div className="rounded-lg border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4">
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Montant Total</p>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stats.totalAmount.toFixed(2)} TND</p>
                        </div>
                        <div className="rounded-lg border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4">
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Payé</p>
                            <p className="text-2xl font-semibold text-green-600 dark:text-green-400">{stats.totalPaid.toFixed(2)} TND</p>
                        </div>
                        <div className="rounded-lg border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4">
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Restant</p>
                            <p className={`text-2xl font-semibold ${stats.totalRemaining > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                {stats.totalRemaining.toFixed(2)} TND
                            </p>
                        </div>
                        <div className="rounded-lg border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4">
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Taux de Paiement</p>
                            <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400">{stats.paidPercentage}%</p>
                        </div>
                    </div>
                )}

                {/* Status Count Badges */}
                {stats && (
                    <div className="flex flex-wrap gap-3 items-center">
                        <span className="px-3 py-1.5 rounded-full text-sm bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            ✅ Payé: {stats.statusCount.PAID}
                        </span>
                        <span className="px-3 py-1.5 rounded-full text-sm bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                            ⏳ Partiel: {stats.statusCount.PARTIAL}
                        </span>
                        <span className="px-3 py-1.5 rounded-full text-sm bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                            ❌ Non payé: {stats.statusCount.UNPAID}
                        </span>
                        <button
                            onClick={refreshInvoices}
                            disabled={loadingInvoices}
                            className="ml-auto flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${loadingInvoices ? 'animate-spin' : ''}`} />
                            Actualiser
                        </button>
                    </div>
                )}

                {/* Invoices Table */}
                <div className="rounded-lg border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark overflow-hidden">
                    <div className="px-4 py-3 border-b border-stroke dark:border-strokedark flex justify-between items-center">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                            Détail des factures ({invoiceData.length})
                        </h3>
                        <button
                            onClick={() => setShowInvoiceDetails(false)}
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            <span className="text-sm">Masquer</span>
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        N° Facture
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Date
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Type
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Statut
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Total TTC
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Payé
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Restant
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Progression
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {invoiceData.map((invoice) => (
                                    <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => {
                                                    if (isPurchase) {
                                                        router.push(`/purchase-invoices/${invoice.id}`);
                                                    } else {
                                                        router.push(`/sale-invoices/${invoice.id}`);
                                                    }
                                                }}
                                                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                            >
                                                {invoice.invoiceNumber}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                            {new Date(invoice.date).toLocaleDateString('fr-FR')}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                                {invoice.type?.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs ${paymentStatusBadgeClasses[invoice.paymentStatus]}`}>
                                                {invoice.statusLabel}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                            {invoice.totalTTC.toFixed(2)} TND
                                        </td>
                                        <td className="px-4 py-3 text-green-600 dark:text-green-400 font-medium">
                                            {invoice.totalPaid.toFixed(2)} TND
                                        </td>
                                        <td className={`px-4 py-3 font-medium ${invoice.remainingAmount > 0
                                            ? 'text-red-600 dark:text-red-400'
                                            : 'text-green-600 dark:text-green-400'
                                            }`}>
                                            {invoice.remainingAmount.toFixed(2)} TND
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                                    <div
                                                        className={`h-2.5 rounded-full transition-all duration-500 ${invoice.paidPercentage === 100
                                                            ? 'bg-green-500'
                                                            : invoice.paidPercentage > 50
                                                                ? 'bg-yellow-500'
                                                                : 'bg-red-500'
                                                            }`}
                                                        style={{ width: `${invoice.paidPercentage}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[40px]">
                                                    {invoice.paidPercentage}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => {
                                                    if (isPurchase) {
                                                        router.push(`/purchase-invoices/${invoice.id}`);
                                                    } else {
                                                        router.push(`/sale-invoices/${invoice.id}`);
                                                    }
                                                }}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                                                title="Voir la facture"
                                            >
                                                <Eye className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {invoiceData.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                            Aucune facture trouvée
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    // Get filter display text
    const filterDisplayText = useMemo(() => {
        if (typeFilter === 'purchase' && entityName) {
            return `Fournisseur: ${entityName}`;
        } else if (typeFilter === 'sale' && entityName) {
            return `Client: ${entityName}`;
        } else if (typeFilter === 'purchase') {
            return 'Paiements Fournisseurs';
        } else if (typeFilter === 'sale') {
            return 'Paiements Clients';
        }
        return null;
    }, [typeFilter, entityName]);

    return (
        <Toast.Provider swipeDirection="right">
            <div className="p-6 min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
                <PageBreadcrumb pageTitle={getHeaderContent.title} />

                {/* Filter Banner */}
                {filterDisplayText && (
                    <div className="mb-4 flex items-center gap-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 border border-blue-200 dark:border-blue-800">
                        <Filter className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                            Filtré par: {filterDisplayText}
                        </span>
                        <button
                            onClick={clearFilters}
                            className="ml-auto flex items-center gap-1 rounded-md px-3 py-1 text-sm text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                        >
                            <X className="h-4 w-4" />
                            Effacer le filtre
                        </button>
                    </div>
                )}

                {/* Invoice Details Section */}
                {invoiceData.length > 0 && renderInvoiceDetails()}

                {/* Loading state for invoices */}
                {loadingInvoices && (
                    <div className="mb-6 flex items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-lg border border-stroke dark:border-strokedark">
                        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Chargement des factures...
                        </div>
                    </div>
                )}


                {/* Empty State */}
                {!loadingInvoices && invoiceData.length === 0 && entityIdFilter && (
                    <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-stroke dark:border-strokedark">
                        <div className="text-gray-500 dark:text-gray-400">
                            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p className="text-lg font-medium">Aucune facture trouvée</p>
                            <p className="text-sm">Aucune facture n&apos;a été trouvée pour cet {typeFilter === 'purchase' ? 'fournisseur' : 'client'}</p>
                        </div>
                    </div>
                )}

                <Toast.Root
                    open={toastOpen}
                    onOpenChange={setToastOpen}
                    className={`fixed top-4 right-4 w-96 max-w-full rounded-md p-4 shadow-lg z-50 ${toastType === "success"
                        ? "bg-green-600 dark:bg-green-700 text-white"
                        : "bg-red-600 dark:bg-red-700 text-white"
                        }`}
                    duration={3000}
                >
                    <Toast.Title className="font-bold">{toastMsg}</Toast.Title>
                </Toast.Root>
                <Toast.Viewport className="fixed top-4 right-4 w-96 max-w-full outline-none z-50" />
            </div>
        </Toast.Provider>
    );
}