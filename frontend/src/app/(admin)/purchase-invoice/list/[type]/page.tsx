"use client";

import { useState, useEffect } from "react";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Toast from "@radix-ui/react-toast";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter, usePathname } from "next/navigation";
import { Pencil, Trash2, Eye, Plus } from "lucide-react";

type Supplier = {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
};

type PurchaseInvoice = {
  id: number;
  invoiceNumber: string;
  date: string;
  type: "PURCHASE_ORDER" | "PURCHASE_INVOICE" | "PURCHASE_REFUND";
  status: "DRAFT" | "VALIDATED" | "PAID" | "CANCELLED";
  totalHT: number;
  totalTTC: number;
  supplier: Supplier;
  supplierId: number;
  createdAt: string;
  updatedAt: string;
};

const fetchPurchaseInvoices = async (type: string): Promise<PurchaseInvoice[]> => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}purchase-invoices?type=${type}`
  );
  if (!response.ok) throw new Error("Failed to fetch purchase invoices");
  return response.json();
};

const deletePurchaseInvoice = async (id: number): Promise<void> => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}purchase-invoices/${id}`,
    { method: "DELETE" }
  );
  if (!response.ok) throw new Error("Failed to delete purchase invoice");
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "DRAFT":
      return "Brouillon";
    case "VALIDATED":
      return "Validée";
    case "PAID":
      return "Payée";
    case "CANCELLED":
      return "Annulée";
    default:
      return status;
  }
};

const getStatusVariant = (status: string) => {
  switch (status) {
    case "DRAFT":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "VALIDATED":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "PAID":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "CANCELLED":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case "PURCHASE_ORDER":
      return "Bon de commande";
    case "PURCHASE_INVOICE":
      return "Facture achat";
    case "PURCHASE_REFUND":
      return "Avoir fournisseur";
    default:
      return type;
  }
};

const getTypeVariant = (type: string) => {
  switch (type) {
    case "PURCHASE_ORDER":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
    case "PURCHASE_INVOICE":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300";
    case "PURCHASE_REFUND":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
  }
};

export default function ListPurchaseInvoicePage() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  // Get the last path segment as type
  const type = pathname.split("/").pop() || "PURCHASE_INVOICE";

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Detect theme on mount
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");

    const observer = new MutationObserver(() => {
      const isDarkNow = document.documentElement.classList.contains("dark");
      setTheme(isDarkNow ? "dark" : "light");
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMsg(msg);
    setToastType(type);
    setToastOpen(true);
  };

  const {
    data: invoices = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<PurchaseInvoice[]>({
    queryKey: ["purchaseInvoices", type],
    queryFn: () => fetchPurchaseInvoices(type as string),
  });

  const getAddRoute = () => {
    return "/purchase-invoice/add/" + type;
    /* switch (type) {
      case "PURCHASE_ORDER":
        return "/purchase-order/add";
      default:
        return "/purchase-invoice/add";
    } */
  };

  const handleAdd = () => {
    router.push(getAddRoute());
  };

  const handleEdit = (invoice: PurchaseInvoice) => {
    router.push(`/purchase-invoice/edit/${invoice.id}`);
  };

  const handleView = (invoice: PurchaseInvoice) => {
    router.push(`/purchase-invoice/detail/${invoice.id}`);
  };

  const handleDelete = (invoice: PurchaseInvoice) => {
    setSelectedInvoice(invoice);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedInvoice) return;

    try {
      await deletePurchaseInvoice(selectedInvoice.id);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["purchaseInvoices"] });
      showToast("✅ Facture d'achat supprimée avec succès", "success");
    } catch (err) {
      showToast("❌ Erreur lors de la suppression", "error");
    } finally {
      setDialogOpen(false);
      setSelectedInvoice(null);
    }
  };

  const columns: MRT_ColumnDef<PurchaseInvoice>[] = [
    {
      accessorKey: "invoiceNumber",
      header: "Numéro",
      size: 150,
    },
    {
      accessorKey: "supplier.name",
      header: "Fournisseur",
      size: 200,
    },
    {
      accessorKey: "type",
      header: "Type",
      size: 150,
      Cell: ({ cell }) => {
        const typeValue = cell.getValue<string>();
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeVariant(typeValue)}`}>
            {getTypeLabel(typeValue)}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Statut",
      size: 120,
      Cell: ({ cell }) => {
        const status = cell.getValue<string>();
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusVariant(status)}`}>
            {getStatusLabel(status)}
          </span>
        );
      },
    },
    {
      accessorKey: "totalHT",
      header: "Total HT (€)",
      size: 130,
      Cell: ({ cell }) => {
        const value = cell.getValue<number>();
        return `${value.toFixed(2)} €`;
      },
    },
    {
      accessorKey: "totalTTC",
      header: "Total TTC (€)",
      size: 130,
      Cell: ({ cell }) => {
        const value = cell.getValue<number>();
        return `${value.toFixed(2)} €`;
      },
    },
    {
      id: "actions",
      header: "Actions",
      size: 150,
      Cell: ({ row }) => (
        <div className="flex gap-1">
          <button
            onClick={() => handleEdit(row.original)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
            title="Modifier"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(row.original)}
            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleView(row.original)}
            className="p-1.5 text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800 rounded-md transition-colors"
            title="Détails"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const pageTitle = type === "PURCHASE_ORDER" ? "Bons de commande" : "Factures d'Achat";
  const addButtonText = type === "PURCHASE_ORDER" ? "Nouveau bon de commande" : "Nouvelle facture d'achat";

  return (
    <Toast.Provider swipeDirection="right">
      <div className="p-6 min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {pageTitle}
          </h1>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-800 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {addButtonText}
          </button>
        </div>

        {/* MaterialReactTable with dark mode support */}
        <div className="dark:bg-gray-800 dark:text-white rounded-lg overflow-hidden">
          <MaterialReactTable
            columns={columns}
            data={invoices}
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
            localization={{
              noRecordsToDisplay: "Aucune facture d'achat trouvée",
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
            <Toast.Title>❌ Erreur lors du chargement des factures</Toast.Title>
          </Toast.Root>
        )}

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
                Êtes-vous sûr de vouloir supprimer la facture{" "}
                <span className="font-semibold">
                  {selectedInvoice?.invoiceNumber ?? ""}
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