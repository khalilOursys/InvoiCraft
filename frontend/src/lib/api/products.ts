// lib/api/products.ts
export interface Product {
    id: number;
    name: string;
    reference?: string;
    internalCode?: string;
    description?: string;
    stock: number;
    minStock: number;
    purchasePrice: number;
    marginPercent: number;
    salePrice: number;
    priceIncludingTax: number;
    discount: number;
    vat: number;
    img?: string;
    categoryId: number;
    category?: {
        id: number;
        name: string;
    };
    brandId?: number;
    brand?: {
        id: number;
        name: string;
        img?: string;
    };
}

export interface SearchProductsResponse {
    products: Product[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
}

export async function fetchProducts(searchParams?: {
    search?: string;
    categoryNames?: string[];
    brandNames?: string[];
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    limit?: number;
}): Promise<SearchProductsResponse> {
    const queryParams = new URLSearchParams();
    
    if (searchParams?.search) queryParams.append('search', searchParams.search);
    if (searchParams?.categoryNames?.length) queryParams.append('categoryNames', searchParams.categoryNames.join(','));
    if (searchParams?.brandNames?.length) queryParams.append('brandNames', searchParams.brandNames.join(','));
    if (searchParams?.minPrice) queryParams.append('minPrice', searchParams.minPrice.toString());
    if (searchParams?.maxPrice) queryParams.append('maxPrice', searchParams.maxPrice.toString());
    if (searchParams?.page) queryParams.append('page', searchParams.page.toString());
    if (searchParams?.limit) queryParams.append('limit', searchParams.limit.toString());
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}products/search?${queryParams.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch products');
    return response.json();
}

export async function fetchAllProducts(): Promise<Product[]> {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}products`);
    if (!response.ok) throw new Error('Failed to fetch products');
    return response.json();
}

export async function fetchFilterOptions() {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}products/filter-options`);
    if (!response.ok) throw new Error('Failed to fetch filter options');
    return response.json();
}