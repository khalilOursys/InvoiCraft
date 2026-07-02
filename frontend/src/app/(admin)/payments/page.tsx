// src/app/payments/page.tsx
import { Suspense } from "react";
import PaymentsClient from "./PaymentsClient";

// This function validates the type parameter
function validatePaymentType(type: string | undefined): "purchase" | "sale" | undefined {
  if (type === "purchase" || type === "sale") {
    return type;
  }
  return undefined;
}

export default async function PaymentsListPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; entityId?: string }>;
}) {
  const params = await searchParams;

  const typeFilter = validatePaymentType(params.type);
  const entityIdFilter = params.entityId || undefined;

  return (
    <Suspense fallback={
      <div className="p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500 dark:text-gray-400">Chargement...</div>
        </div>
      </div>
    }>
      <PaymentsClient
        typeFilter={typeFilter}
        entityIdFilter={entityIdFilter}
      />
    </Suspense>
  );
}