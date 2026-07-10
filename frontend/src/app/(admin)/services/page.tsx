"use client";

import { useState } from "react";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Toast from "@radix-ui/react-toast";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

type Service = {
  id: number;
  reference: string;
  name: string;
  description?: string;
  price: number;
  createdAt: string;
  updatedAt: string;
};

const fetchServices = async (): Promise<Service[]> => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}services`);
  if (!res.ok) throw new Error("Échec de la récupération des services");
  return res.json();
};

export default function ServicesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastOpen(true);
  };

  const {
    data: services = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<Service[]>({
    queryKey: ["services"],
    queryFn: fetchServices,
  });

  const handleAdd = () => {
    router.push("/services/add");
  };

  const handleEdit = (service: Service) => {
    router.push(`/services/edit/${service.id}`);
  };

  const handleDelete = async (service: Service) => {
    setSelectedService(service);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedService) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}services/${selectedService.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Échec de la suppression");

      await refetch();
      showToast(`✅ Service ${selectedService.name} supprimé`);
    } catch (err) {
      showToast("❌ Échec de la suppression du service");
    } finally {
      setDialogOpen(false);
      setSelectedService(null);
    }
  };

  const columns: MRT_ColumnDef<Service>[] = [
    {
      accessorKey: "reference",
      header: "Référence",
      size: 150,
    },
    {
      accessorKey: "name",
      header: "Nom",
      size: 200,
    },
    {
      accessorKey: "description",
      header: "Description",
      size: 250,
      Cell: ({ cell }) => cell.getValue<string>() || "-",
    },
    {
      accessorKey: "price",
      header: "Prix (DT)",
      size: 150,
      Cell: ({ cell }) => `${cell.getValue<number>().toFixed(3)} DT`,
    },
    {
      id: "actions",
      header: "Actions",
      size: 120,
      Cell: ({ row }) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleEdit(row.original)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            title="Modifier"
          >
            <Pencil className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleDelete(row.original)}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
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
            Services
          </h1>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-800 transition-colors"
          >
            Ajouter un service
          </button>
        </div>

        <div className="dark:bg-gray-800 dark:text-white rounded-lg overflow-hidden">
          <MaterialReactTable
            columns={columns}
            data={services}
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
            <Toast.Title>❌ Échec de la récupération des services</Toast.Title>
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
                  {selectedService?.name ?? ""}
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