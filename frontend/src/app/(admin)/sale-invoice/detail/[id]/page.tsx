'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    ArrowLeft,
    FileText,
    Printer,
    Download,
    Edit,
    Package,
    Truck,
    MapPin,
    Phone,
    Mail,
    Building,
    CreditCard,
    AlertCircle,
    User,
    Car,
    Circle,
} from 'lucide-react';

import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableCell,
} from '@/components/ui/table';

// API functions
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

async function fetchClients() {
    const response = await fetch(`${API_BASE_URL}clients`);
    if (!response.ok) throw new Error('Failed to fetch clients');
    return response.json();
}

async function fetchProducts() {
    const response = await fetch(`${API_BASE_URL}products`);
    if (!response.ok) throw new Error('Failed to fetch products');
    return response.json();
}

async function fetchSaleInvoice(id: string) {
    const response = await fetch(`${API_BASE_URL}sale-invoices/${id}`);
    if (!response.ok) throw new Error('Failed to fetch invoice');
    return response.json();
}

async function fetchSettings() {
    const response = await fetch(`${API_BASE_URL}company-settings`);
    if (!response.ok) throw new Error('Failed to fetch settings');
    return response.json();
}

// Types
interface InvoiceItem {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    vatRate: number;
    vatAmount: number;
    totalHT: number;
    totalTTC: number;
    fodecRate: number; // ADD FODEC RATE
    fodecAmount: number; // ADD FODEC AMOUNT
    totalWithFodec: number; // ADD TOTAL WITH FODEC
}

interface ClientDetails {
    name: string;
    address: string;
    city: string;
    phone: string;
    email: string;
    taxNumber: string;
    postalCode?: string;
}

interface DriverDetails {
    firstName: string;
    lastName: string;
    phone: string;
    car: { registration: string };
}

interface CityItem {
    id: string;
    city: { name: string; state?: string };
}

interface CompanyInfo {
    name: string;
    address: string;
    city: string;
    phone: string;
    email: string;
    siret: string;
    vatNumber: string;
    mf: string;
    logo: string;
}

const defaultLogo = "/logo.png";

// Simple Button Component
const Button: React.FC<{
    onClick?: () => void;
    variant?: 'default' | 'outline' | 'secondary';
    className?: string;
    children: React.ReactNode;
}> = ({ onClick, variant = 'default', className = '', children }) => {
    const baseStyles = 'px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-2';
    const variants = {
        default: 'bg-blue-600 text-white hover:bg-blue-700',
        outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
        secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    };
    return (
        <button onClick={onClick} className={`${baseStyles} ${variants[variant]} ${className}`}>
            {children}
        </button>
    );
};

// Simple Card Components
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>{children}</div>
);

const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <div className={`px-6 py-4 border-b border-gray-200 ${className}`}>{children}</div>
);

const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <h3 className={`text-lg font-semibold ${className}`}>{children}</h3>
);

const CardDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <p className={`text-sm text-gray-500 ${className}`}>{children}</p>
);

const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <div className={`px-6 py-4 ${className}`}>{children}</div>
);

const CardFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <div className={`px-6 py-4 border-t border-gray-200 ${className}`}>{children}</div>
);

// Simple Badge Component
const Badge: React.FC<{ children: React.ReactNode; variant?: 'default' | 'secondary' | 'warning'; className?: string }> = ({
    children,
    variant = 'default',
    className = ''
}) => {
    const variants = {
        default: 'bg-blue-100 text-blue-800',
        secondary: 'bg-gray-100 text-gray-800',
        warning: 'bg-yellow-100 text-yellow-800',
    };
    return (
        <span className={`px-2 py-1 rounded-md text-xs font-medium ${variants[variant]} ${className}`}>
            {children}
        </span>
    );
};

// Simple Separator Component
const Separator: React.FC<{ className?: string }> = ({ className = '' }) => (
    <hr className={`my-2 border-gray-200 ${className}`} />
);

