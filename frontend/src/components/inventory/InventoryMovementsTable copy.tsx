// components/inventory/InventoryMovementsTable.tsx
"use client";

import { useState } from "react";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Toast from "@radix-ui/react-toast";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { Pencil, Trash2, Eye, RefreshCw, Package, TrendingUp, TrendingDown, AlertTriangle, Plus } from "lucide-react";
import { format } from "date-fns";
import Select from "react-select";

type StockMovement = {
    id: number;
    movementNumber: string;
    type: "INBOUND" | "OUTBOUND" | "ADJUSTMENT" | "RETURN" | "LOSS" | "PURCHASE" | "SALE" | "TRANSFER" | "INITIAL";
    quantity: number;
    previousStock: number;
    newStock: number;
    reason: string;
    notes?: string;
    status: "PENDING" | "COMPLETED" | "CANCELLED";
    createdAt: string;
    user?: {
        id: number;
        email: string;
        firstName: string;
        lastName: string;
    };
    product: {
        id: number;
        name: string;
        reference: string;
    };
};

type LastMovementPerProduct = {
    product: {
        id: number;
        name: string;
        reference: string;
        internalCode: string;
        description?: string;
        currentStock: number;
        minStock: number;
        criticalStock: number;
        reservedStock: number;
        purchasePrice: number;
        salePrice: number;
        priceIncludingTax: number;
        category: {
            id: number;
            name: string;
        } | null;
        brand: {
            id: number;
            name: string;
            img?: string;
        } | null;
        isActive: boolean;
    };
    lastMovement: {
        id: number;
        movementNumber: string;
        type: string;
        quantity: number;
        previousStock: number;
        newStock: number;
        reason: string;
        reference?: string;
        status: string;
        notes?: string;
        createdAt: string;
        user: {
            id: number;
            email: string;
            firstName: string;
            lastName: string;
            role: string;
        } | null;
    } | null;
    hasMovements: boolean;
    stockStatus: "OUT_OF_STOCK" | "CRITICAL" | "LOW" | "OK";
};

type MovementSummary = {
    totalProducts: number;
    productsWithMovements: number;
    productsWithoutMovements: number;
    stockStatusSummary: {
        outOfStock: number;
        critical: number;
        low: number;
        ok: number;
    };
    data: LastMovementPerProduct[];
};

const fetchMovements = async (params?: {
    page?: number;
    limit?: number;
}): Promise<{ movements: StockMovement[]; total: number }> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const url = `${process.env.NEXT_PUBLIC_API_URL}inventory/movements${queryParams.toString() ? `?${queryParams}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch movements");
    return res.json();
};

const fetchLastMovementPerProduct = async (): Promise<MovementSummary> => {
    const url = `${process.env.NEXT_PUBLIC_API_URL}inventory/movements/last-per-product/summary`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch last movements per product");
    return res.json();
};

const updateMovementStatus = async (id: number, status: string) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}inventory/movements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error("Failed to update movement");
    return res.json();
};

const cancelMovement = async (id: number, reason?: string) => {
    const url = `${process.env.NEXT_PUBLIC_API_URL}inventory/movements/${id}${reason ? `?reason=${encodeURIComponent(reason)}` : ""}`;
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to cancel movement");
    return res.json();
};

const createMovement = async (data: any) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}inventory/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create movement");
    return res.json();
};

// Type guard to check if movement is StockMovement
function isStockMovement(movement: StockMovement | LastMovementPerProduct): movement is StockMovement {
    return 'movementNumber' in movement;
}

interface EditMovementModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    product: LastMovementPerProduct['product'];
    onSuccess?: () => void;
}

