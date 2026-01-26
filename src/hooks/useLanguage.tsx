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
    'action.add': 'Add',
    'action.saving': 'Saving...',
    'action.saveAssignments': 'Save Assignments',
    
    // Product Requests
    'productRequests.title': 'New Product Requests',
    'productRequests.subtitle': 'Manage new product onboarding and approvals',
    'productRequests.noRequests': 'No product requests yet',
    'productRequests.startByCreating': 'Start by creating a new product request',
    'productRequests.deleteConfirm': 'Are you sure you want to delete this product request?',
    'productRequests.deleteSuccess': 'Product request deleted successfully',
    'productRequests.deleteError': 'Failed to delete product request',
    'productRequests.viewAll': 'All',
    'productRequests.viewEngineering': 'Engineering',
    'productRequests.viewDesign': 'Design',
    'productRequests.noRequestsInView': 'No requests in this view',
    'productRequests.noRequestsInViewDesc': 'There are no requests matching the current filter',
    'productRequests.clientApprovers': 'Client Design Approvers',
    'productRequests.clientApproversDescription': 'Client contacts who will approve design versions',
    'productRequests.internalContacts': 'Internal Notification Contacts',
    'productRequests.internalContactsDescription': 'Team members to notify about updates and PO uploads',
    'productRequests.teamAssignments': 'Team Assignments',
    'productRequests.assignTeamMembers': 'Assign engineering and design team members',
    'productRequests.assignedEngineer': 'Assigned Engineer',
    'productRequests.assignedDesigner': 'Assigned Designer',
    'productRequests.selectEngineer': 'Select an engineer',
    'productRequests.selectDesigner': 'Select a designer',
    'productRequests.notAssigned': 'Not assigned',
    'productRequests.assignmentSaved': 'Assignment saved successfully',
    'productRequests.assignmentError': 'Failed to save assignment',
    
    // Table headers
    'table.productName': 'Product Name',
    'table.customer': 'Customer',
    'table.status': 'Status',
    'table.created': 'Created',
    'table.updated': 'Updated',
    'table.actions': 'Actions',
    'table.name': 'Name',
    'table.email': 'Email',
    'table.role': 'Role',
    'table.engineeringStatus': 'Engineering Status',
    'table.designStatus': 'Design Status',
    
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
    'status.pending': 'Pending',
    'status.approved': 'Approved',
    'status.inReview': 'In Review',
    
    // Settings
    'settings.title': 'Settings',
    'settings.subtitle': 'Manage your account and notification preferences',
    'settings.language': 'Language',
    'settings.languageDesc': 'Choose your preferred language',
    'settings.english': 'English',
    'settings.spanish': 'Spanish',
    
    // Team Management
    'teamManagement.title': 'Team Management',
    'teamManagement.subtitle': 'Manage engineers, designers, and other team members',
    'teamManagement.addMember': 'Add Member',
    'teamManagement.editMember': 'Edit Member',
    'teamManagement.fullName': 'Full Name',
    'teamManagement.email': 'Email',
    'teamManagement.role': 'Role',
    'teamManagement.selectRole': 'Select a role',
    'teamManagement.active': 'Active',
    'teamManagement.noMembers': 'No team members added yet',
    'teamManagement.memberAdded': 'Member Added',
    'teamManagement.memberAddedDesc': 'Team member has been added successfully',
    'teamManagement.memberUpdated': 'Member Updated',
    'teamManagement.memberUpdatedDesc': 'Team member has been updated successfully',
    'teamManagement.memberDeleted': 'Member Deleted',
    'teamManagement.memberDeletedDesc': 'Team member has been removed',
    
    // Team Roles
    'teamRoles.engineering_leader': 'Engineering Leader',
    'teamRoles.engineer': 'Engineer',
    'teamRoles.design_leader': 'Design Leader',
    'teamRoles.designer': 'Designer',
    'teamRoles.sales_rep': 'Sales Rep',
    'teamRoles.customer_service': 'Customer Service',
    
    // Common
    'common.loading': 'Loading',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.add': 'Add',
    'common.actions': 'Actions',
    
    // User info
    'user.admin': 'Admin',
    'user.customer': 'Customer',
    'user.viewingAsCustomer': 'Viewing as Customer',
    
    // Product Lines
    'productLine.sello_lateral': 'Side Seal Bag',
    'productLine.sello_lateral.desc': 'Side seal bags with optional zipper',
    'productLine.bag_wicket': 'Wicket Bag',
    'productLine.bag_wicket.desc': 'Bags with wicket for automated packaging lines',
    'productLine.film': 'Film / Rollstock',
    'productLine.film.desc': 'Printed film rolls for form-fill-seal machines',
    'productLine.pouch': 'Stand Up Pouch',
    'productLine.pouch.desc': 'Laminated pouches with bottom gusset (Doypack)',
    'productLine.selected': 'Selected',
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
    'action.add': 'Agregar',
    'action.saving': 'Guardando...',
    'action.saveAssignments': 'Guardar Asignaciones',
    
    // Product Requests
    'productRequests.title': 'Altas de Producto',
    'productRequests.subtitle': 'Gestiona las altas de nuevos productos y aprobaciones',
    'productRequests.noRequests': 'No hay solicitudes de producto',
    'productRequests.startByCreating': 'Comienza creando una nueva solicitud',
    'productRequests.deleteConfirm': '¿Estás seguro de que deseas eliminar esta solicitud de producto?',
    'productRequests.deleteSuccess': 'Solicitud de producto eliminada exitosamente',
    'productRequests.deleteError': 'Error al eliminar la solicitud de producto',
    'productRequests.viewAll': 'Todas',
    'productRequests.viewEngineering': 'Ingeniería',
    'productRequests.viewDesign': 'Diseño',
    'productRequests.noRequestsInView': 'No hay solicitudes en esta vista',
    'productRequests.noRequestsInViewDesc': 'No hay solicitudes que coincidan con el filtro actual',
    'productRequests.clientApprovers': 'Aprobadores de Diseño del Cliente',
    'productRequests.clientApproversDescription': 'Contactos del cliente que aprobarán versiones de diseño',
    'productRequests.internalContacts': 'Contactos Internos de Notificación',
    'productRequests.internalContactsDescription': 'Miembros del equipo a notificar sobre actualizaciones y subidas de OC',
    'productRequests.teamAssignments': 'Asignaciones de Equipo',
    'productRequests.assignTeamMembers': 'Asignar miembros del equipo de ingeniería y diseño',
    'productRequests.assignedEngineer': 'Ingeniero Asignado',
    'productRequests.assignedDesigner': 'Diseñador Asignado',
    'productRequests.selectEngineer': 'Seleccionar ingeniero',
    'productRequests.selectDesigner': 'Seleccionar diseñador',
    'productRequests.notAssigned': 'Sin asignar',
    'productRequests.assignmentSaved': 'Asignación guardada correctamente',
    'productRequests.assignmentError': 'Error al guardar la asignación',
    
    // Table headers
    'table.productName': 'Nombre del Producto',
    'table.customer': 'Cliente',
    'table.status': 'Estado',
    'table.created': 'Creado',
    'table.updated': 'Actualizado',
    'table.actions': 'Acciones',
    'table.name': 'Nombre',
    'table.email': 'Correo',
    'table.role': 'Rol',
    'table.engineeringStatus': 'Estado Ingeniería',
    'table.designStatus': 'Estado Diseño',
    
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
    'status.pending': 'Pendiente',
    'status.approved': 'Aprobado',
    'status.inReview': 'En Revisión',
    
    // Settings
    'settings.title': 'Configuración',
    'settings.subtitle': 'Administra tu cuenta y preferencias de notificación',
    'settings.language': 'Idioma',
    'settings.languageDesc': 'Elige tu idioma preferido',
    'settings.english': 'Inglés',
    'settings.spanish': 'Español',
    
    // Team Management
    'teamManagement.title': 'Gestión de Equipo',
    'teamManagement.subtitle': 'Administra ingenieros, diseñadores y otros miembros del equipo',
    'teamManagement.addMember': 'Agregar Miembro',
    'teamManagement.editMember': 'Editar Miembro',
    'teamManagement.fullName': 'Nombre Completo',
    'teamManagement.email': 'Correo Electrónico',
    'teamManagement.role': 'Rol',
    'teamManagement.selectRole': 'Selecciona un rol',
    'teamManagement.active': 'Activo',
    'teamManagement.noMembers': 'No hay miembros del equipo aún',
    'teamManagement.memberAdded': 'Miembro Agregado',
    'teamManagement.memberAddedDesc': 'El miembro del equipo ha sido agregado exitosamente',
    'teamManagement.memberUpdated': 'Miembro Actualizado',
    'teamManagement.memberUpdatedDesc': 'El miembro del equipo ha sido actualizado exitosamente',
    'teamManagement.memberDeleted': 'Miembro Eliminado',
    'teamManagement.memberDeletedDesc': 'El miembro del equipo ha sido removido',
    
    // Team Roles
    'teamRoles.engineering_leader': 'Líder de Ingeniería',
    'teamRoles.engineer': 'Ingeniero',
    'teamRoles.design_leader': 'Líder de Diseño',
    'teamRoles.designer': 'Diseñador',
    'teamRoles.sales_rep': 'Representante de Ventas',
    'teamRoles.customer_service': 'Servicio al Cliente',
    
    // Common
    'common.loading': 'Cargando',
    'common.cancel': 'Cancelar',
    'common.save': 'Guardar',
    'common.add': 'Agregar',
    'common.actions': 'Acciones',
    
    // User info
    'user.admin': 'Administrador',
    'user.customer': 'Cliente',
    'user.viewingAsCustomer': 'Viendo como Cliente',
    
    // Product Lines
    'productLine.sello_lateral': 'Sello Lateral',
    'productLine.sello_lateral.desc': 'Bolsas de sello lateral con zipper opcional',
    'productLine.bag_wicket': 'Bolsa Wicket',
    'productLine.bag_wicket.desc': 'Bolsas con wicket para líneas de empaque automatizado',
    'productLine.film': 'Bobina / Rollstock',
    'productLine.film.desc': 'Rollos de película impresos para máquinas form-fill-seal',
    'productLine.pouch': 'Stand Up Pouch',
    'productLine.pouch.desc': 'Pouches laminados con fuelle de fondo (Doypack)',
    'productLine.selected': 'Seleccionado',
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