function SaleInvoiceDetails() {
    const { id } = useParams();
    const router = useRouter();
    const invoiceId = Array.isArray(id) ? id[0] : id;

    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [date, setDate] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [type, setType] = useState('');
    const [status, setStatus] = useState('');
    const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
    const [totalHT, setTotalHT] = useState(0);
    const [totalTTC, setTotalTTC] = useState(0);
    const [totalVAT, setTotalVAT] = useState(0);
    const [totalFODEC, setTotalFODEC] = useState(0); // ADD TOTAL FODEC
    const [totalWithFODEC, setTotalWithFODEC] = useState(0); // ADD TOTAL WITH FODEC
    const [clientDetails, setClientDetails] = useState<ClientDetails>({} as ClientDetails);
    const [driverDetails, setDriverDetails] = useState<DriverDetails>({} as DriverDetails);
    const [cities, setCities] = useState<CityItem[]>([]);
    const [companyLogo, setCompanyLogo] = useState(defaultLogo);

    // Fetch settings
    const { data: settingsData } = useQuery({
        queryKey: ['settings'],
        queryFn: fetchSettings,
    });

    // Fetch products
    const { data: productsData } = useQuery({
        queryKey: ['products'],
        queryFn: fetchProducts,
    });

    // Fetch invoice
    const { data: invoiceData, isLoading } = useQuery({
        queryKey: ['saleInvoice', invoiceId],
        queryFn: () => fetchSaleInvoice(invoiceId!),
        enabled: !!invoiceId,
        refetchOnWindowFocus: true
    });

    const companyInfo: CompanyInfo = settingsData
        ? {
            name: settingsData.companyName || settingsData.name || "Oral Wave",
            address: settingsData.companyAddress || settingsData.address || "Route Sidi Mansour km 7 Sfax",
            city: settingsData.companyCity || settingsData.city || "Sfax, Tunisie",
            phone: settingsData.companyPhone || settingsData.phone || "27737857",
            email: settingsData.companyEmail || settingsData.email || "contact@oralwave.store",
            siret: settingsData.companySiret || settingsData.siret || "123 456 789 00012",
            vatNumber: settingsData.companyVatNumber || settingsData.vatNumber || "FR12 123456789",
            mf: settingsData.companyMF || settingsData.mf || "1920515/B/B/M/000",
            logo: settingsData.logoUrl || settingsData.logo || defaultLogo,
        }
        : {
            name: "Oral Wave",
            address: "Route Sidi Mansour km 7 Sfax",
            city: "Sfax, Tunisie",
            phone: "27737857",
            email: "contact@oralwave.store",
            siret: "123 456 789 00012",
            vatNumber: "FR12 123456789",
            mf: "1920515/B/B/M/000",
            logo: defaultLogo,
        };

    // Process invoice data when available
    useEffect(() => {
        if (invoiceData && productsData) {
            const rawInvoiceNumber = invoiceData.invoiceNumber || "";
            const invoiceDate = invoiceData.date?.split("T")[0] || "";
            const invoiceEndDate = invoiceData.endDate?.split("T")[0] || "";
            const invoiceStartDate = invoiceData.startDate?.split("T")[0] || "";

            setDate(invoiceDate);
            setStartDate(invoiceStartDate);
            setEndDate(invoiceEndDate);

            const year = invoiceDate ? new Date(invoiceDate).getFullYear() : new Date().getFullYear();
            const formattedNumber = `${rawInvoiceNumber}/${year}`;
            setInvoiceNumber(formattedNumber);

            setType(invoiceData.type || "");
            setStatus(invoiceData.status || "");
            setTotalHT(invoiceData.totalHT || 0);
            setTotalTTC(invoiceData.totalTTC || 0);
            setTotalVAT((invoiceData.totalTTC || 0) - (invoiceData.totalHT || 0));

            setClientDetails(invoiceData.client || {});
            setDriverDetails(invoiceData.driver || {});
            setCities(invoiceData.cities || []);

            // Process items with FODEC - CORRECTED with quantity multiplication
            let totalFodecSum = 0;
            const processedItems = (invoiceData.items || []).map((item: any) => {
                const product = productsData?.find((p: any) => p.id === item.productId) || {};

                // Calculate per unit values
                const unitHT = item.price;
                const unitVAT = item.vatRate ? unitHT * (item.vatRate / 100) : 0;
                const unitTTC = unitHT + unitVAT;

                // Calculate FODEC per unit (based on TTC)
                const fodecRate = product.fodec || 0;
                const unitFodecAmount = unitTTC * (fodecRate / 100);

                // Multiply by quantity for totals
                const quantity = item.quantity;
                const itemHT = unitHT * quantity;
                const itemVAT = unitVAT * quantity;
                const itemTTC = unitTTC * quantity;
                const itemFodecAmount = unitFodecAmount * quantity;

                totalFodecSum += itemFodecAmount;

                return {
                    productId: item.productId,
                    productName: product?.name || "Produit inconnu",
                    quantity: quantity,
                    price: item.price,
                    vatRate: item.vatRate || (invoiceData.type === "QUOTATION" ? 0 : 0),
                    vatAmount: itemVAT,
                    totalHT: itemHT,
                    totalTTC: itemTTC,
                    fodecRate: fodecRate,
                    fodecAmount: itemFodecAmount,
                    totalWithFodec: itemTTC + itemFodecAmount,
                };
            });

            setInvoiceItems(processedItems);
            setTotalFODEC(totalFodecSum);
            setTotalWithFODEC((invoiceData.totalTTC || 0) + totalFodecSum);
        }
    }, [invoiceData, productsData]);

    useEffect(() => {
        if (companyInfo.logo) {
            setCompanyLogo(
                process.env.NEXT_PUBLIC_API_URL +
                "uploads/company/" +
                companyInfo.logo,
            );
        } else {
            setCompanyLogo(defaultLogo);
        }
    }, [companyInfo.logo]);

    /* ================== HELPER FUNCTIONS ================== */
    const formatNumber = (num: number) => {
        if (isNaN(num)) return "0.000";
        return num.toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "";
        const [y, m, d] = dateStr.split("-");
        return `${d}/${m}/${y}`;
    };

    const numberToFrench = (num: number): string => {
        if (num === 0) return "zéro";

        const units = [
            "",
            "un",
            "deux",
            "trois",
            "quatre",
            "cinq",
            "six",
            "sept",
            "huit",
            "neuf",
            "dix",
            "onze",
            "douze",
            "treize",
            "quatorze",
            "quinze",
            "seize",
            "dix-sept",
            "dix-huit",
            "dix-neuf",
        ];
        const tens = [
            "",
            "",
            "vingt",
            "trente",
            "quarante",
            "cinquante",
            "soixante",
            "soixante-dix",
            "quatre-vingt",
            "quatre-vingt-dix",
        ];

        function translate(n: number): string {
            if (n < 20) return units[n];
            if (n < 100) {
                const u = n % 10;
                const t = Math.floor(n / 10);
                let s = tens[t];
                if (u === 1 && t < 8) s += " et " + units[u];
                else if (u > 0) s += "-" + units[u];
                if (u === 0 && t === 8) s += "s";
                return s;
            }
            if (n < 1000) {
                const h = Math.floor(n / 100);
                const r = n % 100;
                let s = "";
                if (h === 1) s = "cent";
                else if (h > 1) s = units[h] + (r === 0 ? " cents" : " cent");
                if (r > 0) s += (s ? " " : "") + translate(r);
                return s;
            }
            if (n < 1000000) {
                const th = Math.floor(n / 1000);
                const r = n % 1000;
                let s = th === 1 ? "mille" : translate(th) + " mille";
                if (r > 0) s += " " + translate(r);
                return s;
            }
            return "";
        }

        return translate(num);
    };

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            QUOTATION: "Devis",
            INVOICE: "Facture",
            DELIVERY_NOTE: "Bon de livraison",
            SALE_REFUND: "Avoir",
            SHIPPING_NOTE_INVOICE: "Bon de Sortie",
        };
        return labels[type] || type;
    };

    /* ================== PDF EXPORT ================== */
    const exportPDF = () => {
        const doc = new jsPDF({
            orientation: "p",
            unit: "mm",
            format: "a4",
        });

        const pageWidth = 210;
        const margin = 17;
        const blue: [number, number, number] = [41, 128, 185];
        const footerLineY = 260;

        const addLogoToPDF = () => {
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = "anonymous";

                img.src = companyLogo;
                img.onload = () => {
                    try {
                        doc.addImage(img, "PNG", margin, 8, 40, 12);
                    } catch (e) {
                        console.warn("Could not add logo:", e);
                    }
                    resolve(true);
                };
                img.onerror = () => {
                    console.warn("Logo failed to load");
                    resolve(true);
                };
            });
        };

        const drawHeader = async (currentPage: number, totalPages: number) => {
            await addLogoToPDF();

            doc.setFillColor(...blue);
            doc.rect(0, 0, pageWidth, 5, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);

            doc.setTextColor(...blue);
            doc.setFontSize(10);
            doc.text(companyInfo.name, pageWidth - margin, 12, { align: "right" });

            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text(`MF: ${companyInfo.mf || ""}`, pageWidth - margin, 18, {
                align: "right",
            });

            doc.setDrawColor(...blue);
            doc.setLineWidth(0.5);
            doc.roundedRect(margin, 25, pageWidth - 2 * margin, 32, 5, 5, "D");

            doc.setFontSize(16);
            doc.setTextColor(...blue);
            doc.setFont("helvetica", "bold");

            let docTitle = "Facture de vente";
            if (type === "QUOTATION") {
                docTitle = "Devis";
            } else if (type === "DELIVERY_NOTE") {
                docTitle = "Bon de Livraison";
            } else if (type === "SALE_REFUND") {
                docTitle = "Avoir";
            } else if (type === "SHIPPING_NOTE_INVOICE") {
                docTitle = "Bon de Sortie";
            }

            doc.text(docTitle, margin + 5, 40);
            const clientX = pageWidth - margin - 100;
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.setFont("helvetica", "normal");
            if (type != "SHIPPING_NOTE_INVOICE") {
                doc.text("Client :", clientX, 37);
                doc.text("Téléphone :", clientX, 42);
                doc.text("M.F :", clientX, 47);
                doc.text("Adresse :", clientX, 52);
                doc.text(clientDetails.name || "", clientX + 25, 37);
                doc.text(clientDetails.phone || "", clientX + 25, 42);
                doc.text(clientDetails.taxNumber || "", clientX + 25, 47);
                doc.text(
                    `${clientDetails.address || ""} ${clientDetails.city || ""}`,
                    clientX + 25,
                    52,
                );
            } else {
                doc.text("Chauffeur :", clientX, 30);
                doc.text("Téléphone :", clientX, 35);
                doc.text("Voiture :", clientX, 40);
                doc.text("Destination :", clientX, 45);
                doc.text("Date début :", clientX, 50);
                doc.text("Date fin :", clientX, 55);

                doc.text(
                    `${driverDetails.firstName || ""} ${driverDetails.lastName || ""}`.trim() || "",
                    clientX + 25,
                    30,
                );
                doc.text(driverDetails.phone ?? "", clientX + 25, 35);
                doc.text(driverDetails.car?.registration ?? "", clientX + 25, 40);

                const citiesList = cities
                    .map((cityItem) => cityItem.city?.name)
                    .filter((name) => name)
                    .join(", ");
                doc.text(citiesList || "Aucune ville", clientX + 25, 45, {
                    maxWidth: 70,
                });

                doc.text(startDate || "", clientX + 25, 50);
                doc.text(endDate || "", clientX + 25, 55);
            }

            doc.setFontSize(9);
            doc.setTextColor(100);
            doc.text("Numéro", margin + 5, 62);
            doc.text("Date", margin + 70, 62);
            doc.text("Page", margin + 135, 62);

            doc.setDrawColor(200, 200, 200);
            doc.line(margin, 64, pageWidth - margin, 64);

            doc.text(invoiceNumber, margin + 5, 70);
            doc.text(formatDate(date), margin + 70, 70);
            doc.text(`${currentPage}/${totalPages}`, margin + 135, 70);
        };

        const drawFooter = (typeLabel: string) => {
            doc.setDrawColor(...blue);
            doc.line(margin, footerLineY + 5, pageWidth - margin, footerLineY + 5);

            doc.setFontSize(9);
            doc.setTextColor(100);

            doc.text(
                `Addresse: ${companyInfo.address}`,
                margin + 27,
                footerLineY + 13,
                {
                    align: "center",
                },
            );
            doc.text(
                `Tel: ${companyInfo.phone || "93252121"}`,
                pageWidth / 2,
                footerLineY + 13,
                { align: "center" },
            );

            doc.text(
                `email: ${companyInfo.email}`,
                pageWidth - margin - 20,
                footerLineY + 13,
                {
                    align: "center",
                },
            );
        };

        const generatePDF = async () => {
            const rowsPerPage = type != "SHIPPING_NOTE_INVOICE" ? 15 : 20;

            const tableHeaders = [
                { content: "Désignation", styles: { halign: "left" as const } },
                { content: "Rem %", styles: { halign: "center" as const } },
                { content: "Qte", styles: { halign: "center" as const } },
                { content: "P.U HT", styles: { halign: "right" as const } },
                { content: "TVA %", styles: { halign: "center" as const } },
                { content: "P.HT", styles: { halign: "right" as const } },
                { content: "P.TTC", styles: { halign: "right" as const } },
            ];

            const emptyRow = [
                { content: "", styles: { halign: "left" as const } },
                { content: "", styles: { halign: "center" as const } },
                { content: "", styles: { halign: "center" as const } },
                { content: "", styles: { halign: "right" as const } },
                { content: "", styles: { halign: "center" as const } },
                { content: "", styles: { halign: "right" as const } },
                { content: "", styles: { halign: "right" as const } },
            ];

            const tableBody = invoiceItems.map((item) => [
                { content: item.productName, styles: { halign: "left" as const } },
                { content: "0.00", styles: { halign: "center" as const } },
                { content: item.quantity, styles: { halign: "center" as const } },
                { content: formatNumber(item.price), styles: { halign: "right" as const } },
                { content: `${item.vatRate}`, styles: { halign: "center" as const } },
                { content: formatNumber(item.totalHT), styles: { halign: "right" as const } },
                { content: formatNumber(item.totalTTC), styles: { halign: "right" as const } },
            ]);

            const totalPages = Math.max(1, Math.ceil(tableBody.length / rowsPerPage));
            let currentPage = 1;

            await drawHeader(currentPage, totalPages);

            let startY = 75;
            let lastAutoTable: any = null;

            for (let i = 0; i < tableBody.length; i += rowsPerPage) {
                let chunk = tableBody.slice(i, i + rowsPerPage);

                const fullChunk = [...chunk];
                while (fullChunk.length < rowsPerPage) {
                    fullChunk.push(emptyRow);
                }

                autoTable(doc, {
                    head: [tableHeaders],
                    body: fullChunk,
                    startY: startY,
                    theme: "grid",
                    styles: {
                        fontSize: 9,
                        cellPadding: 2,
                        lineColor: [200, 200, 200],
                        lineWidth: 0.1,
                        textColor: 50,
                        overflow: "linebreak",
                    },
                    headStyles: {
                        fillColor: blue,
                        textColor: 255,
                        fontStyle: "bold",
                    },
                    bodyStyles: {
                        lineWidth: { top: 0, bottom: 0, left: 0.1, right: 0.1 },
                    },
                    margin: { left: margin, right: margin },
                    columnStyles: {
                        0: { cellWidth: 74 },
                        1: { cellWidth: 15 },
                        2: { cellWidth: 12 },
                        3: { cellWidth: 20 },
                        4: { cellWidth: 15 },
                        5: { cellWidth: 20 },
                        6: { cellWidth: 20 },
                    },
                });

                // Get the table bottom Y position
                const tableBottomY = (doc as any).lastAutoTable?.finalY || 250;
                doc.setDrawColor(200, 200, 200);
                doc.setLineWidth(0.1);
                doc.line(margin, tableBottomY, pageWidth - margin, tableBottomY);

                if (i + rowsPerPage < tableBody.length) {
                    currentPage++;
                    doc.addPage();
                    await drawHeader(currentPage, totalPages);
                    startY = 75;
                }
                lastAutoTable = (doc as any).lastAutoTable;
            }

            let blockStartY = lastAutoTable?.finalY + 10 || 200;
            const preferredBlockStartY = 200;
            if (blockStartY < preferredBlockStartY) {
                blockStartY = preferredBlockStartY;
            }

            const vatRates = [0, 7, 19];
            const vatGroups: Record<number, { base: number; montant: number }> = {};
            invoiceItems.forEach((item) => {
                const rate = item.vatRate;
                if (!vatGroups[rate]) vatGroups[rate] = { base: 0, montant: 0 };
                vatGroups[rate].base += item.totalHT;
                vatGroups[rate].montant += item.vatAmount;
            });

            const taxHeaders = [
                { content: "Taxe", styles: { halign: "left" as const } },
                { content: "Base", styles: { halign: "right" as const } },
                { content: "Montant", styles: { halign: "right" as const } },
            ];
            const taxBody = vatRates.map((rate) => [
                { content: `${rate}%`, styles: { halign: "left" as const } },
                {
                    content: formatNumber(vatGroups[rate]?.base || 0),
                    styles: { halign: "right" as const },
                },
                {
                    content: formatNumber(vatGroups[rate]?.montant || 0),
                    styles: { halign: "right" as const },
                },
            ]);

            if (type != "SHIPPING_NOTE_INVOICE") {
                autoTable(doc, {
                    startY: blockStartY,
                    head: [taxHeaders],
                    body: taxBody,
                    theme: "grid",
                    styles: {
                        fontSize: 8,
                        cellPadding: 2,
                        lineWidth: 0.1,
                        lineColor: [200, 200, 200],
                    },
                    headStyles: { fillColor: blue, textColor: 255 },
                    margin: { left: margin, right: 0 },
                    columnStyles: {
                        0: { cellWidth: 10 },
                        1: { cellWidth: 20 },
                        2: { cellWidth: 20 },
                    },
                });

                const middleX = margin + 55;
                doc.setDrawColor(...blue);
                doc.setLineWidth(0.5);
                doc.rect(middleX, blockStartY, 35, 30);
                doc.setFontSize(9);
                doc.setTextColor(100);
                doc.text("Signature Client", middleX + 17.5, blockStartY + 8, {
                    align: "center",
                });

                doc.rect(middleX + 40, blockStartY, 35, 30);
                doc.text("Signature & Cachet", middleX + 57.5, blockStartY + 8, {
                    align: "center",
                });

                const rightX = middleX + 80;
                doc.setFontSize(9);
                doc.setTextColor(100);
                if (type === "SALE_INVOICE") {
                    doc.text("P.HT.T : ", rightX, blockStartY + 5);
                    doc.text("Timbre fiscal : ", rightX, blockStartY + 10);
                    doc.text("TVA : ", rightX, blockStartY + 15);
                    doc.text("FODEC : ", rightX, blockStartY + 20); // ADD FODEC LINE
                    doc.text("TTC : ", rightX, blockStartY + 25);
                    doc.text("Net à payer : ", rightX, blockStartY + 30);

                    doc.setTextColor(0);
                    const valueOffset = 40;
                    doc.text(
                        formatNumber(totalHT) + " DT",
                        rightX + valueOffset,
                        blockStartY + 5,
                        { align: "right" },
                    );
                    doc.text(
                        formatNumber(1) + " DT",
                        rightX + valueOffset,
                        blockStartY + 10,
                        { align: "right" },
                    );
                    doc.text(
                        formatNumber(totalVAT) + " DT",
                        rightX + valueOffset,
                        blockStartY + 15,
                        { align: "right" },
                    );
                    doc.text(
                        formatNumber(totalFODEC) + " DT", // ADD FODEC VALUE
                        rightX + valueOffset,
                        blockStartY + 20,
                        { align: "right" },
                    );
                    doc.text(
                        formatNumber(totalTTC) + " DT",
                        rightX + valueOffset,
                        blockStartY + 25,
                        { align: "right" },
                    );
                    doc.text(
                        formatNumber(totalWithFODEC) + " DT", // ADD TOTAL WITH FODEC
                        rightX + valueOffset,
                        blockStartY + 30,
                        { align: "right" },
                    );
                } else {
                    doc.text("P.HT.T : ", rightX, blockStartY + 5);
                    doc.text("TVA : ", rightX, blockStartY + 10);
                    doc.text("FODEC : ", rightX, blockStartY + 15); // ADD FODEC LINE
                    doc.text("TTC : ", rightX, blockStartY + 20);
                    doc.text("Net à payer : ", rightX, blockStartY + 25);

                    doc.setTextColor(0);
                    const valueOffset = 40;
                    doc.text(
                        formatNumber(totalHT) + " DT",
                        rightX + valueOffset,
                        blockStartY + 5,
                        { align: "right" },
                    );
                    doc.text(
                        formatNumber(totalVAT) + " DT",
                        rightX + valueOffset,
                        blockStartY + 10,
                        { align: "right" },
                    );
                    doc.text(
                        formatNumber(totalFODEC) + " DT", // ADD FODEC VALUE
                        rightX + valueOffset,
                        blockStartY + 15,
                        { align: "right" },
                    );
                    doc.text(
                        formatNumber(totalTTC) + " DT",
                        rightX + valueOffset,
                        blockStartY + 20,
                        { align: "right" },
                    );
                    doc.text(
                        formatNumber(totalWithFODEC) + " DT", // ADD TOTAL WITH FODEC
                        rightX + valueOffset,
                        blockStartY + 25,
                        { align: "right" },
                    );
                }
            }

            const wordsY = blockStartY + 45;
            const integerPart = Math.floor(totalWithFODEC); // Use total with FODEC
            const millimes = Math.round((totalWithFODEC - integerPart) * 1000);
            const millimesText = millimes === 0 ? "zéro" : numberToFrench(millimes);
            doc.setFontSize(12);
            doc.setTextColor(100);
            if (type != "SHIPPING_NOTE_INVOICE")
                doc.text(
                    `Arrêté le présent à la somme de : ${numberToFrench(integerPart)} Dinars et ${millimesText} Millimes`,
                    margin,
                    wordsY,
                );

            const pageCount = (doc as any).internal.getNumberOfPages();
            const typeLabelLower = getTypeLabel(type).toLowerCase();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                drawFooter(typeLabelLower);

                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text(`Page ${i} / ${pageCount}`, pageWidth / 2, 290, {
                    align: "center",
                });
            }

            const fileName =
                type === "QUOTATION"
                    ? `Devis_${invoiceNumber}.pdf`
                    : type === "DELIVERY_NOTE"
                        ? `BL_${invoiceNumber}.pdf`
                        : type === "SALE_REFUND"
                            ? `Avoir_${invoiceNumber}.pdf`
                            : type === "SHIPPING_NOTE_INVOICE"
                                ? `Facture_Bon_Sortie_${invoiceNumber}.pdf`
                                : `Facture_${invoiceNumber}.pdf`;

            doc.save(fileName);
        };

        generatePDF();
    };

    const getListRoute = (invoiceType: string) => {
        switch (invoiceType) {
            case "DELIVERY_NOTE":
                return "/sale-invoice/list/DELIVERY_NOTE";
            case "SALE_INVOICE":
                return "/sale-invoice/list/SALE_INVOICE";
            case "SHIPPING_NOTE_INVOICE":
                return "/sale-invoice/list/SHIPPING_NOTE_INVOICE";
            case "QUOTATION":
                return "/sale-invoice/list/QUOTATION";
            default:
                return "/sale-invoice/list";
        }
    };

    const getUpdateRoute = (invoiceType: string, invoiceId: string) => {
        return `/sale-invoice/edit/${invoiceId}`;
    };

    const handleUpdate = () => {
        const updateRoute = getUpdateRoute(type, invoiceId!);
        router.push(updateRoute);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Chargement...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-6">
            {/* Header Buttons */}
            <div className="flex justify-between items-center mb-6">
                <Button variant="outline" onClick={() => router.push(getListRoute(type))}>
                    <ArrowLeft className="h-4 w-4" />
                    Retour à la liste
                </Button>

                <div className="flex gap-3">
                    {status === "DRAFT" && (
                        <Button variant="outline" onClick={handleUpdate}>
                            <Edit className="h-4 w-4" />
                            Modifier
                        </Button>
                    )}
                    <Button variant="default" onClick={exportPDF}>
                        <Download className="h-4 w-4" />
                        Exporter PDF
                    </Button>
                </div>
            </div>

            {/* Main Invoice Card */}
            <Card className="shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-500 text-white">
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="text-2xl flex items-center gap-2">
                                <FileText className="h-6 w-6" />
                                {getTypeLabel(type)} - {invoiceNumber}
                            </CardTitle>
                            <CardDescription className="text-white/80 mt-1">
                                {formatDate(date)} | {status}
                            </CardDescription>
                        </div>
                        <Badge variant="secondary" className="text-lg px-4 py-2 bg-white text-blue-600">
                            {totalWithFODEC.toFixed(3)} TND
                        </Badge>
                    </div>
                </CardHeader>

                <CardContent className="pt-6">
                    {/* Company and Client Info */}
                    <div className="grid md:grid-cols-2 gap-6 mb-8">
                        {/* Seller Info */}
                        <Card>
                            <CardHeader className="bg-gray-50">
                                <CardTitle className="text-lg flex items-center gap-2 text-blue-600">
                                    <Building className="h-5 w-5" />
                                    Vendeur
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <p className="font-semibold">{companyInfo.name}</p>
                                <p className="text-sm text-gray-500">{companyInfo.address}</p>
                                <p className="text-sm text-gray-500">{companyInfo.city}</p>
                                <p className="text-sm flex items-center gap-2 mt-2">
                                    <Phone className="h-3 w-3" />
                                    {companyInfo.phone}
                                </p>
                                <p className="text-sm flex items-center gap-2">
                                    <Mail className="h-3 w-3" />
                                    {companyInfo.email}
                                </p>
                            </CardContent>
                        </Card>

                        {type !== "SHIPPING_NOTE_INVOICE" ? (
                            // Client Information
                            <Card>
                                <CardHeader className="bg-gray-50">
                                    <CardTitle className="text-lg flex items-center gap-2 text-blue-600">
                                        <User className="h-5 w-5" />
                                        Client
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    <p className="font-semibold">{clientDetails?.name || "Nom du client"}</p>
                                    <p className="text-sm text-gray-500">{clientDetails?.address || "Adresse"}</p>
                                    <p className="text-sm text-gray-500">
                                        {clientDetails?.postalCode || ""} {clientDetails?.city || "Ville"}
                                    </p>
                                    <p className="text-sm flex items-center gap-2 mt-2">
                                        <Phone className="h-3 w-3" />
                                        {clientDetails?.phone || "Non renseigné"}
                                    </p>
                                    <p className="text-sm flex items-center gap-2">
                                        <Mail className="h-3 w-3" />
                                        {clientDetails?.email || "Email non renseigné"}
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            // Driver Information
                            <Card>
                                <CardHeader className="bg-gray-50">
                                    <CardTitle className="text-lg flex items-center gap-2 text-blue-600">
                                        <Truck className="h-5 w-5" />
                                        Chauffeur et Villes
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="font-semibold">
                                                {`${driverDetails?.firstName || ""} ${driverDetails?.lastName || ""}`.trim() ||
                                                    "Nom du chauffeur"}
                                            </p>
                                            <p className="text-sm flex items-center gap-2 mt-1">
                                                <Phone className="h-3 w-3" />
                                                {driverDetails?.phone || "Non renseigné"}
                                            </p>
                                            <p className="text-sm flex items-center gap-2 mt-1">
                                                <Car className="h-3 w-3" />
                                                {driverDetails?.car?.registration || "Immatriculation non renseignée"}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="font-semibold flex items-center gap-2">
                                                <MapPin className="h-4 w-4 text-blue-600" />
                                                Villes de livraison:
                                            </p>
                                            {cities.length > 0 ? (
                                                <ul className="mt-2 space-y-1">
                                                    {cities.map((cityItem, index) => (
                                                        <li key={cityItem.id || index} className="text-sm flex items-center gap-2">
                                                            <Circle className="h-2 w-2 text-blue-400" />
                                                            {cityItem.city?.name || "Ville inconnue"}
                                                            {cityItem.city?.state && (
                                                                <span className="text-gray-500">({cityItem.city.state})</span>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-sm text-gray-500 mt-2">Aucune ville assignée</p>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Invoice Items Table - Using custom table components */}
                    <div className="rounded-md border overflow-x-auto">
                        <Table className="min-w-full">
                            <TableHeader className="bg-gray-50">
                                <TableRow>
                                    <TableCell isHeader className="text-left font-semibold p-3">
                                        Produit
                                    </TableCell>
                                    <TableCell isHeader className="text-center font-semibold p-3">
                                        Quantité
                                    </TableCell>
                                    <TableCell isHeader className="text-right font-semibold p-3">
                                        Prix unitaire HT
                                    </TableCell>
                                    <TableCell isHeader className="text-center font-semibold p-3">
                                        TVA
                                    </TableCell>
                                    <TableCell isHeader className="text-right font-semibold p-3">
                                        Montant HT
                                    </TableCell>
                                    <TableCell isHeader className="text-right font-semibold p-3">
                                        Montant TVA
                                    </TableCell>
                                    <TableCell isHeader className="text-right font-semibold p-3">
                                        Total TTC
                                    </TableCell>
                                    <TableCell isHeader className="text-center font-semibold p-3">
                                        FODEC
                                    </TableCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoiceItems.length > 0 ? (
                                    invoiceItems.map((item, index) => (
                                        <TableRow key={index} className="border-b">
                                            <TableCell className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <Package className="h-4 w-4 text-blue-600" />
                                                    <div>
                                                        <p className="font-medium">{item.productName}</p>
                                                        <p className="text-xs text-gray-500">Réf: {item.productId}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center p-3">
                                                <Badge variant="secondary">{item.quantity}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right p-3">{item.price.toFixed(3)} TND</TableCell>
                                            <TableCell className="text-center p-3">
                                                <Badge
                                                    variant={item.vatRate === 0 ? "secondary" : item.vatRate <= 10 ? "default" : "warning"}
                                                >
                                                    {item.vatRate}%
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right p-3">{item.totalHT.toFixed(3)} TND</TableCell>
                                            <TableCell className="text-right p-3">{item.vatAmount.toFixed(3)} TND</TableCell>
                                            <TableCell className="text-right p-3 font-bold text-blue-600">
                                                {item.totalTTC.toFixed(3)} TND
                                            </TableCell>
                                            <TableCell className="text-center p-3">
                                                {item.fodecRate > 0 ? (
                                                    <Badge variant="warning">
                                                        {item.fodecRate}%
                                                    </Badge>
                                                ) : (
                                                    <span className="text-xs text-gray-400">-</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                                            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                            <p>Aucun article dans cette facture</p>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Totals and Payment Info */}
                    <div className="grid md:grid-cols-2 gap-6 mt-8">
                        <Card>
                            <CardHeader className="bg-gray-50">
                                <CardTitle className="text-lg flex items-center gap-2 text-blue-600">
                                    <CreditCard className="h-5 w-5" />
                                    Informations de paiement
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500">Mode de paiement</p>
                                        <p className="font-medium">Virement bancaire</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Date d'échéance</p>
                                        <p className="font-medium">
                                            {(() => {
                                                const dueDate = new Date(date);
                                                dueDate.setDate(dueDate.getDate() + 30);
                                                return dueDate.toLocaleDateString("fr-FR");
                                            })()}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">IBAN</p>
                                        <p className="font-medium text-sm">FR76 1234 5678 9012 3456 7890 123</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">BIC</p>
                                        <p className="font-medium">ABCDEDFXXX</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-gray-50 border-blue-200">
                            <CardContent className="pt-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="font-medium">Total HT :</span>
                                        <span>{totalHT.toFixed(3)} TND</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-medium">Total TVA :</span>
                                        <span>{totalVAT.toFixed(3)} TND</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-medium">Total FODEC :</span>
                                        <span>{totalFODEC.toFixed(3)} TND</span>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between text-lg font-bold text-blue-600">
                                        <span>Total TTC (avec FODEC) :</span>
                                        <span>{totalWithFODEC.toFixed(3)} TND</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Notes for Quotation */}
                    {type === "QUOTATION" && (
                        <Card className="mt-6 border-yellow-300 bg-yellow-50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-md flex items-center gap-2 text-yellow-700">
                                    <AlertCircle className="h-5 w-5" />
                                    Note importante
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-yellow-700">
                                    Ce devis est valable 30 jours à compter de sa date d'émission.
                                    Les prix sont exprimés en dinars tunisiens hors taxes.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </CardContent>

                <CardFooter className="bg-gray-50 flex justify-center gap-4 py-4">
                    <Button variant="outline" onClick={() => router.push(getListRoute(type))}>
                        <ArrowLeft className="h-4 w-4" />
                        Retour à la liste
                    </Button>
                    <Button variant="outline" onClick={exportPDF}>
                        <Printer className="h-4 w-4" />
                        Imprimer
                    </Button>
                    <Button variant="default" onClick={exportPDF}>
                        <Download className="h-4 w-4" />
                        Télécharger PDF
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

export default SaleInvoiceDetails;