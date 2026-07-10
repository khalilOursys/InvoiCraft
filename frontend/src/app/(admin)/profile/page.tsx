// app/admin/profile/page.tsx
"use client";

import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Toast from "@radix-ui/react-toast";
import { ArrowLeft, Save, Upload, X, User, Building, Mail, Phone, MapPin, Globe, Briefcase } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";

// ==================== TYPES ====================

interface ProfileData {
    id: string;
    companyName: string;
    email: string;
    phone: string;
    address: string;
    taxNumber?: string;
    rib?: string;
    logo?: string;
    createdAt: string;
    updatedAt: string;
}

interface UpdateProfileDto {
    companyName?: string;
    email?: string;
    phone?: string;
    address?: string;
    taxNumber?: string;
    rib?: string;
}

// ==================== API FUNCTIONS ====================

const fetchProfile = async (): Promise<ProfileData> => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}company-settings`);
    if (!response.ok) throw new Error("Failed to fetch profile");
    return response.json();
};

// API 1: Update profile information (without logo)
const updateProfile = async (data: UpdateProfileDto): Promise<ProfileData> => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}company-settings`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update profile");
    }
    return response.json();
};

// API 2: Upload logo only
const uploadLogo = async (file: File): Promise<{ logo: string }> => {
    const formData = new FormData();
    formData.append("logo", file);

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}company-settings/logo`, {
        method: "POST",
        body: formData,
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to upload logo");
    }
    return response.json();
};

// API 3: Delete logo
const deleteLogo = async (): Promise<void> => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}company-settings/logo`, {
        method: "DELETE",
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete logo");
    }
};

// Helper function to get full logo URL
const getLogoUrl = (logoPath?: string): string => {
    if (!logoPath) return "";
    // If it's already a full URL, return it
    if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) {
        return logoPath;
    }
    // If it's a relative path starting with /uploads, prepend the API URL
    if (logoPath.startsWith('/uploads')) {
        return `${process.env.NEXT_PUBLIC_API_URL}${logoPath}`;
    }
    // Otherwise, assume it's just the filename and construct the full path
    return `${process.env.NEXT_PUBLIC_API_URL}uploads/company/${logoPath}`;
};

// ==================== COMPONENT ====================

