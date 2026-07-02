"use client";

import { useState, useEffect } from "react";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Toast from "@radix-ui/react-toast";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

type Driver = {
  id: number;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  cin?: string;
  licenseNumber?: string;
  active: boolean;
  car?: {
    id: number;
    registration: string;
    brand?: string;
    model?: string;
  };
  createdAt?: string;
  updatedAt?: string;
};

const fetchDrivers = async (): Promise<Driver[]> => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}driver`);
  if (!res.ok) throw new Error("Erreur lors du chargement des chauffeurs");
  return res.json();
};

const toggleDriverActive = async (id: number): Promise<Driver> => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}driver/${id}/toggle-active`, {
    method: "PATCH",
  });
  if (!res.ok) throw new Error("Erreur lors du changement de statut du chauffeur");
  return res.json();
};

export default function DriversPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Détection des changements de thème
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

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastOpen(true);
  };

  const {
    data: drivers = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<Driver[]>({
    queryKey: ["drivers"],
    queryFn: fetchDrivers,
  });

  const handleAddDriver = () => {
    router.push("/drivers/add");
  };

  const handleEdit = (driver: Driver) => {
    router.push(`/drivers/edit/${driver.id}`);
  };

  const handleToggleActive = async (driver: Driver) => {
    try {
      await toggleDriverActive(driver.id);
      await refetch();
      showToast(`✅ Chauffeur ${driver.firstName} ${driver.lastName} ${driver.active ? "désactivé" : "activé"} avec succès`);
    } catch (err) {
      showToast("❌ Erreur lors du changement de statut du chauffeur");
    }
  };

  const handleDelete = async (driver: Driver) => {
    setSelectedDriver(driver);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedDriver) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}driver/${selectedDriver.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Échec de la suppression");

      await refetch();
      showToast(`✅ Chauffeur ${selectedDriver.firstName} ${selectedDriver.lastName} supprimé avec succès`);
    } catch (err) {
      showToast("❌ Échec de la suppression du chauffeur");
    } finally {
      setDialogOpen(false);
      setSelectedDriver(null);
    }
  };

  const columns: MRT_ColumnDef<Driver>[] = [
    {
      accessorKey: "firstName",
      header: "Nom complet",
      size: 180,
      Cell: ({ row }) => `${row.original.firstName} ${row.original.lastName}`,
    },
    {
      accessorKey: "phone",
      header: "Téléphone",
      size: 120,
      Cell: ({ cell }) => cell.getValue<string>() || "-",
    },
    {
      accessorKey: "cin",
      header: "CIN",
      size: 120,
      Cell: ({ cell }) => cell.getValue<string>() || "-",
    },
    {
      accessorKey: "licenseNumber",
      header: "N° Permis",
      size: 140,
      Cell: ({ cell }) => cell.getValue<string>() || "-",
    },
    {
      accessorKey: "car",
      header: "Véhicule assigné",
      size: 200,
      Cell: ({ cell }) => {
        const car = cell.getValue<Driver["car"]>();
        return car
          ? `${car.brand || ""} ${car.model || ""} (${car.registration})`.trim()
          : "-";
      },
    },
    {
      id: "actions",
      header: "Actions",
      size: 140,
      Cell: ({ row }) => (
        <div className="flex gap-2">
          <button
            onClick={() => handleToggleActive(row.original)}
            className={`p-1.5 rounded-md transition-colors ${row.original.active
              ? "text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30"
              : "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30"
              }`}
            title={row.original.active ? "Désactiver" : "Activer"}
          >
            {row.original.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
          </button>
          <button
            onClick={() => handleEdit(row.original)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
            title="Modifier"
          >
            <Pencil className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleDelete(row.original)}
            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
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
            Chauffeurs
          </h1>
          <button
            onClick={handleAddDriver}
            className="px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-800 transition-colors"
          >
            Ajouter un chauffeur
          </button>
        </div>

        {/* MaterialReactTable avec support du mode sombre */}
        <div className="dark:bg-gray-800 dark:text-white rounded-lg overflow-hidden">
          <MaterialReactTable
            columns={columns}
            data={drivers}
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
            <Toast.Title>❌ Échec du chargement des chauffeurs</Toast.Title>
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
                Êtes-vous sûr de vouloir supprimer le chauffeur{" "}
                <span className="font-semibold">
                  {selectedDriver?.firstName} {selectedDriver?.lastName}
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