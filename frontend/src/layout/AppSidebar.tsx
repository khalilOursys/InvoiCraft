"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import {
  BoxCubeIcon,
  CalenderIcon,
  GridIcon,
  HorizontaLDots,
  ListIcon,
  PageIcon,
  PieChartIcon,
  PlugInIcon,
  TableIcon,
  UserCircleIcon,
} from "../icons/index";
import SidebarWidget from "./SidebarWidget";
import {
  ChevronDownIcon,
  ShoppingCartIcon,
  CarIcon,
  WarehouseIcon,
  FileTextIcon,
  PackageIcon,
  TruckIcon,
  UsersIcon,
  BuildingIcon,
  TagIcon,
  ReceiptIcon,
  FileCheckIcon,
  TrendingUpIcon,
  PackageSearchIcon,
  SettingsIcon
} from "lucide-react";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: {
    name: string;
    path: string;
    pro?: boolean;
    new?: boolean;
    icon?: React.ReactNode;
  }[];
};

const navItems: NavItem[] = [
  // Factures d'achat avec sous-menu
  {
    name: "Factures d'achat",
    icon: <ReceiptIcon size={20} />,
    subItems: [
      {
        name: "Factures d'achat",
        path: "/purchase-invoice/list/PURCHASE_INVOICE",
        icon: <FileCheckIcon size={16} />
      },
      {
        name: "Commandes d'achat",
        path: "/purchase-invoice/list/PURCHASE_ORDER",
        icon: <PackageIcon size={16} />
      },
      {
        name: "Avoirs d'achat",
        path: "/purchase-invoice/list/PURCHASE_REFUND",
        icon: <ReceiptIcon size={16} />
      },
    ],
  },
  // Factures de vente avec sous-menu
  {
    name: "Factures de vente",
    icon: <TableIcon />,
    subItems: [
      {
        name: "Factures de vente",
        path: "/sale-invoice/list/SALE_INVOICE",
        icon: <FileCheckIcon size={16} />
      },
      {
        name: "Bons de livraison",
        path: "/sale-invoice/list/DELIVERY_NOTE",
        icon: <TruckIcon size={16} />
      },
      {
        name: "Devis",
        path: "/sale-invoice/list/QUOTATION",
        icon: <FileTextIcon size={16} />
      },
    ],
  },
  {
    name: "Vente comptoir",
    icon: <TrendingUpIcon />,
    subItems: [
      {
        name: "Point de vente",
        icon: <ShoppingCartIcon size={20} />,
        path: "/pos",
      },
    ],
  },
  {
    name: "Produits & Stocks",
    icon: <PackageSearchIcon />,
    subItems: [
      {
        name: "Produits",
        icon: <BoxCubeIcon />,
        path: "/products",
      },
      {
        name: "Marques",
        icon: <PieChartIcon />,
        path: "/brands",
      },
      {
        name: "Catégories",
        icon: <ListIcon />,
        path: "/categories",
      },
      {
        name: "Inventaire",
        icon: <WarehouseIcon size={20} />,
        path: "/inventory",
      },
    ],
  },
  {
    name: "Settings",
    icon: <SettingsIcon />,
    subItems: [
      {
        name: "Voitures",
        icon: <CarIcon size={20} />,
        path: "/cars",
      },
      {
        name: "Chauffeurs",
        icon: <UserCircleIcon />,
        path: "/drivers",
      },
      {
        name: "Clients",
        icon: <UsersIcon size={20} />,
        path: "/clients",
      },
      {
        name: "Fournisseurs",
        icon: <BuildingIcon size={20} />,
        path: "/suppliers",
      },
    ],
  },
];