export default function ProfilePage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    // State
    const [formData, setFormData] = useState<UpdateProfileDto>({
        companyName: "",
        email: "",
        phone: "",
        address: "",
        taxNumber: "",
        rib: "",
    });
    const [logoPreview, setLogoPreview] = useState<string>("");
    const [isDragging, setIsDragging] = useState(false);
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMsg, setToastMsg] = useState("");
    const [toastType, setToastType] = useState<"success" | "error">("success");
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ==================== QUERIES ====================

    const { data: profile, isLoading } = useQuery<ProfileData>({
        queryKey: ["profile"],
        queryFn: fetchProfile,
    });

    // Update form data when profile loads
    React.useEffect(() => {
        if (profile) {
            setFormData({
                companyName: profile.companyName || "",
                email: profile.email || "",
                phone: profile.phone || "",
                address: profile.address || "",
                taxNumber: profile.taxNumber || "",
                rib: profile.rib || "",
            });
            setLogoPreview(getLogoUrl(profile.logo));
        }
    }, [profile]);

    // ==================== MUTATIONS ====================

    // Mutation for updating profile information (without logo)
    const updateProfileMutation = useMutation({
        mutationFn: updateProfile,
        onSuccess: (data) => {
            queryClient.setQueryData(["profile"], data);
            showToast("✅ Profile updated successfully", "success");
        },
        onError: (error: Error) => {
            showToast(`❌ ${error.message}`, "error");
        },
    });

    // Mutation for uploading logo
    const uploadLogoMutation = useMutation({
        mutationFn: uploadLogo,
        onSuccess: (data) => {
            // Update the profile data in cache with the new logo
            const currentProfile = queryClient.getQueryData<ProfileData>(["profile"]);
            if (currentProfile) {
                queryClient.setQueryData(["profile"], {
                    ...currentProfile,
                    logo: data.logo,
                });
            }
            setLogoPreview(data.logo);
            showToast("✅ Logo uploaded successfully", "success");
        },
        onError: (error: Error) => {
            showToast(`❌ ${error.message}`, "error");
        },
    });

    // Mutation for deleting logo
    const deleteLogoMutation = useMutation({
        mutationFn: deleteLogo,
        onSuccess: () => {
            setLogoPreview("");
            // Update the profile data in cache to remove logo
            const currentProfile = queryClient.getQueryData<ProfileData>(["profile"]);
            if (currentProfile) {
                queryClient.setQueryData(["profile"], {
                    ...currentProfile,
                    logo: "",
                });
            }
            showToast("✅ Logo removed successfully", "success");
        },
        onError: (error: Error) => {
            showToast(`❌ ${error.message}`, "error");
        },
    });

    // ==================== HANDLERS ====================

    const showToast = (msg: string, type: "success" | "error" = "success") => {
        setToastMsg(msg);
        setToastType(type);
        setToastOpen(true);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateProfileMutation.mutate(formData);
    };

    const handleFileUpload = (file: File) => {
        // Validate file type
        const validTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
        if (!validTypes.includes(file.type)) {
            showToast("❌ Please upload PNG, JPG, WEBP, or SVG images", "error");
            return;
        }

        // Validate file size (2MB)
        if (file.size > 2 * 1024 * 1024) {
            showToast("❌ File size should be less than 2MB", "error");
            return;
        }

        // Preview
        const reader = new FileReader();
        reader.onload = (e) => {
            setLogoPreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);

        // Upload
        uploadLogoMutation.mutate(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileUpload(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileUpload(file);
    };

    const handleRemoveLogo = () => {
        if (logoPreview && logoPreview !== "") {
            deleteLogoMutation.mutate();
        }
    };

    const handleBack = () => {
        router.push("/admin/dashboard");
    };

    // ==================== LOADING STATE ====================

    if (isLoading) {
        return (
            <div className="p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
                <div className="flex justify-center items-center h-64">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                </div>
            </div>
        );
    }

    // ==================== RENDER ====================

    return (
        <Toast.Provider>
            <div className="p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={handleBack}
                        className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back to Dashboard
                    </button>
                    <h1 className="text-2xl font-bold text-black dark:text-white">
                        Profile Settings
                    </h1>
                    <div className="w-32"></div> {/* Spacer for alignment */}
                </div>

                <div className="space-y-6">
                    {/* ==================== LOGO SECTION ==================== */}
                    <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
                        <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
                            <h3 className="text-lg font-semibold text-black dark:text-white flex items-center gap-2">
                                <Building className="w-5 h-5" />
                                Company Logo
                            </h3>
                        </div>

                        <div className="p-6.5">
                            <div className="flex flex-col md:flex-row items-start gap-6">
                                {/* Logo Preview */}
                                <div className="relative h-32 w-32 flex-shrink-0 overflow-hidden rounded-lg border-2 border-stroke bg-gray-50 dark:bg-gray-800">
                                    {logoPreview ? (
                                        <Image
                                            src={logoPreview}
                                            alt="Company logo"
                                            fill
                                            className="object-cover"
                                            unoptimized={true}
                                        />
                                    ) : (
                                        <div className="flex h-full w-full flex-col items-center justify-center text-gray-400">
                                            <Building className="h-12 w-12" />
                                            <span className="text-xs mt-1">No logo</span>
                                        </div>
                                    )}
                                </div>

                                {/* Upload Area */}
                                <div className="flex-1 w-full">
                                    <div
                                        onDrop={handleDrop}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${isDragging
                                            ? "border-primary bg-primary/5 dark:bg-primary/10"
                                            : "border-stroke hover:border-primary dark:border-strokedark"
                                            }`}
                                    >
                                        <Upload className="mx-auto h-8 w-8 text-gray-400" />
                                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                            Drag & drop your logo here, or{" "}
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="text-primary hover:underline font-medium"
                                            >
                                                browse files
                                            </button>
                                        </p>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".png,.jpg,.jpeg,.webp,.svg"
                                            onChange={handleFileInput}
                                            className="hidden"
                                        />
                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                                            PNG, JPG, WEBP, SVG • Max 2MB • Recommended: 500x500px
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploadLogoMutation.isPending}
                                            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
                                        >
                                            {uploadLogoMutation.isPending ? (
                                                <>
                                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                                    Uploading...
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="h-4 w-4" />
                                                    Upload Logo
                                                </>
                                            )}
                                        </button>

                                        {logoPreview && logoPreview !== "" && (
                                            <button
                                                type="button"
                                                onClick={handleRemoveLogo}
                                                disabled={deleteLogoMutation.isPending}
                                                className="flex items-center gap-2 rounded-md border border-red-500 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                                            >
                                                {deleteLogoMutation.isPending ? (
                                                    <>
                                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
                                                        Removing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <X className="h-4 w-4" />
                                                        Remove Logo
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>

                                    {/* Upload Progress */}
                                    {uploadLogoMutation.isPending && (
                                        <div className="mt-3">
                                            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                                <div className="h-full bg-primary animate-pulse rounded-full" style={{ width: "100%" }} />
                                            </div>
                                            <p className="mt-1 text-xs text-gray-500">Uploading logo...</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ==================== PROFILE INFORMATION SECTION ==================== */}
                    <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
                        <div className="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
                            <h3 className="text-lg font-semibold text-black dark:text-white flex items-center gap-2">
                                <User className="w-5 h-5" />
                                Profile Information
                            </h3>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="p-6.5">
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    {/* Company Name */}
                                    <div>
                                        <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                                            Company Name
                                        </label>
                                        <div className="relative">
                                            <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                            <input
                                                type="text"
                                                name="companyName"
                                                value={formData.companyName}
                                                onChange={handleFormChange}
                                                className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent pl-10 pr-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                                                placeholder="Company Name"
                                            />
                                        </div>
                                    </div>

                                    {/* Email */}
                                    <div>
                                        <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                                            Email Address
                                        </label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                            <input
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleFormChange}
                                                className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent pl-10 pr-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                                                placeholder="company@example.com"
                                            />
                                        </div>
                                    </div>

                                    {/* Phone */}
                                    <div>
                                        <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                                            Phone Number
                                        </label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                            <input
                                                type="tel"
                                                name="phone"
                                                value={formData.phone}
                                                onChange={handleFormChange}
                                                className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent pl-10 pr-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                                                placeholder="+216 XX XXX XXX"
                                            />
                                        </div>
                                    </div>

                                    {/* Address */}
                                    <div>
                                        <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                                            Address
                                        </label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                            <input
                                                type="text"
                                                name="address"
                                                value={formData.address}
                                                onChange={handleFormChange}
                                                className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent pl-10 pr-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                                                placeholder="123 Business Street, City"
                                            />
                                        </div>
                                    </div>

                                    {/* Tax Number */}
                                    <div>
                                        <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                                            Tax Number
                                        </label>
                                        <div className="relative">
                                            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                            <input
                                                type="text"
                                                name="taxNumber"
                                                value={formData.taxNumber}
                                                onChange={handleFormChange}
                                                className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent pl-10 pr-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                                                placeholder="123456789"
                                            />
                                        </div>
                                    </div>

                                    {/* RIB */}
                                    <div>
                                        <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                                            RIB
                                        </label>
                                        <div className="relative">
                                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                            <input
                                                type="text"
                                                name="rib"
                                                value={formData.rib}
                                                onChange={handleFormChange}
                                                className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent pl-10 pr-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                                                placeholder="RI123456789"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Save Button */}
                                <div className="mt-6">
                                    <button
                                        type="submit"
                                        disabled={updateProfileMutation.isPending}
                                        className=" border border-stroke flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
                                    >
                                        {updateProfileMutation.isPending ? (
                                            <>
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="h-5 w-5" />
                                                Save Profile
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>

                {/* ==================== TOAST ==================== */}
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
                <Toast.Viewport className="fixed top-4 right-4 z-50 outline-none" />
            </div>
        </Toast.Provider>
    );
}