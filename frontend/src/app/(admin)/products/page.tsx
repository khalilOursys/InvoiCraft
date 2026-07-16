"use client";

import { useState, useEffect } from "react";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Toast from "@radix-ui/react-toast";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Package, ClipboardList } from "lucide-react";
import ProductionOrderDialog from "@/components/ProductionOrderDialog";

type Product = {
  id: number;
  reference: string;
  internalCode: string;
  name: string;
  description?: string;
  stock: number;
  minStock: number;
  purchasePrice: number;
  marginPercent: number;
  salePrice: number;
  priceIncludingTax: number;
  discount: number;
  vat: number;
  categoryId: number;
  categoryName?: string;
  brandId?: number;
  brandName?: string;
  img?: string;
  createdAt: string;
  updatedAt: string;
};

const fetchProducts = async (): Promise<Product[]> => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}products`);
  if (!res.ok) throw new Error("Échec de la récupération des produits");
  return res.json();
};

export default function ProductsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Production Order Dialog State
  const [prodOrderDialogOpen, setProdOrderDialogOpen] = useState(false);
  const [selectedProductForOrder, setSelectedProductForOrder] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastOpen(true);
  };

  const {
    data: products = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });

  const handleAddProduct = () => {
    router.push("/products/add");
  };

  const handleEdit = (product: Product) => {
    router.push(`/products/edit/${product.id}`);
  };

  const handleDelete = async (product: Product) => {
    setSelectedProduct(product);
    setDialogOpen(true);
  };

  const handleViewCraftProducts = (product: Product) => {
    router.push(`/craft-products/list/${product.id}`);
  };

  const handleCreateProductionOrder = (product: Product) => {
    setSelectedProductForOrder({
      id: product.id,
      name: product.name,
    });
    setProdOrderDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedProduct) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}products/${selectedProduct.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Échec de la suppression");

      await refetch();
      showToast(`✅ Produit ${selectedProduct.name} supprimé`);
    } catch (err) {
      showToast("❌ Échec de la suppression du produit");
    } finally {
      setDialogOpen(false);
      setSelectedProduct(null);
    }
  };

  const columns: MRT_ColumnDef<Product>[] = [
    {
      accessorKey: "name",
      header: "Nom",
      size: 200,
    },
    {
      accessorKey: "stock",
      header: "Stock",
      size: 100,
      Cell: ({ cell }) => {
        const stock = cell.getValue<number>();
        const minStock = cell.row.original.minStock;
        return (
          <span
            className={`px-2 py-1 rounded-full text-xs ${stock <= minStock
              ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
              : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
              }`}
          >
            {stock}
          </span>
        );
      },
    },
    {
      accessorKey: "salePrice",
      header: "Prix de vente (DT)",
      size: 120,
      Cell: ({ cell }) => `${cell.getValue<number>().toFixed(3)} DT`,
    },
    {
      accessorKey: "categoryName",
      header: "Catégorie",
      size: 120,
    },
    {
      accessorKey: "brandName",
      header: "Marque",
      size: 120,
    },
    {
      id: "actions",
      header: "Actions",
      size: 200, // Increased size for new button
      Cell: ({ row }) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleCreateProductionOrder(row.original)}
            className="p-1.5 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-md transition-colors"
            title="Create Production Order"
          >
            <ClipboardList className="w-5 h-5" />
          </button>
          {/* <button
            onClick={() => handleViewCraftProducts(row.original)}
            className="p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-md transition-colors"
            title="Voir les produits artisanaux"
          >
            <Package className="w-5 h-5" />
          </button> */}
          <button
            onClick={() => handleEdit(row.original)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
            title="Modifier"
          >
            <Pencil className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleDelete(row.original)}
            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
            title="Supprimer"
          >
            <Trash2 className="w-5 h-5" />
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
            Produits
          </h1>
          <button
            onClick={handleAddProduct}
            className="px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-800 transition-colors"
          >
            Ajouter un produit
          </button>
        </div>

        {/* MaterialReactTable avec support du mode sombre */}
        <div className="dark:bg-gray-800 dark:text-white rounded-lg overflow-hidden">
          <MaterialReactTable
            columns={columns}
            data={products}
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
            <Toast.Title>❌ Échec de la récupération des produits</Toast.Title>
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

        {/* Delete Confirmation Dialog */}
        <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
            <Dialog.Content className="fixed top-1/2 left-1/2 w-96 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg z-50 transition-colors duration-200">
              <Dialog.Title className="text-lg font-bold text-gray-900 dark:text-white">
                Confirmer la suppression
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-gray-600 dark:text-gray-300">
                Êtes-vous sûr de vouloir supprimer{" "}
                <span className="font-semibold">
                  {selectedProduct?.name ?? ""}
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

        {/* Production Order Dialog */}
        <ProductionOrderDialog
          open={prodOrderDialogOpen}
          onOpenChange={setProdOrderDialogOpen}
          productId={selectedProductForOrder?.id || 0}
          productName={selectedProductForOrder?.name || ""}
          onSuccess={() => {
            // Refresh data or show success message
            showToast("Production order created successfully!");
          }}
        />
      </div>
    </Toast.Provider>
  );
}