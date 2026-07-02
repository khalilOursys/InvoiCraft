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
const movementTypeLabels: Record<string, string> = {
    "INBOUND": "Entrée",
    "OUTBOUND": "Sortie",
    "ADJUSTMENT": "Ajustement",
    "RETURN": "Retour",
    "LOSS": "Perte",
    "TRANSFER": "Transfert",
    "INITIAL": "Initial",
    "PURCHASE": "Achat",
    "SALE": "Vente"
};
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
    if (!res.ok) throw new Error("Échec du chargement des mouvements");
    return res.json();
};

const fetchLastMovementPerProduct = async (): Promise<MovementSummary> => {
    const url = `${process.env.NEXT_PUBLIC_API_URL}inventory/movements/last-per-product/summary`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Échec du chargement des derniers mouvements par produit");
    return res.json();
};

const updateMovementStatus = async (id: number, status: string) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}inventory/movements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error("Échec de la mise à jour du mouvement");
    return res.json();
};

const cancelMovement = async (id: number, reason?: string) => {
    const url = `${process.env.NEXT_PUBLIC_API_URL}inventory/movements/${id}${reason ? `?reason=${encodeURIComponent(reason)}` : ""}`;
    const res = await fetch(url, { method: "DELETE" });
    if (!res.ok) throw new Error("Échec de l'annulation du mouvement");
    return res.json();
};

const createMovement = async (data: any) => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}inventory/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Échec de la création du mouvement");
    return res.json();
};

