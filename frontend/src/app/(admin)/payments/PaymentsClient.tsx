// src/app/payments/PaymentsClient.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Toast from "@radix-ui/react-toast";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, Building2, User, Filter, X } from "lucide-react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

type Payment = {
    id: number;
    amount: number;
    method: "CASH" | "CHECK" | "BANK_TRANSFER" | "CREDIT_CARD" | "MOBILE_PAYMENT";
    createdAt: string;
    purchaseInvoiceId?: number;
    saleInvoiceId?: number;
    supplierId?: number;
    clientId?: number;
    purchaseInvoice?: {
        id: number;
        invoiceNumber: string;
    };
    saleInvoice?: {
        id: number;
        invoiceNumber: string;
    };
    supplier?: {
        id: number;
        name: string;
        company?: string;
        code?: string;
    };
    client?: {
        id: number;
        name: string;
        company?: string;
        code?: string;
    };
};

interface PaymentSummary {
    totalPurchase: number;
    totalSale: number;
    netFlow: number;
    count: number;
}

interface PaymentsClientProps {
    typeFilter?: "purchase" | "sale";
    entityIdFilter?: string;
}

const fetchPayments = async (type?: string, entityId?: string): Promise<Payment[]> => {
    const params = new URLSearchParams();
    if (type && type !== 'all') {
        params.append('type', type);
    }
    if (entityId) {
        params.append('entityId', entityId);
    }

    const url = `${process.env.NEXT_PUBLIC_API_URL}payments${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Échec de la récupération des paiements");
    return response.json();
};

const deletePayment = async (id: number): Promise<void> => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}payments/${id}`, {
        method: "DELETE",
    });
    if (!response.ok) throw new Error("Échec de la suppression du paiement");
};

const paymentMethodLabels = {
    CASH: "Espèces",
    CHECK: "Chèque",
    BANK_TRANSFER: "Virement",
    CREDIT_CARD: "Carte",
    MOBILE_PAYMENT: "Mobile",
} as const;

const paymentMethodBadgeClasses = {
    CASH: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    CHECK: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    BANK_TRANSFER: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    CREDIT_CARD: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    MOBILE_PAYMENT: "bg-gray-100 text-gray-800 dark:bg-gray-700/30 dark:text-gray-300",
} as const;