const othersItems: NavItem[] = [
  {
    icon: <PieChartIcon />,
    name: "Graphiques",
    subItems: [
      { name: "Graphique linéaire", path: "/line-chart", pro: false, icon: <PieChartIcon /> },
      { name: "Graphique à barres", path: "/bar-chart", pro: false, icon: <PieChartIcon /> },
    ],
  },
  {
    icon: <BoxCubeIcon />,
    name: "Éléments d'interface",
    subItems: [
      { name: "Alertes", path: "/alerts", pro: false, icon: <ListIcon /> },
      { name: "Avatars", path: "/avatars", pro: false, icon: <UserCircleIcon /> },
      { name: "Badges", path: "/badge", pro: false, icon: <TagIcon size={16} /> },
      { name: "Boutons", path: "/buttons", pro: false, icon: <BoxCubeIcon /> },
      { name: "Images", path: "/images", pro: false, icon: <GridIcon /> },
      { name: "Vidéos", path: "/videos", pro: false, icon: <GridIcon /> },
    ],
  },
  {
    icon: <PlugInIcon />,
    name: "Authentification",
    subItems: [
      { name: "Connexion", path: "/signin", pro: false, icon: <UserCircleIcon /> },
      { name: "Inscription", path: "/signup", pro: false, icon: <UserCircleIcon /> },
    ],
  },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "others";
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {}
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = useCallback((path: string) => path === pathname, [pathname]);

  const renderMenuItems = (
    navItems: NavItem[],
    menuType: "main" | "others"
  ) => (
    <ul className="flex flex-col gap-4">
      {navItems.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group  ${openSubmenu?.type === menuType && openSubmenu?.index === index
                ? "menu-item-active"
                : "menu-item-inactive"
                } cursor-pointer ${!isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
                }`}
            >
              <span
                className={` ${openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-icon-active"
                  : "menu-item-icon-inactive"
                  }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className={`menu-item-text`}>{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200  ${openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                    ? "rotate-180 text-brand-500"
                    : ""
                    }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                className={`menu-item group ${isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                  }`}
              >
                <span
                  className={`${isActive(nav.path)
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                    }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className={`menu-item-text`}>{nav.name}</span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-2 space-y-1 ml-9">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      href={subItem.path}
                      className={`menu-dropdown-item flex items-center ${isActive(subItem.path)
                        ? "menu-dropdown-item-active"
                        : "menu-dropdown-item-inactive"
                        }`}
                    >
                      {/* Subitem Icon */}
                      {subItem.icon && (
                        <span className="mr-2.5 text-gray-500 dark:text-gray-400 flex-shrink-0">
                          {subItem.icon}
                        </span>
                      )}
                      <span className="flex-1">{subItem.name}</span>
                      <span className="flex items-center gap-1 ml-auto">
                        {subItem.new && (
                          <span
                            className={`ml-auto ${isActive(subItem.path)
                              ? "menu-dropdown-badge-active"
                              : "menu-dropdown-badge-inactive"
                              } menu-dropdown-badge`}
                          >
                            nouveau
                          </span>
                        )}
                        {subItem.pro && (
                          <span
                            className={`ml-auto ${isActive(subItem.path)
                              ? "menu-dropdown-badge-active"
                              : "menu-dropdown-badge-inactive"
                              } menu-dropdown-badge`}
                          >
                            pro
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  useEffect(() => {
    let submenuMatched = false;
    ["main", "others"].forEach((menuType) => {
      const items = menuType === "main" ? navItems : othersItems;
      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem) => {
            if (isActive(subItem.path)) {
              setOpenSubmenu({
                type: menuType as "main" | "others",
                index,
              });
              submenuMatched = true;
            }
          });
        } else if (nav.path && isActive(nav.path)) {
          if (openSubmenu !== null) {
            setOpenSubmenu(null);
          }
        }
      });
    });

    if (!submenuMatched && openSubmenu !== null) {
      setOpenSubmenu(null);
    }
  }, [pathname, isActive]);

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, menuType: "main" | "others") => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${isExpanded || isMobileOpen
          ? "w-[290px]"
          : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 flex  ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
          }`}
      >
        <Link href="/">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <Image
                className="dark:hidden"
                src="/images/logo/logo-oursys.png"
                alt="Logo"
                width={150}
                height={40}
              />
              <Image
                className="hidden dark:block"
                src="/images/logo/logo-dark.svg"
                alt="Logo"
                width={150}
                height={40}
              />
            </>
          ) : (
            <Image
              src="/images/logo/logo-icon.svg"
              alt="Logo"
              width={32}
              height={32}
            />
          )}
        </Link>
      </div>
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${!isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "justify-start"
                  }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Menu"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(navItems, "main")}
            </div>

            {/* Uncomment if you want to show Others section */}
            {/* <div className="">
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Autres"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(othersItems, "others")}
            </div> */}
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;