// Vérification de type pour savoir si le mouvement est de type StockMovement
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

    // Détection automatique du type de mouvement basé sur la différence de quantité
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
            showToast("Aucun changement de quantité");
            return;
        }

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

            if (!res.ok) throw new Error("Échec de la création du mouvement");

            queryClient.invalidateQueries({ queryKey: ["last-movement-per-product"] });
            queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
            showToast(`✅ Stock mis à jour de ${product.currentStock} à ${newQuantity}`);

            // Réinitialisation du formulaire
            setNewQuantity(product.currentStock);
            setReason("");
            setNotes("");
            setReference("");

            onSuccess?.();
            onOpenChange(false);
        } catch (err) {
            showToast("❌ Échec de la mise à jour du stock");
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
                            Mettre à jour le stock - {product.name}
                        </Dialog.Title>
                        <Dialog.Description className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Référence : {product.reference} | Stock actuel : {product.currentStock}
                        </Dialog.Description>

                        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                            {/* Informations sur le stock actuel */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                            Stock actuel
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
                                            Stock min / Critique
                                        </label>
                                        <p className="text-gray-900 dark:text-white">
                                            {product.minStock} / {product.criticalStock}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Champ Nouvelle Quantité */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Nouvelle quantité *
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
                                            {difference > 0 ? '📦 ENTRÉE' : '🚚 SORTIE'} -
                                            {difference > 0 ? ' Ajout de ' : ' Retrait de '}
                                            <span className="font-bold">{quantity}</span> unité(s)
                                        </p>
                                        <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">
                                            Le stock passera de <span className="font-semibold">{product.currentStock}</span> à{' '}
                                            <span className={`font-semibold ${newQuantity <= product.criticalStock ? 'text-red-600' : ''}`}>
                                                {newQuantity}
                                            </span>
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Raison */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Raison
                                </label>
                                <input
                                    type="text"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Pourquoi le stock est-il mis à jour ?"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-2 pt-4">
                                <button
                                    type="button"
                                    onClick={() => onOpenChange(false)}
                                    className="px-4 py-2 rounded-md bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || difference === 0}
                                    className="px-4 py-2 rounded-md bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSubmitting ? (
                                        "Traitement..."
                                    ) : (
                                        <>
                                            <Plus className="w-4 h-4" />
                                            Mettre à jour le stock
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

    // Requête pour tous les mouvements (paginated)
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

    // Requête pour le dernier mouvement par produit
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
            await cancelMovement(selectedMovement.id, "Annulé par l'utilisateur");
            await refetchMovements();
            queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
            queryClient.invalidateQueries({ queryKey: ["last-movement-per-product"] });
            showToast(`✅ Mouvement ${selectedMovement.movementNumber} annulé`);
        } catch (err) {
            showToast("❌ Échec de l'annulation du mouvement");
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

    // Colonnes pour l'onglet Tous les mouvements
    const movementColumns: MRT_ColumnDef<StockMovement>[] = [
        {
            accessorKey: "movementNumber",
            header: "Mouvement #",
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
                        {movementTypeLabels[type] || type}
                    </span>
                );
            },
        },
        {
            accessorKey: "product.name",
            header: "Produit",
            size: 200,
        },
        {
            accessorKey: "quantity",
            header: "Quantité",
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
            header: "Ancien stock",
            size: 100,
        },
        {
            accessorKey: "newStock",
            header: "Nouveau stock",
            size: 100,
        },
        {
            accessorKey: "status",
            header: "Statut",
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
            header: "Raison",
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
                        title="Voir les détails"
                    >
                        <Eye className="w-5 h-5" />
                    </button>
                    {row.original.status !== "CANCELLED" && (
                        <button
                            onClick={() => handleCancel(row.original)}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                            title="Annuler le mouvement"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}
                </div>
            ),
        },
    ];

    // Colonnes pour l'onglet Dernier mouvement par produit
    const lastMovementColumns: MRT_ColumnDef<LastMovementPerProduct>[] = [
        {
            accessorKey: "product.name",
            header: "Produit",
            size: 200,
            Cell: ({ row }) => (
                <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                        {row.original.product.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        Réf : {row.original.product.reference}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: "previousStock",
            header: "Ancien stock",
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
            header: "Stock actuel",
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
            header: "État du stock",
            size: 120,
            Cell: ({ row }) => (
                <span className={`px-2 py-1 rounded-full text-xs ${getStockStatusColor(row.original.stockStatus)}`}>
                    {row.original.stockStatus === "OUT_OF_STOCK" ? "RUPTURE" :
                        row.original.stockStatus === "CRITICAL" ? "CRITIQUE" :
                            row.original.stockStatus === "LOW" ? "BAS" : "OK"}
                </span>
            ),
        },
        {
            accessorKey: "lastMovement",
            header: "Dernier mouvement",
            size: 180,
            Cell: ({ row }) => {
                const movement = row.original.lastMovement;
                if (!movement) return <span className="text-gray-400">Aucun mouvement</span>;
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
            header: "Type de mouvement",
            size: 120,
            Cell: ({ row }) => {
                const movement = row.original.lastMovement;
                if (!movement) return <span className="text-gray-400">-</span>;
                console.log(movementTypeLabels, movement.type);
                return (
                    <span className="px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700">
                        {movement.type}
                    </span>
                );
            },
        },
        {
            accessorKey: "product.minStock",
            header: "Stock min",
            size: 80,
            Cell: ({ row }) => (
                <span className="text-gray-600 dark:text-gray-400">
                    {row.original.product.minStock}
                </span>
            ),
        },
        {
            accessorKey: "product.criticalStock",
            header: "Critique",
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
                        title="Voir les détails"
                    >
                        <Eye className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => handleEdit(row.original.product)}
                        className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-md transition-colors"
                        title="Mettre à jour le stock"
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
                        Gestion des stocks
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
                        Rafraîchir
                    </button>
                </div>

                {/* Onglets */}
                <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="mb-6">
                    <Tabs.List className="flex space-x-2 border-b border-gray-200 dark:border-gray-700">
                        <Tabs.Trigger
                            value="last-per-product"
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400"
                        >
                            Dernier mouvement par produit
                            {lastMovementData && (
                                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-700">
                                    {lastMovementData.totalProducts} produits
                                </span>
                            )}
                        </Tabs.Trigger>
                        <Tabs.Trigger
                            value="all-movements"
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400"
                        >
                            Tous les mouvements
                        </Tabs.Trigger>
                    </Tabs.List>

                    {/* Contenu de l'onglet Tous les mouvements */}
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

                    {/* Contenu de l'onglet Dernier mouvement par produit */}
                    <Tabs.Content value="last-per-product" className="mt-4">
                        {/* Cartes récapitulatives */}
                        {lastMovementData && (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Total produits</p>
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
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Avec mouvements</p>
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
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Stock bas/critique</p>
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
                                            <p className="text-sm text-gray-500 dark:text-gray-400">En rupture</p>
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
                        <Toast.Title>❌ Échec du chargement des données</Toast.Title>
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

                {/* Modal de modification du mouvement */}
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

                {/* Dialogue de visualisation des détails */}
                <Dialog.Root open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
                    <Dialog.Portal>
                        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
                        <Dialog.Content className="fixed top-1/2 left-1/2 w-[600px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg z-50 transition-colors duration-200">
                            <Dialog.Title className="text-lg font-bold text-gray-900 dark:text-white">
                                Détails du mouvement
                            </Dialog.Title>

                            {selectedMovement && (
                                <div className="mt-4 space-y-4">
                                    {isStockMovement(selectedMovement) ? (
                                        // Détails StockMovement
                                        <>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                        Mouvement #
                                                    </label>
                                                    <p className="font-mono text-gray-900 dark:text-white">
                                                        {selectedMovement.movementNumber}
                                                    </p>
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                        Statut
                                                    </label>
                                                    <div>
                                                        <span className={`inline-block px-2 py-1 rounded-full text-xs ${selectedMovement.status === "COMPLETED"
                                                            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                                                            : selectedMovement.status === "PENDING"
                                                                ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
                                                                : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                                                            }`}>
                                                            {selectedMovement.status === "COMPLETED" ? "TERMINÉ" :
                                                                selectedMovement.status === "PENDING" ? "EN ATTENTE" :
                                                                    "ANNULÉ"}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                        Produit
                                                    </label>
                                                    <p className="text-gray-900 dark:text-white">
                                                        {selectedMovement.product?.name}
                                                    </p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        Réf : {selectedMovement.product?.reference}
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
                                                        Quantité
                                                    </label>
                                                    <p className={`font-semibold ${selectedMovement.type === "OUTBOUND" || selectedMovement.type === "SALE" || selectedMovement.type === "LOSS"
                                                        ? "text-red-600 dark:text-red-400"
                                                        : "text-green-600 dark:text-green-400"
                                                        }`}>
                                                        {selectedMovement.quantity > 0 ? `+${selectedMovement.quantity}` : selectedMovement.quantity}
                                                    </p>
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                        Variation de stock
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
                                                        Raison
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
                                                        Créé le
                                                    </label>
                                                    <p className="text-gray-900 dark:text-white">
                                                        {format(new Date(selectedMovement.createdAt), "dd/MM/yyyy HH:mm:ss")}
                                                    </p>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        // Détails LastMovementPerProduct
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                    Produit
                                                </label>
                                                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                                    {selectedMovement.product.name}
                                                </p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    Référence : {selectedMovement.product.reference}
                                                </p>
                                                {selectedMovement.product.internalCode && (
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        Code interne : {selectedMovement.product.internalCode}
                                                    </p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                    Stock actuel
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
                                                    État du stock
                                                </label>
                                                <div>
                                                    <span className={`inline-block px-2 py-1 rounded-full text-xs ${getStockStatusColor(selectedMovement.stockStatus)}`}>
                                                        {selectedMovement.stockStatus === "OUT_OF_STOCK" ? "RUPTURE" :
                                                            selectedMovement.stockStatus === "CRITICAL" ? "CRITIQUE" :
                                                                selectedMovement.stockStatus === "LOW" ? "BAS" : "OK"}
                                                    </span>
                                                </div>
                                            </div>
                                            {selectedMovement.lastMovement && (
                                                <>
                                                    <div>
                                                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                            Dernier mouvement #
                                                        </label>
                                                        <p className="font-mono text-sm text-gray-900 dark:text-white">
                                                            {selectedMovement.lastMovement.movementNumber}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                            Date du dernier mouvement
                                                        </label>
                                                        <p className="text-gray-900 dark:text-white">
                                                            {format(new Date(selectedMovement.lastMovement.createdAt), "dd/MM/yyyy HH:mm:ss")}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                            Dernière quantité
                                                        </label>
                                                        <p className={selectedMovement.lastMovement.quantity > 0 ? "text-green-600" : "text-red-600"}>
                                                            {selectedMovement.lastMovement.quantity > 0 ? `+${selectedMovement.lastMovement.quantity}` : selectedMovement.lastMovement.quantity}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                            Variation de stock
                                                        </label>
                                                        <p className="text-gray-900 dark:text-white">
                                                            {selectedMovement.lastMovement.previousStock} → {selectedMovement.lastMovement.newStock}
                                                        </p>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                            Raison
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
                                                        Ce produit n'a pas encore de mouvements de stock
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
                                    Fermer
                                </button>
                            </div>
                        </Dialog.Content>
                    </Dialog.Portal>
                </Dialog.Root>

                {/* Dialogue de confirmation d'annulation */}
                <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
                    <Dialog.Portal>
                        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
                        <Dialog.Content className="fixed top-1/2 left-1/2 w-96 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg z-50 transition-colors duration-200">
                            <Dialog.Title className="text-lg font-bold text-gray-900 dark:text-white">
                                Confirmer l'annulation
                            </Dialog.Title>
                            <Dialog.Description className="mt-2 text-gray-600 dark:text-gray-300">
                                Êtes-vous sûr de vouloir annuler le mouvement{" "}
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
                                    Annuler
                                </button>
                                <button
                                    onClick={confirmCancel}
                                    className="px-4 py-2 rounded-md bg-red-500 dark:bg-red-600 text-white hover:bg-red-600 dark:hover:bg-red-700 transition-colors"
                                >
                                    Oui, annuler le mouvement
                                </button>
                            </div>
                        </Dialog.Content>
                    </Dialog.Portal>
                </Dialog.Root>
            </div>
        </Toast.Provider>
    );
}