export default function PaymentsClient({ typeFilter, entityIdFilter }: PaymentsClientProps) {
    const router = useRouter();
    const queryClient = useQueryClient();

    const [toastOpen, setToastOpen] = useState(false);
    const [toastMsg, setToastMsg] = useState("");
    const [toastType, setToastType] = useState<"success" | "error">("success");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
    const [summary, setSummary] = useState<PaymentSummary | null>(null);
    const [theme, setTheme] = useState<"light" | "dark">("light");
    const [entityName, setEntityName] = useState<string>("");

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

    // Fetch payments with filters
    const {
        data: payments = [],
        isLoading,
        isError,
        refetch,
    } = useQuery<Payment[]>({
        queryKey: ["payments", typeFilter, entityIdFilter],
        queryFn: () => fetchPayments(typeFilter, entityIdFilter),
    });

    // Extract entity name from payments data
    useEffect(() => {
        if (payments && payments.length > 0 && entityIdFilter) {
            const firstPayment = payments[0];
            if (typeFilter === 'purchase' && firstPayment?.supplier) {
                setEntityName(firstPayment.supplier.company || firstPayment.supplier.name);
            } else if (typeFilter === 'sale' && firstPayment?.client) {
                setEntityName(firstPayment.client.company || firstPayment.client.name);
            }
        } else {
            setEntityName("");
        }
    }, [payments, typeFilter, entityIdFilter]);

    // Calculate summary when payments change
    useEffect(() => {
        if (payments && payments.length > 0) {
            const purchasePayments = payments.filter((p) => p.purchaseInvoiceId);
            const salePayments = payments.filter((p) => p.saleInvoiceId);

            const totalPurchase = purchasePayments.reduce(
                (sum, p) => sum + p.amount,
                0
            );
            const totalSale = salePayments.reduce((sum, p) => sum + p.amount, 0);

            setSummary({
                totalPurchase,
                totalSale,
                netFlow: totalSale - totalPurchase,
                count: payments.length,
            });
        } else {
            setSummary(null);
        }
    }, [payments]);

    // Navigation helpers
    const handleAddPayment = () => {
        router.push("/payments/add");
    };

    const handleEdit = (payment: Payment) => {
        router.push(`/payments/edit/${payment.id}`);
    };

    const handleDelete = (payment: Payment) => {
        // Check if payment is older than 24 hours
        const paymentDate = new Date(payment.createdAt);
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
        const canDelete = paymentDate > twentyFourHoursAgo;

        if (!canDelete) {
            showToast(
                "Impossible de supprimer les paiements de plus de 24h",
                "error"
            );
            return;
        }

        setSelectedPayment(payment);
        setDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!selectedPayment) return;

        try {
            await deletePayment(selectedPayment.id);
            await refetch();
            queryClient.invalidateQueries({ queryKey: ["payments"] });
            showToast(`✅ Paiement supprimé avec succès`, "success");
        } catch (err) {
            showToast(`❌ ${err instanceof Error ? err.message : "Échec de la suppression"}`, "error");
        } finally {
            setDialogOpen(false);
            setSelectedPayment(null);
        }
    };

    const clearFilters = () => {
        router.push("/payments");
    };

    // Get header content based on filters
    const getHeaderContent = useMemo(() => {
        const hasTypeFilter = typeFilter === 'purchase' || typeFilter === 'sale';
        const hasEntityFilter = !!entityIdFilter;

        // If filtering by specific entity
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

        // If filtering by type only
        if (hasTypeFilter) {
            const entityType = typeFilter === 'purchase' ? 'Fournisseurs' : 'Clients';
            return {
                title: `Paiements ${entityType}`,
                buttonText: 'Ajouter un paiement',
                buttonAction: handleAddPayment,
                showAddButton: true,
            };
        }

        // Default - all payments
        return {
            title: 'Liste des paiements',
            buttonText: 'Ajouter un paiement',
            buttonAction: handleAddPayment,
            showAddButton: true,
        };
    }, [typeFilter, entityIdFilter, entityName, router]);

    const columns: MRT_ColumnDef<Payment>[] = [
        {
            accessorKey: "createdAt",
            header: "Date",
            size: 180,
            Cell: ({ cell }) => {
                const date = new Date(cell.getValue<string>());
                return date.toLocaleDateString("fr-FR", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                });
            },
        },
        {
            accessorKey: "type",
            header: "Type",
            size: 120,
            Cell: ({ row }) => {
                const isPurchase = !!row.original.purchaseInvoiceId;
                return (
                    <span
                        className={`px-2 py-1 rounded-full text-xs ${isPurchase
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                            : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            }`}
                    >
                        {isPurchase ? "Fournisseur" : "Client"}
                    </span>
                );
            },
        },
        {
            accessorKey: "amount",
            header: "Montant",
            size: 120,
            Cell: ({ cell }) => (
                <strong>{cell.getValue<number>().toFixed(2)} DH</strong>
            ),
        },
        {
            accessorKey: "method",
            header: "Méthode",
            size: 140,
            Cell: ({ cell }) => {
                const method = cell.getValue<keyof typeof paymentMethodLabels>();
                return (
                    <span
                        className={`px-2 py-1 rounded-full text-xs ${paymentMethodBadgeClasses[method]}`}
                    >
                        {paymentMethodLabels[method]}
                    </span>
                );
            },
        },
        {
            accessorKey: "invoice",
            header: "Facture",
            size: 150,
            Cell: ({ row }) => {
                const payment = row.original;
                if (payment.purchaseInvoice) {
                    return `FAC#${payment.purchaseInvoice.invoiceNumber}`;
                } else if (payment.saleInvoice) {
                    return `INV#${payment.saleInvoice.invoiceNumber}`;
                }
                return "-";
            },
        },
        {
            accessorKey: "entity",
            header: "Entité",
            size: 200,
            Cell: ({ row }) => {
                const payment = row.original;
                if (payment.supplier) {
                    return payment.supplier.company || payment.supplier.name;
                } else if (payment.client) {
                    return payment.client.company || payment.client.name;
                }
                return "-";
            },
        },
        {
            id: "actions",
            header: "Actions",
            size: 120,
            Cell: ({ row }) => {
                const payment = row.original;
                const paymentDate = new Date(payment.createdAt);
                const twentyFourHoursAgo = new Date();
                twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
                const canDelete = paymentDate > twentyFourHoursAgo;

                return (
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleEdit(row.original)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                            title="Modifier"
                        >
                            <Pencil className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => handleDelete(row.original)}
                            className={`p-1.5 rounded-md transition-colors ${canDelete
                                ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                                : "text-gray-400 dark:text-gray-600 cursor-not-allowed"
                                }`}
                            title={
                                canDelete
                                    ? "Supprimer"
                                    : "Impossible de supprimer les paiements de plus de 24h"
                            }
                            disabled={!canDelete}
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                );
            },
        },
    ];

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

                {/* Summary Cards */}
                {summary && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                        {/* Total Purchase Payments */}
                        <div className="rounded-lg border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                        Paiements Fournisseurs
                                    </p>
                                    <p className="text-2xl font-semibold text-red-600 dark:text-red-400">
                                        {summary.totalPurchase.toFixed(2)} DH
                                    </p>
                                </div>
                                <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                    <Building2 className="h-6 w-6 text-red-600 dark:text-red-400" />
                                </div>
                            </div>
                        </div>

                        {/* Total Sale Payments */}
                        <div className="rounded-lg border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                        Paiements Clients
                                    </p>
                                    <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
                                        {summary.totalSale.toFixed(2)} DH
                                    </p>
                                </div>
                                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                    <User className="h-6 w-6 text-green-600 dark:text-green-400" />
                                </div>
                            </div>
                        </div>

                        {/* Net Flow */}
                        <div className="rounded-lg border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                        Flux Net
                                    </p>
                                    <p className={`text-2xl font-semibold ${summary.netFlow >= 0
                                        ? "text-blue-600 dark:text-blue-400"
                                        : "text-red-600 dark:text-red-400"
                                        }`}>
                                        {summary.netFlow.toFixed(2)} DH
                                    </p>
                                </div>
                                <div className={`h-12 w-12 rounded-full ${summary.netFlow >= 0
                                    ? "bg-blue-100 dark:bg-blue-900/30"
                                    : "bg-red-100 dark:bg-red-900/30"
                                    } flex items-center justify-center`}>
                                    <svg
                                        className={`h-6 w-6 ${summary.netFlow >= 0
                                            ? "text-blue-600 dark:text-blue-400"
                                            : "text-red-600 dark:text-red-400"
                                            }`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                                        />
                                    </svg>
                                </div>
                            </div>
                        </div>

                        {/* Total Payments */}
                        <div className="rounded-lg border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                        Total Paiements
                                    </p>
                                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                        {summary.count}
                                    </p>
                                </div>
                                <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-700/30 flex items-center justify-center">
                                    <svg
                                        className="h-6 w-6 text-gray-600 dark:text-gray-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                        />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Quick Filter Buttons */}
                <div className="mb-4 flex flex-wrap gap-2">
                    <button
                        onClick={() => router.push("/payments")}
                        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${!typeFilter && !entityIdFilter
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                            }`}
                    >
                        Tous
                    </button>
                    <button
                        onClick={() => router.push("/payments?type=purchase")}
                        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${typeFilter === 'purchase' && !entityIdFilter
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                            }`}
                    >
                        Fournisseurs
                    </button>
                    <button
                        onClick={() => router.push("/payments?type=sale")}
                        className={`px-3 py-1.5 text-sm rounded-md transition-colors ${typeFilter === 'sale' && !entityIdFilter
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                            }`}
                    >
                        Clients
                    </button>
                </div>

                {/* Header with dynamic title and button */}
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {getHeaderContent.title}
                    </h2>
                    {getHeaderContent.showAddButton && (
                        <button
                            onClick={getHeaderContent.buttonAction}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-800 transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            {getHeaderContent.buttonText}
                        </button>
                    )}
                </div>

                {/* MaterialReactTable with dark mode support */}
                <div className="dark:bg-gray-800 dark:text-white rounded-lg overflow-hidden">
                    <MaterialReactTable
                        columns={columns}
                        data={payments}
                        enableColumnActions={true}
                        enableColumnFilters={true}
                        enablePagination={true}
                        enableSorting={true}
                        enableBottomToolbar={true}
                        enableTopToolbar={true}
                        muiTableBodyRowProps={{ hover: false }}
                        state={{
                            isLoading,
                        }}
                        initialState={{
                            pagination: { pageSize: 10, pageIndex: 0 },
                            sorting: [{ id: "createdAt", desc: true }],
                        }}
                        muiTablePaperProps={{
                            sx: {
                                backgroundColor: theme === "dark" ? "#1f2937" : "#ffffff",
                                color: theme === "dark" ? "#f3f4f6" : "#111827",
                            },
                        }}
                        muiTableHeadCellProps={{
                            sx: {
                                backgroundColor: theme === "dark" ? "#374151" : "#f9fafb",
                                color: theme === "dark" ? "#f3f4f6" : "#374151",
                                fontWeight: "bold",
                            },
                        }}
                        muiTableBodyCellProps={{
                            sx: {
                                borderBottomColor: theme === "dark" ? "#374151" : "#e5e7eb",
                                color: theme === "dark" ? "#f3f4f6" : "#111827",
                            },
                        }}
                        muiTopToolbarProps={{
                            sx: {
                                backgroundColor: theme === "dark" ? "#1f2937" : "#ffffff",
                                color: theme === "dark" ? "#f3f4f6" : "#111827",
                            },
                        }}
                        muiBottomToolbarProps={{
                            sx: {
                                backgroundColor: theme === "dark" ? "#1f2937" : "#ffffff",
                                color: theme === "dark" ? "#f3f4f6" : "#111827",
                            },
                        }}
                        muiPaginationProps={{
                            sx: {
                                color: theme === "dark" ? "#f3f4f6" : "#111827",
                                "& .MuiTablePagination-selectIcon": {
                                    color: theme === "dark" ? "#f3f4f6" : "#111827",
                                },
                                "& .MuiTablePagination-actions button": {
                                    color: theme === "dark" ? "#f3f4f6" : "#111827",
                                },
                            },
                        }}
                    />
                </div>

                {isError && (
                    <Toast.Root
                        open
                        className="bg-red-600 dark:bg-red-700 text-white px-4 py-2 rounded-md shadow-lg"
                    >
                        <Toast.Title>❌ Échec de la récupération des paiements</Toast.Title>
                    </Toast.Root>
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

                {/* Delete Confirmation Dialog */}
                <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
                    <Dialog.Portal>
                        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
                        <Dialog.Content className="fixed top-1/2 left-1/2 w-96 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg z-50 transition-colors duration-200">
                            <Dialog.Title className="text-lg font-bold text-gray-900 dark:text-white">
                                Confirmer la suppression
                            </Dialog.Title>
                            <Dialog.Description className="mt-2 text-gray-600 dark:text-gray-300">
                                Êtes-vous sûr de vouloir supprimer ce paiement de{" "}
                                <span className="font-semibold">
                                    {selectedPayment?.amount.toFixed(2)} DH
                                </span>
                                ?
                            </Dialog.Description>

                            <div className="mt-4 flex justify-end gap-2">
                                <button
                                    onClick={() => setDialogOpen(false)}
                                    className="px-4 py-2 rounded-md bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="px-4 py-2 rounded-md bg-red-500 dark:bg-red-600 text-white hover:bg-red-600 dark:hover:bg-red-700 transition-colors"
                                >
                                    Supprimer
                                </button>
                            </div>
                        </Dialog.Content>
                    </Dialog.Portal>
                </Dialog.Root>
            </div>
        </Toast.Provider>
    );
}