function EditMovementModal({ open, onOpenChange, product, onSuccess }: EditMovementModalProps) {
    const queryClient = useQueryClient();
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMsg, setToastMsg] = useState("");
    const [newQuantity, setNewQuantity] = useState(product.currentStock);
    const [reason, setReason] = useState("");
    const [notes, setNotes] = useState("");
    const [reference, setReference] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const showToast = (msg: string) => {
        setToastMsg(msg);
        setToastOpen(true);
    };

    // Auto-detect movement type based on quantity difference
    const getMovementType = () => {
        const difference = newQuantity - product.currentStock;
        if (difference > 0) return "INBOUND";
        if (difference < 0) return "OUTBOUND";
        return "ADJUSTMENT";
    };

    const getQuantity = () => {
        return Math.abs(newQuantity - product.currentStock);
    };

    const getDifference = () => {
        return newQuantity - product.currentStock;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const difference = getDifference();

        if (difference === 0) {
            showToast("No change in quantity");
            return;
        }

        /* if (!reason) {
            showToast("Please provide a reason");
            return;
        } */

        setIsSubmitting(true);

        const movementData = {
            productId: product.id,
            type: getMovementType(),
            quantity: getQuantity(),
            reason: reason,
            notes: notes,
            reference: reference,
        };

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}inventory/movements`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(movementData),
            });

            if (!res.ok) throw new Error("Failed to create movement");

            queryClient.invalidateQueries({ queryKey: ["last-movement-per-product"] });
            queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
            showToast(`✅ Stock updated from ${product.currentStock} to ${newQuantity}`);

            // Reset form
            setNewQuantity(product.currentStock);
            setReason("");
            setNotes("");
            setReference("");

            onSuccess?.();
            onOpenChange(false);
        } catch (err) {
            showToast("❌ Failed to update stock");
        } finally {
            setIsSubmitting(false);
        }
    };

    const difference = getDifference();
    const movementType = getMovementType();
    const quantity = getQuantity();

    return (
        <>
            <Dialog.Root open={open} onOpenChange={onOpenChange}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
                    <Dialog.Content className="fixed top-1/2 left-1/2 w-[550px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg z-50 transition-colors duration-200">
                        <Dialog.Title className="text-lg font-bold text-gray-900 dark:text-white">
                            Update Stock - {product.name}
                        </Dialog.Title>
                        <Dialog.Description className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Reference: {product.reference} | Current Stock: {product.currentStock}
                        </Dialog.Description>

                        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                            {/* Current Stock Info */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                            Current Stock
                                        </label>
                                        <p className={`text-xl font-bold ${product.currentStock <= product.criticalStock
                                            ? "text-red-600 dark:text-red-400"
                                            : product.currentStock <= product.minStock
                                                ? "text-yellow-600 dark:text-yellow-400"
                                                : "text-green-600 dark:text-green-400"
                                            }`}>
                                            {product.currentStock}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                            Min / Critical Stock
                                        </label>
                                        <p className="text-gray-900 dark:text-white">
                                            {product.minStock} / {product.criticalStock}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* New Quantity Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    New Quantity *
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={newQuantity}
                                    onChange={(e) => setNewQuantity(parseInt(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                                {difference !== 0 && (
                                    <div className={`mt-2 p-2 rounded-md ${difference > 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                                        <p className={`text-sm font-medium ${difference > 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                            {difference > 0 ? '📦 INBOUND' : '🚚 OUTBOUND'} -
                                            {difference > 0 ? ' Adding ' : ' Removing '}
                                            <span className="font-bold">{quantity}</span> unit(s)
                                        </p>
                                        <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">
                                            Stock will change from <span className="font-semibold">{product.currentStock}</span> to{' '}
                                            <span className={`font-semibold ${newQuantity <= product.criticalStock ? 'text-red-600' : ''}`}>
                                                {newQuantity}
                                            </span>
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Reason
                                </label>
                                <input
                                    type="text"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Why is the stock being updated?"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-2 pt-4">
                                <button
                                    type="button"
                                    onClick={() => onOpenChange(false)}
                                    className="px-4 py-2 rounded-md bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || difference === 0}
                                    className="px-4 py-2 rounded-md bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSubmitting ? (
                                        "Processing..."
                                    ) : (
                                        <>
                                            <Plus className="w-4 h-4" />
                                            Update Stock
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            <Toast.Provider swipeDirection="right">
                <Toast.Root
                    open={toastOpen}
                    onOpenChange={setToastOpen}
                    className="bg-gray-900 dark:bg-gray-800 text-white px-4 py-2 rounded-md shadow-lg"
                >
                    <Toast.Title className="font-bold">{toastMsg}</Toast.Title>
                </Toast.Root>
                <Toast.Viewport className="fixed top-4 right-4 w-96 max-w-full outline-none z-50" />
            </Toast.Provider>
        </>
    );
}

export default function InventoryMovementsTable() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState("last-per-product");
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMsg, setToastMsg] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [viewDialogOpen, setViewDialogOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedMovement, setSelectedMovement] = useState<StockMovement | LastMovementPerProduct | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<LastMovementPerProduct['product'] | null>(null);
    const [theme] = useState<"light" | "dark">("light");

    const showToast = (msg: string) => {
        setToastMsg(msg);
        setToastOpen(true);
    };

    // Query for all movements (paginated)
    const {
        data: movementsData,
        isLoading: movementsLoading,
        isError: movementsError,
        refetch: refetchMovements,
    } = useQuery({
        queryKey: ["inventory-movements", pagination],
        queryFn: () => fetchMovements({
            page: pagination.pageIndex + 1,
            limit: pagination.pageSize,
        }),
        enabled: activeTab === "all-movements",
    });

    // Query for last movement per product
    const {
        data: lastMovementData,
        isLoading: lastMovementLoading,
        isError: lastMovementError,
        refetch: refetchLastMovements,
    } = useQuery({
        queryKey: ["last-movement-per-product"],
        queryFn: () => fetchLastMovementPerProduct(),
        enabled: activeTab === "last-per-product",
    });

    const handleView = (movement: StockMovement | LastMovementPerProduct) => {
        setSelectedMovement(movement);
        setViewDialogOpen(true);
    };

    const handleEdit = (product: LastMovementPerProduct['product']) => {
        setSelectedProduct(product);
        setEditModalOpen(true);
    };

    const handleCancel = (movement: StockMovement) => {
        setSelectedMovement(movement);
        setDialogOpen(true);
    };

    const confirmCancel = async () => {
        if (!selectedMovement || !isStockMovement(selectedMovement)) return;

        try {
            await cancelMovement(selectedMovement.id, "Cancelled by user");
            await refetchMovements();
            queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
            queryClient.invalidateQueries({ queryKey: ["last-movement-per-product"] });
            showToast(`✅ Movement ${selectedMovement.movementNumber} cancelled`);
        } catch (err) {
            showToast("❌ Failed to cancel movement");
        } finally {
            setDialogOpen(false);
            setSelectedMovement(null);
        }
    };

    const getStockStatusColor = (status: string) => {
        const colors = {
            OUT_OF_STOCK: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
            CRITICAL: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300",
            LOW: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
            OK: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
        };
        return colors[status as keyof typeof colors] || colors.OK;
    };

    // Columns for All Movements tab
    const movementColumns: MRT_ColumnDef<StockMovement>[] = [
        {
            accessorKey: "movementNumber",
            header: "Movement #",
            size: 150,
        },
        {
            accessorKey: "type",
            header: "Type",
            size: 120,
            Cell: ({ cell }) => {
                const type = cell.getValue() as string;
                const colors: Record<string, string> = {
                    INBOUND: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
                    OUTBOUND: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
                    ADJUSTMENT: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
                    RETURN: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
                    LOSS: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300",
                    PURCHASE: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300",
                    SALE: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300",
                    TRANSFER: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300",
                    INITIAL: "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300",
                };
                return (
                    <span className={`px-2 py-1 rounded-full text-xs ${colors[type] || "bg-gray-100"}`}>
                        {type}
                    </span>
                );
            },
        },
        {
            accessorKey: "product.name",
            header: "Product",
            size: 200,
        },
        {
            accessorKey: "quantity",
            header: "Quantity",
            size: 100,
            Cell: ({ cell, row }) => {
                const quantity = cell.getValue() as number;
                const type = row.original.type;
                const isOutbound = type === "OUTBOUND" || type === "SALE" || type === "LOSS";
                return (
                    <span className={isOutbound ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>
                        {quantity > 0 ? `+${quantity}` : quantity}
                    </span>
                );
            },
        },
        {
            accessorKey: "previousStock",
            header: "Old Stock",
            size: 100,
        },
        {
            accessorKey: "newStock",
            header: "New Stock",
            size: 100,
        },
        {
            accessorKey: "status",
            header: "Status",
            size: 120,
            Cell: ({ cell }) => {
                const status = cell.getValue() as string;
                const colors: Record<string, string> = {
                    COMPLETED: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
                    PENDING: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
                    CANCELLED: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
                };
                return (
                    <span className={`px-2 py-1 rounded-full text-xs ${colors[status] || "bg-gray-100"}`}>
                        {status}
                    </span>
                );
            },
        },
        {
            accessorKey: "reason",
            header: "Reason",
            size: 250,
        },
        {
            accessorKey: "createdAt",
            header: "Date",
            size: 180,
            Cell: ({ cell }) => format(new Date(cell.getValue() as string), "dd/MM/yyyy HH:mm"),
        },
        {
            id: "actions",
            header: "Actions",
            size: 120,
            Cell: ({ row }) => (
                <div className="flex gap-2">
                    <button
                        onClick={() => handleView(row.original)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                        title="View Details"
                    >
                        <Eye className="w-5 h-5" />
                    </button>
                    {row.original.status !== "CANCELLED" && (
                        <button
                            onClick={() => handleCancel(row.original)}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                            title="Cancel Movement"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}
                </div>
            ),
        },
    ];

    // Columns for Last Movement Per Product tab
    const lastMovementColumns: MRT_ColumnDef<LastMovementPerProduct>[] = [
        {
            accessorKey: "product.name",
            header: "Product",
            size: 200,
            Cell: ({ row }) => (
                <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                        {row.original.product.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        Ref: {row.original.product.reference}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: "previousStock",
            header: "Old Stock",
            size: 100,
            Cell: ({ row }) => (
                <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                        {row.original.lastMovement ? row.original.lastMovement.previousStock : 0}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: "product.currentStock",
            header: "Current Stock",
            size: 120,
            Cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <span className={`font-semibold ${row.original.product.currentStock <= row.original.product.criticalStock
                        ? "text-red-600 dark:text-red-400"
                        : row.original.product.currentStock <= row.original.product.minStock
                            ? "text-yellow-600 dark:text-yellow-400"
                            : "text-green-600 dark:text-green-400"
                        }`}>
                        {row.original.product.currentStock}
                    </span>
                    {row.original.stockStatus !== "OK" && (
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    )}
                </div>
            ),
        },
        {
            accessorKey: "stockStatus",
            header: "Stock Status",
            size: 120,
            Cell: ({ row }) => (
                <span className={`px-2 py-1 rounded-full text-xs ${getStockStatusColor(row.original.stockStatus)}`}>
                    {row.original.stockStatus.replace("_", " ")}
                </span>
            ),
        },
        {
            accessorKey: "lastMovement",
            header: "Last Movement",
            size: 180,
            Cell: ({ row }) => {
                const movement = row.original.lastMovement;
                if (!movement) return <span className="text-gray-400">No movements</span>;
                return (
                    <div>
                        <div className="flex items-center gap-1">
                            {movement.quantity > 0 ? (
                                <TrendingUp className="w-4 h-4 text-green-600" />
                            ) : (
                                <TrendingDown className="w-4 h-4 text-red-600" />
                            )}
                            <span className={movement.quantity > 0 ? "text-green-600" : "text-red-600"}>
                                {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
                            </span>
                        </div>
                        <div className="text-xs text-gray-500">
                            {format(new Date(movement.createdAt), "dd/MM/yyyy HH:mm")}
                        </div>
                    </div>
                );
            },
        },
        {
            accessorKey: "lastMovement.type",
            header: "Movement Type",
            size: 120,
            Cell: ({ row }) => {
                const movement = row.original.lastMovement;
                if (!movement) return <span className="text-gray-400">-</span>;
                return (
                    <span className="px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700">
                        {movement.type}
                    </span>
                );
            },
        },
        {
            accessorKey: "product.minStock",
            header: "Min Stock",
            size: 80,
            Cell: ({ row }) => (
                <span className="text-gray-600 dark:text-gray-400">
                    {row.original.product.minStock}
                </span>
            ),
        },
        {
            accessorKey: "product.criticalStock",
            header: "Critical",
            size: 80,
            Cell: ({ row }) => (
                <span className="text-gray-600 dark:text-gray-400">
                    {row.original.product.criticalStock}
                </span>
            ),
        },
        {
            id: "actions",
            header: "Actions",
            size: 120,
            Cell: ({ row }) => (
                <div className="flex gap-2">
                    <button
                        onClick={() => handleView(row.original)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                        title="View Details"
                    >
                        <Eye className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => handleEdit(row.original.product)}
                        className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-md transition-colors"
                        title="Update Stock"
                    >
                        <Pencil className="w-5 h-5" />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <Toast.Provider swipeDirection="right">
            <div className="p-6 min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Stock Management
                    </h1>
                    <button
                        onClick={() => {
                            if (activeTab === "all-movements") {
                                refetchMovements();
                            } else {
                                refetchLastMovements();
                            }
                        }}
                        className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>

                {/* Tabs */}
                <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="mb-6">
                    <Tabs.List className="flex space-x-2 border-b border-gray-200 dark:border-gray-700">
                        <Tabs.Trigger
                            value="last-per-product"
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400"
                        >
                            Last Movement Per Product
                            {lastMovementData && (
                                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-700">
                                    {lastMovementData.totalProducts} products
                                </span>
                            )}
                        </Tabs.Trigger>
                        <Tabs.Trigger
                            value="all-movements"
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400"
                        >
                            All Movements
                        </Tabs.Trigger>
                    </Tabs.List>

                    {/* All Movements Tab Content */}
                    <Tabs.Content value="all-movements" className="mt-4">
                        <div className="dark:bg-gray-800 dark:text-white rounded-lg overflow-hidden">
                            <MaterialReactTable
                                columns={movementColumns}
                                data={movementsData?.movements || []}
                                enableColumnActions={true}
                                enableColumnFilters={true}
                                enablePagination={true}
                                enableSorting={true}
                                enableBottomToolbar={true}
                                enableTopToolbar={true}
                                muiTableBodyRowProps={{ hover: false }}
                                state={{
                                    isLoading: movementsLoading,
                                    pagination,
                                }}
                                onPaginationChange={setPagination}
                                rowCount={movementsData?.total || 0}
                                manualPagination={true}
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
                    </Tabs.Content>

                    {/* Last Movement Per Product Tab Content */}
                    <Tabs.Content value="last-per-product" className="mt-4">
                        {/* Summary Cards */}
                        {lastMovementData && (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Total Products</p>
                                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                                {lastMovementData.totalProducts}
                                            </p>
                                        </div>
                                        <Package className="w-8 h-8 text-blue-500" />
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">With Movements</p>
                                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                                {lastMovementData.productsWithMovements}
                                            </p>
                                        </div>
                                        <TrendingUp className="w-8 h-8 text-green-500" />
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Low/Critical Stock</p>
                                            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                                                {lastMovementData.stockStatusSummary.low + lastMovementData.stockStatusSummary.critical}
                                            </p>
                                        </div>
                                        <AlertTriangle className="w-8 h-8 text-yellow-500" />
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Out of Stock</p>
                                            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                                                {lastMovementData.stockStatusSummary.outOfStock}
                                            </p>
                                        </div>
                                        <TrendingDown className="w-8 h-8 text-red-500" />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="dark:bg-gray-800 dark:text-white rounded-lg overflow-hidden">
                            <MaterialReactTable
                                columns={lastMovementColumns}
                                data={lastMovementData?.data || []}
                                enableColumnActions={true}
                                enableColumnFilters={true}
                                enablePagination={true}
                                enableSorting={true}
                                enableBottomToolbar={true}
                                enableTopToolbar={true}
                                muiTableBodyRowProps={{ hover: false }}
                                state={{
                                    isLoading: lastMovementLoading,
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
                    </Tabs.Content>
                </Tabs.Root>

                {(movementsError || lastMovementError) && (
                    <Toast.Root
                        open
                        className="bg-red-600 dark:bg-red-700 text-white px-4 py-2 rounded-md shadow-lg"
                    >
                        <Toast.Title>❌ Failed to fetch data</Toast.Title>
                    </Toast.Root>
                )}

                <Toast.Root
                    open={toastOpen}
                    onOpenChange={setToastOpen}
                    className="bg-gray-900 dark:bg-gray-800 text-white px-4 py-2 rounded-md shadow-lg"
                >
                    <Toast.Title className="font-bold">{toastMsg}</Toast.Title>
                </Toast.Root>
                <Toast.Viewport className="fixed top-4 right-4 w-96 max-w-full outline-none z-50" />

                {/* Edit Movement Modal */}
                {selectedProduct && (
                    <EditMovementModal
                        open={editModalOpen}
                        onOpenChange={setEditModalOpen}
                        product={selectedProduct}
                        onSuccess={() => {
                            refetchLastMovements();
                            refetchMovements();
                        }}
                    />
                )}

                {/* View Details Dialog */}
                <Dialog.Root open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
                    <Dialog.Portal>
                        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
                        <Dialog.Content className="fixed top-1/2 left-1/2 w-[600px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg z-50 transition-colors duration-200">
                            <Dialog.Title className="text-lg font-bold text-gray-900 dark:text-white">
                                Movement Details
                            </Dialog.Title>

                            {selectedMovement && (
                                <div className="mt-4 space-y-4">
                                    {isStockMovement(selectedMovement) ? (
                                        // StockMovement details
                                        <>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                        Movement #
                                                    </label>
                                                    <p className="font-mono text-gray-900 dark:text-white">
                                                        {selectedMovement.movementNumber}
                                                    </p>
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                        Status
                                                    </label>
                                                    <div>
                                                        <span className={`inline-block px-2 py-1 rounded-full text-xs ${selectedMovement.status === "COMPLETED"
                                                            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                                                            : selectedMovement.status === "PENDING"
                                                                ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
                                                                : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                                                            }`}>
                                                            {selectedMovement.status}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                        Product
                                                    </label>
                                                    <p className="text-gray-900 dark:text-white">
                                                        {selectedMovement.product?.name}
                                                    </p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        Ref: {selectedMovement.product?.reference}
                                                    </p>
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                        Type
                                                    </label>
                                                    <p className="text-gray-900 dark:text-white">
                                                        {selectedMovement.type}
                                                    </p>
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                        Quantity
                                                    </label>
                                                    <p className={`font-semibold ${selectedMovement.type === "OUTBOUND"
                                                        ? "text-red-600 dark:text-red-400"
                                                        : "text-green-600 dark:text-green-400"
                                                        }`}>
                                                        {selectedMovement.quantity > 0 ? `+${selectedMovement.quantity}` : selectedMovement.quantity}
                                                    </p>
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                        Stock Change
                                                    </label>
                                                    <p className="text-gray-900 dark:text-white">
                                                        {selectedMovement.previousStock} → {selectedMovement.newStock}
                                                        <span className={`text-sm ml-2 ${selectedMovement.newStock - selectedMovement.previousStock > 0
                                                            ? "text-green-600"
                                                            : "text-red-600"
                                                            }`}>
                                                            ({selectedMovement.newStock - selectedMovement.previousStock > 0 ? "+" : ""}
                                                            {selectedMovement.newStock - selectedMovement.previousStock})
                                                        </span>
                                                    </p>
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                        Reason
                                                    </label>
                                                    <p className="text-gray-900 dark:text-white">
                                                        {selectedMovement.reason}
                                                    </p>
                                                </div>
                                                {selectedMovement.notes && (
                                                    <div className="col-span-2">
                                                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                            Notes
                                                        </label>
                                                        <p className="text-gray-900 dark:text-white">
                                                            {selectedMovement.notes}
                                                        </p>
                                                    </div>
                                                )}
                                                <div className="col-span-2">
                                                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                        Created At
                                                    </label>
                                                    <p className="text-gray-900 dark:text-white">
                                                        {format(new Date(selectedMovement.createdAt), "dd/MM/yyyy HH:mm:ss")}
                                                    </p>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        // LastMovementPerProduct details
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                    Product
                                                </label>
                                                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                                    {selectedMovement.product.name}
                                                </p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    Reference: {selectedMovement.product.reference}
                                                </p>
                                                {selectedMovement.product.internalCode && (
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        Internal Code: {selectedMovement.product.internalCode}
                                                    </p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                    Current Stock
                                                </label>
                                                <p className={`text-xl font-bold ${selectedMovement.product.currentStock <= selectedMovement.product.criticalStock
                                                    ? "text-red-600 dark:text-red-400"
                                                    : selectedMovement.product.currentStock <= selectedMovement.product.minStock
                                                        ? "text-yellow-600 dark:text-yellow-400"
                                                        : "text-green-600 dark:text-green-400"
                                                    }`}>
                                                    {selectedMovement.product.currentStock}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                    Stock Status
                                                </label>
                                                <div>
                                                    <span className={`inline-block px-2 py-1 rounded-full text-xs ${getStockStatusColor(selectedMovement.stockStatus)}`}>
                                                        {selectedMovement.stockStatus.replace("_", " ")}
                                                    </span>
                                                </div>
                                            </div>
                                            {selectedMovement.lastMovement && (
                                                <>
                                                    <div>
                                                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                            Last Movement #
                                                        </label>
                                                        <p className="font-mono text-sm text-gray-900 dark:text-white">
                                                            {selectedMovement.lastMovement.movementNumber}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                            Last Movement Date
                                                        </label>
                                                        <p className="text-gray-900 dark:text-white">
                                                            {format(new Date(selectedMovement.lastMovement.createdAt), "dd/MM/yyyy HH:mm:ss")}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                            Last Quantity
                                                        </label>
                                                        <p className={selectedMovement.lastMovement.quantity > 0 ? "text-green-600" : "text-red-600"}>
                                                            {selectedMovement.lastMovement.quantity > 0 ? `+${selectedMovement.lastMovement.quantity}` : selectedMovement.lastMovement.quantity}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                            Stock Change
                                                        </label>
                                                        <p className="text-gray-900 dark:text-white">
                                                            {selectedMovement.lastMovement.previousStock} → {selectedMovement.lastMovement.newStock}
                                                        </p>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                            Reason
                                                        </label>
                                                        <p className="text-gray-900 dark:text-white">
                                                            {selectedMovement.lastMovement.reason}
                                                        </p>
                                                    </div>
                                                </>
                                            )}
                                            {!selectedMovement.hasMovements && (
                                                <div className="col-span-2">
                                                    <p className="text-yellow-600 dark:text-yellow-400">
                                                        This product has no stock movements yet
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="mt-6 flex justify-end">
                                <button
                                    onClick={() => setViewDialogOpen(false)}
                                    className="px-4 py-2 rounded-md bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </Dialog.Content>
                    </Dialog.Portal>
                </Dialog.Root>

                {/* Cancel Confirmation Dialog */}
                <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
                    <Dialog.Portal>
                        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
                        <Dialog.Content className="fixed top-1/2 left-1/2 w-96 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg z-50 transition-colors duration-200">
                            <Dialog.Title className="text-lg font-bold text-gray-900 dark:text-white">
                                Confirm Cancel
                            </Dialog.Title>
                            <Dialog.Description className="mt-2 text-gray-600 dark:text-gray-300">
                                Are you sure you want to cancel movement{" "}
                                <span className="font-semibold">
                                    {selectedMovement && isStockMovement(selectedMovement)
                                        ? selectedMovement.movementNumber
                                        : ""}
                                </span>
                                ?
                            </Dialog.Description>

                            <div className="mt-4 flex justify-end gap-2">
                                <button
                                    onClick={() => setDialogOpen(false)}
                                    className="px-4 py-2 rounded-md bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmCancel}
                                    className="px-4 py-2 rounded-md bg-red-500 dark:bg-red-600 text-white hover:bg-red-600 dark:hover:bg-red-700 transition-colors"
                                >
                                    Yes, Cancel Movement
                                </button>
                            </div>
                        </Dialog.Content>
                    </Dialog.Portal>
                </Dialog.Root>
            </div>
        </Toast.Provider>
    );
}