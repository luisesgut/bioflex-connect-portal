import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

type Language = 'en' | 'es';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.products': 'Products',
    'nav.purchaseOrders': 'Purchase Orders',
    'nav.newProductRequests': 'New Product Requests',
    'nav.releaseRequests': 'Release Requests',
    'nav.nonConformance': 'Non-Conformance',
    'nav.changeRequests': 'Change Requests',
    'nav.productCodes': 'Product Codes',
    'nav.inventory': 'Inventory',
    'nav.shippingLoads': 'Shipping Loads',
    'nav.shippedPallets': 'Shipped Pallets',
    'nav.settings': 'Settings',
    'nav.signOut': 'Sign Out',
    'nav.admin': 'Admin',
    'nav.customerView': 'Customer View',
    'nav.adminView': 'Admin View',
    
    // Common actions
    'action.delete': 'Delete',
    'action.edit': 'Edit',
    'action.view': 'View',
    'action.save': 'Save',
    'action.cancel': 'Cancel',
    'action.confirm': 'Confirm',
    'action.create': 'Create',
    'action.newRequest': 'New Request',
    
    // Product Requests
    'productRequests.title': 'New Product Requests',
    'productRequests.subtitle': 'Manage new product onboarding and approvals',
    'productRequests.noRequests': 'No product requests yet',
    'productRequests.startByCreating': 'Start by creating a new product request',
    'productRequests.deleteConfirm': 'Are you sure you want to delete this product request?',
    'productRequests.deleteSuccess': 'Product request deleted successfully',
    'productRequests.deleteError': 'Failed to delete product request',
    
    // Table headers
    'table.productName': 'Product Name',
    'table.customer': 'Customer',
    'table.status': 'Status',
    'table.created': 'Created',
    'table.updated': 'Updated',
    'table.actions': 'Actions',
    
    // Status labels
    'status.draft': 'Draft',
    'status.specsSubmitted': 'Specs Submitted',
    'status.artworkUploaded': 'Artwork Uploaded',
    'status.pcInReview': 'PC In Review',
    'status.pcApproved': 'PC Approved',
    'status.bionetPending': 'Bionet Pending',
    'status.bionetRegistered': 'Bionet Registered',
    'status.sapPending': 'SAP Pending',
    'status.sapRegistered': 'SAP Registered',
    'status.completed': 'Completed',
    'status.inProgress': 'In Progress',
    
    // Settings
    'settings.title': 'Settings',
    'settings.subtitle': 'Manage your account and notification preferences',
    'settings.language': 'Language',
    'settings.languageDesc': 'Choose your preferred language',
    'settings.english': 'English',
    'settings.spanish': 'Spanish',
    
    // User info
    'user.admin': 'Admin',
    'user.customer': 'Customer',
    'user.viewingAsCustomer': 'Viewing as Customer',
  },
  es: {
    // Navigation
    'nav.dashboard': 'Panel',
    'nav.products': 'Productos',
    'nav.purchaseOrders': 'Órdenes de Compra',
    'nav.newProductRequests': 'Altas de Producto',
    'nav.releaseRequests': 'Solicitudes de Liberación',
    'nav.nonConformance': 'No Conformidades',
    'nav.changeRequests': 'Solicitudes de Cambio',
    'nav.productCodes': 'Códigos de Producto',
    'nav.inventory': 'Inventario',
    'nav.shippingLoads': 'Cargas de Envío',
    'nav.shippedPallets': 'Tarimas Enviadas',
    'nav.settings': 'Configuración',
    'nav.signOut': 'Cerrar Sesión',
    'nav.admin': 'Admin',
    'nav.customerView': 'Vista Cliente',
    'nav.adminView': 'Vista Admin',
    
    // Common actions
    'action.delete': 'Eliminar',
    'action.edit': 'Editar',
    'action.view': 'Ver',
    'action.save': 'Guardar',
    'action.cancel': 'Cancelar',
    'action.confirm': 'Confirmar',
    'action.create': 'Crear',
    'action.newRequest': 'Nueva Solicitud',
    
    // Product Requests
    'productRequests.title': 'Altas de Producto',
    'productRequests.subtitle': 'Gestiona las altas de nuevos productos y aprobaciones',
    'productRequests.noRequests': 'No hay solicitudes de producto',
    'productRequests.startByCreating': 'Comienza creando una nueva solicitud',
    'productRequests.deleteConfirm': '¿Estás seguro de que deseas eliminar esta solicitud de producto?',
    'productRequests.deleteSuccess': 'Solicitud de producto eliminada exitosamente',
    'productRequests.deleteError': 'Error al eliminar la solicitud de producto',
    
    // Table headers
    'table.productName': 'Nombre del Producto',
    'table.customer': 'Cliente',
    'table.status': 'Estado',
    'table.created': 'Creado',
    'table.updated': 'Actualizado',
    'table.actions': 'Acciones',
    
    // Status labels
    'status.draft': 'Borrador',
    'status.specsSubmitted': 'Especificaciones Enviadas',
    'status.artworkUploaded': 'Arte Subido',
    'status.pcInReview': 'PC en Revisión',
    'status.pcApproved': 'PC Aprobado',
    'status.bionetPending': 'Bionet Pendiente',
    'status.bionetRegistered': 'Bionet Registrado',
    'status.sapPending': 'SAP Pendiente',
    'status.sapRegistered': 'SAP Registrado',
    'status.completed': 'Completado',
    'status.inProgress': 'En Proceso',
    
    // Settings
    'settings.title': 'Configuración',
    'settings.subtitle': 'Administra tu cuenta y preferencias de notificación',
    'settings.language': 'Idioma',
    'settings.languageDesc': 'Elige tu idioma preferido',
    'settings.english': 'Inglés',
    'settings.spanish': 'Español',
    
    // User info
    'user.admin': 'Administrador',
    'user.customer': 'Cliente',
    'user.viewingAsCustomer': 'Viendo como Cliente',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app-language');
    return (saved === 'es' || saved === 'en') ? saved : 'en';
  });

  useEffect(() => {
    localStorage.setItem('app-language', language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
