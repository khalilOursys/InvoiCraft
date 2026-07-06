"use client";

import { useState, useEffect } from "react";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Toast from "@radix-ui/react-toast";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter, useParams } from "next/navigation";
import { Pencil, Trash2, Eye, Plus } from "lucide-react";

interface Product {
  id: number;
  name: string;
}

interface CraftProduct {
  id: number;
  reference: string;
  name: string;
  description?: string;
  unit: string;
  amount: number;
  totalCost: number;
  salePrice: number;
  marginPercent: number;
  vat: number;
  minStock: number;
  img?: string;
  productId?: number;
  product?: Product;
  materials: Array<{
    id: number;
    rawMaterialId: number;
    rawMaterial: {
      id: number;
      name: string;
    };
    amount: number;
  }>;
  services: Array<{
    id: number;
    serviceId: number;
    service: {
      id: number;
      name: string;
    };
  }>;
  createdAt: string;
  updatedAt: string;
}

// API Functions
const fetchProduct = async (id: number): Promise<Product> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}products/${id}`);
  if (!response.ok) throw new Error("Failed to fetch product");
  return response.json();
};

const fetchCraftProducts = async (productId: number): Promise<CraftProduct[]> => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}craft-products?productId=${productId}`
  );
  if (!response.ok) throw new Error("Failed to fetch craft products");
  return response.json();
};

const deleteCraftProduct = async (id: number): Promise<void> => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}craft-products/${id}`,
    { method: "DELETE" }
  );
  if (!response.ok) throw new Error("Failed to delete craft product");
};

const getUnitLabel = (unit: string) => {
  const units: Record<string, string> = {
    mg: "Milligramme",
    ml: "Millilitre",
    g: "Gramme",
    L: "Litre",
    kg: "Kilogramme",
    unit: "Unité"
  };
  return units[unit] || unit;
};

interface PageProps {
  params: Promise<{ idProduct: string }>;
}

export default function CraftProductsListPage({ params }: PageProps) {
  const [resolvedParams, setResolvedParams] = useState<{ idProduct: string } | null>(null);

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

  return <CraftProductsListContent idProduct={resolvedParams.idProduct} />;
}

function CraftProductsListContent({ idProduct }: { idProduct: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const productId = parseInt(idProduct);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CraftProduct | null>(null);
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

  // Fetch product details
  const { data: product, isLoading: isLoadingProduct } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => fetchProduct(productId),
  });

  const {
    data: craftProducts = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<CraftProduct[]>({
    queryKey: ["craftProducts", productId],
    queryFn: () => fetchCraftProducts(productId),
  });

  const handleAdd = () => {
    router.push(`/craft-products/add/${productId}`);
  };

  const handleEdit = (product: CraftProduct) => {
    router.push(`/craft-products/edit/${product.id}`);
  };

  const handleView = (product: CraftProduct) => {
    router.push(`/craft-products/detail/${product.id}`);
  };

  const handleDelete = (product: CraftProduct) => {
    setSelectedProduct(product);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedProduct) return;

    try {
      await deleteCraftProduct(selectedProduct.id);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["craftProducts"] });
      showToast("✅ Produit artisanal supprimé avec succès", "success");
    } catch (err) {
      showToast("❌ Erreur lors de la suppression", "error");
    } finally {
      setDialogOpen(false);
      setSelectedProduct(null);
    }
  };

  const handleRecalculate = async (id: number) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}craft-products/${id}/recalculate`,
        { method: "POST" }
      );
      if (!response.ok) throw new Error("Failed to recalculate price");
      await refetch();
      showToast("✅ Prix recalculé avec succès", "success");
    } catch (err) {
      showToast("❌ Erreur lors du recalcul", "error");
    }
  };

  const handleBack = () => {
    router.push("/products");
  };

  const columns: MRT_ColumnDef<CraftProduct>[] = [
    {
      accessorKey: "reference",
      header: "Référence",
      size: 120,
    },
    {
      accessorKey: "name",
      header: "Nom",
      size: 180,
    },
    {
      accessorKey: "unit",
      header: "Unité",
      size: 100,
      Cell: ({ cell }) => {
        const unit = cell.getValue<string>();
        return getUnitLabel(unit);
      },
    },
    {
      accessorKey: "amount",
      header: "Quantité",
      size: 100,
      Cell: ({ cell }) => {
        const value = cell.getValue<number>();
        return value.toFixed(2);
      },
    },
    {
      accessorKey: "totalCost",
      header: "Coût Total (€)",
      size: 120,
      Cell: ({ cell }) => {
        const value = cell.getValue<number>();
        return `${value.toFixed(2)} €`;
      },
    },
    {
      id: "actions",
      header: "Actions",
      size: 200,
      Cell: ({ row }) => (
        <div className="flex gap-1">
          {/* <button
            onClick={() => handleRecalculate(row.original.id)}
            className="p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-md transition-colors"
            title="Recalculer le prix"
          >
            <span className="text-xs font-bold">R</span>
          </button> */}
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

  if (isLoadingProduct) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <Toast.Provider swipeDirection="right">
      <div className="p-6 min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Produits Artisanaux
            </h1>
            {product && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Pour le produit: <span className="font-semibold">{product.name}</span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-md hover:bg-gray-700 dark:hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              ← Retour
            </button>
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-800 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nouveau produit
            </button>
          </div>
        </div>

        {/* MaterialReactTable */}
        <div className="dark:bg-gray-800 dark:text-white rounded-lg overflow-hidden">
          <MaterialReactTable
            columns={columns}
            data={craftProducts}
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
              noRecordsToDisplay: "Aucun produit artisanal trouvé pour ce produit",
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
          />
        </div>

        {isError && (
          <Toast.Root
            open
            className="bg-red-600 dark:bg-red-700 text-white px-4 py-2 rounded-md shadow-lg"
          >
            <Toast.Title>❌ Erreur lors du chargement des produits</Toast.Title>
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
                Êtes-vous sûr de vouloir supprimer le produit{" "}
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
      </div>
    </Toast.Provider>
  );
}