import { useState, useEffect } from "react";
import { openStorageFile } from "@/hooks/useOpenStorageFile";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  FileText, 
  Upload, 
  Check, 
  X, 
  Clock, 
  ExternalLink,
  ChevronRight,
  MessageSquare,
  Pencil,
  Save,
  Loader2
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useParams } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EngineeringReviewCard } from "@/components/product-requests/EngineeringReviewCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ProductRequestStatus = 
  | 'draft'
  | 'specs_submitted'
  | 'artwork_uploaded'
  | 'pc_in_review'
  | 'pc_approved'
  | 'bionet_pending'
  | 'bionet_registered'
  | 'sap_pending'
  | 'sap_registered'
  | 'completed';

type PCVersionStatus = 'pending' | 'approved' | 'rejected' | 'superseded';

type EngineeringStatus = 'pending' | 'approved' | 'changes_required' | 'customer_review';

interface EngineeringProposal {
  id: string;
  version_number: number;
  proposed_by: string;
  proposed_at: string;
  width_cm: number | null;
  length_cm: number | null;
  gusset_cm: number | null;
  zipper_cm: number | null;
  thickness_value: number | null;
  thickness_unit: 'gauge' | 'microns';
  proposed_structure: string | null;
  original_width_cm: number | null;
  original_length_cm: number | null;
  original_gusset_cm: number | null;
  original_zipper_cm: number | null;
  original_thickness_value: number | null;
  original_thickness_unit: 'gauge' | 'microns' | null;
  original_structure: string | null;
  reason: string;
  customer_approved: boolean | null;
  customer_response_at: string | null;
  customer_feedback: string | null;
  is_active: boolean;
}

interface ProductRequest {
  id: string;
  product_name: string;
  customer: string | null;
  item_description: string | null;
  item_type: string | null;
  product_line: string | null;
  item_id_code: string | null;
  customer_item_code: string | null;
  
  // Measurements in inches
  width_inches: number | null;
  length_inches: number | null;
  gusset_inches: number | null;
  zipper_inches: number | null;
  lip_front_inches: number | null;
  lip_back_inches: number | null;
  flip_size_inches: number | null;
  
  // Measurements in cm
  width_cm: number | null;
  length_cm: number | null;
  gusset_cm: number | null;
  zipper_cm: number | null;
  lip_front_cm: number | null;
  lip_back_cm: number | null;
  flip_size_cm: number | null;
  
  // Thickness
  thickness_value: number | null;
  thickness_unit: 'gauge' | 'microns' | null;
  
  // Film specs
  film_type: string | null;
  seal_type: string | null;
  extrusion_type: string | null;
  clarity_grade: string | null;
  
  // Vents
  vents_count: number | null;
  vent_size: string | null;
  vents_across: number | null;
  vents_down: number | null;
  
  // Wicket
  wicket_size: string | null;
  wicket_hole: string | null;
  bags_per_wicket: number | null;
  
  // Packaging
  bags_per_case: number | null;
  cases_per_pallet: number | null;
  pallet_size: string | null;
  box_color: string | null;
  
  // Print
  pms_colors: string[] | null;
  eye_mark: string | null;
  upc_number: string | null;
  language: string | null;
  country_of_origin: string | null;
  
  // Legacy fields
  ancho: number | null;
  alto: number | null;
  material: string | null;
  estructura: string | null;
  tipo_empaque: string | null;
  pieces_per_pallet: number | null;
  
  artwork_files: string[] | null;
  tech_spec_pdf_url: string | null;
  tech_spec_filename: string | null;
  status: ProductRequestStatus;
  notes: string | null;
  bionet_code: string | null;
  bionet_registered_at: string | null;
  sap_code: string | null;
  sap_registered_at: string | null;
  created_at: string;
  updated_at: string;
  
  // Engineering fields
  engineering_status: EngineeringStatus | null;
  engineering_notes: string | null;
}

interface PCVersion {
  id: string;
  version_number: number;
  file_url: string;
  file_name: string;
  uploaded_at: string;
  status: PCVersionStatus;
  review_comments: string | null;
  customer_feedback: string | null;
}

const statusLabels: Record<ProductRequestStatus, string> = {
  draft: "Draft",
  specs_submitted: "Specs Submitted",
  artwork_uploaded: "Artwork Uploaded",
  pc_in_review: "PC In Review",
  pc_approved: "PC Approved",
  bionet_pending: "Bionet Pending",
  bionet_registered: "Bionet Registered",
  sap_pending: "SAP Pending",
  sap_registered: "SAP Registered",
  completed: "Completed",
};

const customerStatusLabels: Record<ProductRequestStatus, string> = {
  draft: "Draft",
  specs_submitted: "Specs Submitted",
  artwork_uploaded: "Artwork Uploaded",
  pc_in_review: "PC In Review",
  pc_approved: "PC Approved",
  bionet_pending: "In Progress",
  bionet_registered: "In Progress",
  sap_pending: "In Progress",
  sap_registered: "In Progress",
  completed: "Completed",
};

const pcStatusColors: Record<PCVersionStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  approved: "bg-green-500/10 text-green-600 border-green-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
  superseded: "bg-muted text-muted-foreground border-muted",
};

export default function ProductRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();
  const { user } = useAuth();
  
  const [request, setRequest] = useState<ProductRequest | null>(null);
  const [pcVersions, setPcVersions] = useState<PCVersion[]>([]);
  const [engineeringProposals, setEngineeringProposals] = useState<EngineeringProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // Upload PC dialog
  const [pcDialogOpen, setPcDialogOpen] = useState(false);
  const [pcFile, setPcFile] = useState<File | null>(null);
  
  // Feedback dialog
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<PCVersion | null>(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackAction, setFeedbackAction] = useState<'approve' | 'reject' | null>(null);
  
  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editProductName, setEditProductName] = useState("");
  const [editItemIdCode, setEditItemIdCode] = useState("");
  const [editCustomer, setEditCustomer] = useState("");
  const [editItemType, setEditItemType] = useState("");
  const [editAssignedDesigner, setEditAssignedDesigner] = useState("");
  const [editDpSalesCsr, setEditDpSalesCsr] = useState<string[]>([]);
  const [editItemDescription, setEditItemDescription] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Dropdown data
  const [customerOptions, setCustomerOptions] = useState<{ id: string; label: string }[]>([]);
  const [itemTypeOptions, setItemTypeOptions] = useState<{ id: string; label: string }[]>([]);
  const [destinyUsers, setDestinyUsers] = useState<{ user_id: string; full_name: string }[]>([]);

  useEffect(() => {
    if (id) {
      fetchRequest();
      fetchPCVersions();
      fetchEngineeringProposals();
      fetchDropdownOptions();
      fetchDestinyUsers();
    }
  }, [id]);

  const fetchDropdownOptions = async () => {
    const { data } = await supabase
      .from("dropdown_options")
      .select("id, label, category")
      .in("category", ["final_customer", "item_type"])
      .eq("is_active", true)
      .order("sort_order");
    if (data) {
      setCustomerOptions(data.filter((d) => d.category === "final_customer"));
      setItemTypeOptions(data.filter((d) => d.category === "item_type"));
    }
  };

  const fetchDestinyUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .eq("user_type", "external")
      .like("email", "%destinypkg%")
      .order("full_name");
    if (data) setDestinyUsers(data as any);
  };

  // Internal registration
  const [bionetCode, setBionetCode] = useState("");
  const [sapCode, setSapCode] = useState("");

  const startEditing = () => {
    if (!request) return;
    setEditProductName(request.product_name || "");
    setEditItemIdCode(request.item_id_code || "");
    setEditCustomer(request.customer || "");
    setEditItemType(request.item_type || "");
    setEditAssignedDesigner((request as any).assigned_designer || "");
    // Parse CSR names back to user IDs
    const csrNames = (request as any).dp_sales_csr_names || "";
    if (csrNames) {
      const ids = destinyUsers
        .filter((u) => csrNames.includes(u.full_name))
        .map((u) => u.user_id);
      setEditDpSalesCsr(ids);
    } else {
      setEditDpSalesCsr([]);
    }
    setEditItemDescription(request.item_description || "");
    setEditNotes(request.notes || "");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const saveEdits = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const csrNames = editDpSalesCsr
        .map((uid) => destinyUsers.find((u) => u.user_id === uid)?.full_name)
        .filter(Boolean)
        .join(", ");

      await supabase
        .from("product_requests")
        .update({
          product_name: editProductName.trim(),
          item_id_code: editItemIdCode.trim() || null,
          customer: editCustomer || null,
          item_type: editItemType || null,
          assigned_designer: editAssignedDesigner || null,
          dp_sales_csr_names: csrNames || null,
          item_description: editItemDescription.trim() || null,
          notes: editNotes.trim() || null,
        })
        .eq("id", id);

      toast.success("Product information updated");
      setIsEditing(false);
      fetchRequest();
    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

    try {
      const { data, error } = await supabase
        .from('product_requests')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      // Resolve assigned designer name
      let assignedDesignerName: string | null = null;
      if (data.assigned_designer) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', data.assigned_designer)
          .single();
        assignedDesignerName = profile?.full_name || null;
      }
      
      setRequest({ ...data, assigned_designer_name: assignedDesignerName } as any);
      setBionetCode(data.bionet_code || "");
      setSapCode(data.sap_code || "");
    } catch (error) {
      console.error('Error fetching request:', error);
      toast.error("Failed to load product request");
    } finally {
      setLoading(false);
    }
  };

  const fetchPCVersions = async () => {
    try {
      const { data, error } = await supabase
        .from('pc_versions')
        .select('*')
        .eq('product_request_id', id)
        .order('version_number', { ascending: false });

      if (error) throw error;
      setPcVersions(data || []);
    } catch (error) {
      console.error('Error fetching PC versions:', error);
    }
  };

  const fetchEngineeringProposals = async () => {
    try {
      const { data, error } = await supabase
        .from('engineering_proposals')
        .select('*')
        .eq('product_request_id', id)
        .order('version_number', { ascending: false });

      if (error) throw error;
      setEngineeringProposals(data || []);
    } catch (error) {
      console.error('Error fetching engineering proposals:', error);
    }
  };

  const uploadPCVersion = async () => {
    if (!pcFile || !user || !id) return;

    setUploading(true);
    try {
      const nextVersion = pcVersions.length > 0 ? Math.max(...pcVersions.map(v => v.version_number)) + 1 : 1;
      
      const fileExt = pcFile.name.split('.').pop();
      const fileName = `${id}/pc-v${nextVersion}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('product-request-files')
        .upload(fileName, pcFile);
      
      if (uploadError) throw uploadError;
      
      const fileStoragePath = `product-request-files:${fileName}`;

      // Mark previous versions as superseded
      if (pcVersions.length > 0) {
        await supabase
          .from('pc_versions')
          .update({ status: 'superseded' })
          .eq('product_request_id', id)
          .eq('status', 'pending');
      }

      const { error: insertError } = await supabase
        .from('pc_versions')
        .insert({
          product_request_id: id,
          version_number: nextVersion,
          file_url: fileStoragePath,
          file_name: pcFile.name,
          uploaded_by: user.id,
          status: 'pending',
        });

      if (insertError) throw insertError;

      // Update request status
      await supabase
        .from('product_requests')
        .update({ status: 'pc_in_review' })
        .eq('id', id);

      toast.success(`PC Version ${nextVersion} uploaded successfully`);
      setPcDialogOpen(false);
      setPcFile(null);
      fetchPCVersions();
      fetchRequest();
    } catch (error) {
      console.error('Error uploading PC:', error);
      toast.error("Failed to upload PC version");
    } finally {
      setUploading(false);
    }
  };

  const handleFeedback = async () => {
    if (!selectedVersion || !feedbackAction) return;

    try {
      const newStatus = feedbackAction === 'approve' ? 'approved' : 'rejected';
      
      await supabase
        .from('pc_versions')
        .update({
          status: newStatus,
          customer_feedback: feedback || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq('id', selectedVersion.id);

      if (feedbackAction === 'approve') {
        await supabase
          .from('product_requests')
          .update({ status: isAdmin ? 'bionet_pending' : 'pc_approved' })
          .eq('id', id);
      }

      toast.success(`PC Version ${selectedVersion.version_number} ${newStatus}`);
      setFeedbackDialogOpen(false);
      setSelectedVersion(null);
      setFeedback("");
      setFeedbackAction(null);
      fetchPCVersions();
      fetchRequest();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error("Failed to submit feedback");
    }
  };

  const saveInternalRegistration = async (type: 'bionet' | 'sap') => {
    if (!id) return;

    try {
      const updates: Record<string, unknown> = {};
      
      if (type === 'bionet') {
        updates.bionet_code = bionetCode;
        updates.bionet_registered_at = bionetCode ? new Date().toISOString() : null;
        updates.bionet_registered_by = bionetCode ? user?.id : null;
        if (bionetCode) updates.status = 'sap_pending';
      } else {
        updates.sap_code = sapCode;
        updates.sap_registered_at = sapCode ? new Date().toISOString() : null;
        updates.sap_registered_by = sapCode ? user?.id : null;
        if (sapCode) updates.status = 'completed';
      }

      await supabase
        .from('product_requests')
        .update(updates)
        .eq('id', id);

      toast.success(`${type === 'bionet' ? 'Bionet' : 'SAP'} registration saved`);
      fetchRequest();
    } catch (error) {
      console.error('Error saving registration:', error);
      toast.error("Failed to save registration");
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </MainLayout>
    );
  }

  if (!request) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Request not found</h2>
          <Button variant="link" onClick={() => navigate('/product-requests')}>
            Back to requests
          </Button>
        </div>
      </MainLayout>
    );
  }

  const latestPendingVersion = pcVersions.find(v => v.status === 'pending');

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/product-requests')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{request.product_name}</h1>
              <p className="text-muted-foreground">
                {request.customer || 'No customer'} • Created {format(new Date(request.created_at), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-base px-4 py-1">
            {isAdmin ? statusLabels[request.status] : customerStatusLabels[request.status]}
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product Information */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Product Information</CardTitle>
                {!isEditing ? (
                  <Button variant="outline" size="sm" onClick={startEditing}>
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={cancelEditing} disabled={saving}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={saveEdits} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                      Save
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {!isEditing ? (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label className="text-muted-foreground">Product Name</Label>
                        <p className="font-medium">{request.product_name || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Item / Destiny ID</Label>
                        <p className="font-medium">{request.item_id_code || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Customer (Final Customer)</Label>
                        <p className="font-medium">{request.customer || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Item Type</Label>
                        <p className="font-medium">{request.item_type || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Assigned Designer</Label>
                        <p className="font-medium">{(request as any).assigned_designer_name || '-'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">DP Sales / CSR</Label>
                        <p className="font-medium">{(request as any).dp_sales_csr_names || '-'}</p>
                      </div>
                    </div>
                    {request.item_description && (
                      <div>
                        <Label className="text-muted-foreground">Item Description</Label>
                        <p className="font-medium">{request.item_description}</p>
                      </div>
                    )}
                    {request.notes && (
                      <div>
                        <Label className="text-muted-foreground">Design Notes</Label>
                        <p className="font-medium whitespace-pre-wrap">{request.notes}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="edit_product_name">Product Name *</Label>
                        <Input
                          id="edit_product_name"
                          value={editProductName}
                          onChange={(e) => setEditProductName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_item_id">Item / Destiny ID</Label>
                        <Input
                          id="edit_item_id"
                          value={editItemIdCode}
                          onChange={(e) => setEditItemIdCode(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Customer (Final Customer)</Label>
                        <Select value={editCustomer} onValueChange={setEditCustomer}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                          <SelectContent>
                            {customerOptions.map((opt) => (
                              <SelectItem key={opt.id} value={opt.label}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Item Type</Label>
                        <Select value={editItemType} onValueChange={setEditItemType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select item type" />
                          </SelectTrigger>
                          <SelectContent>
                            {itemTypeOptions.map((opt) => (
                              <SelectItem key={opt.id} value={opt.label}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Assigned Designer</Label>
                        <Select value={editAssignedDesigner} onValueChange={setEditAssignedDesigner}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select designer" />
                          </SelectTrigger>
                          <SelectContent>
                            {destinyUsers.map((u) => (
                              <SelectItem key={u.user_id} value={u.user_id}>
                                {u.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>DP Sales / CSR</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between font-normal"
                          >
                            {editDpSalesCsr.length > 0
                              ? destinyUsers
                                  .filter((u) => editDpSalesCsr.includes(u.user_id))
                                  .map((u) => u.full_name)
                                  .join(", ")
                              : "Select DP Sales/CSR"}
                            <span className="ml-2 opacity-50">▼</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-2" align="start">
                          <div className="space-y-1 max-h-60 overflow-y-auto">
                            {destinyUsers.map((u) => (
                              <label
                                key={u.user_id}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm"
                              >
                                <Checkbox
                                  checked={editDpSalesCsr.includes(u.user_id)}
                                  onCheckedChange={(checked) => {
                                    setEditDpSalesCsr((prev) =>
                                      checked
                                        ? [...prev, u.user_id]
                                        : prev.filter((uid) => uid !== u.user_id)
                                    );
                                  }}
                                />
                                {u.full_name}
                              </label>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_item_description">Item Description</Label>
                      <Textarea
                        id="edit_item_description"
                        value={editItemDescription}
                        onChange={(e) => setEditItemDescription(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_notes">Design Notes</Label>
                      <Textarea
                        id="edit_notes"
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Tech Spec PDF */}
            {request.tech_spec_pdf_url && (
              <Card>
                <CardHeader>
                  <CardTitle>Technical Specification</CardTitle>
                </CardHeader>
                <CardContent>
                  <button
                    onClick={() => openStorageFile(request.tech_spec_pdf_url, 'product-request-files')}
                    className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted transition-colors w-full text-left cursor-pointer bg-transparent"
                  >
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="flex-1 truncate">{request.tech_spec_filename || 'Tech Spec PDF'}</span>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </button>
                </CardContent>
              </Card>
            )}

            {/* Artwork Files */}
            {request.artwork_files && request.artwork_files.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Artwork Files</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2">
                    {request.artwork_files.map((url, index) => (
                      <button
                        key={index}
                        onClick={() => openStorageFile(url, 'product-request-files')}
                        className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted transition-colors w-full text-left cursor-pointer bg-transparent"
                      >
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <span className="flex-1 truncate">Artwork {index + 1}</span>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Engineering Review */}
            {(request.status === 'artwork_uploaded' || 
              request.status === 'pc_in_review' || 
              request.status === 'pc_approved' ||
              request.engineering_status !== 'pending') && (
              <EngineeringReviewCard
                request={{
                  id: request.id,
                  product_name: request.product_name,
                  width_inches: request.width_inches,
                  length_inches: request.length_inches,
                  gusset_inches: request.gusset_inches,
                  zipper_inches: request.zipper_inches,
                  width_cm: request.width_cm,
                  length_cm: request.length_cm,
                  gusset_cm: request.gusset_cm,
                  zipper_cm: request.zipper_cm,
                  thickness_value: request.thickness_value,
                  thickness_unit: request.thickness_unit || 'gauge',
                  estructura: request.estructura,
                  engineering_status: request.engineering_status || 'pending',
                  engineering_notes: request.engineering_notes,
                }}
                proposals={engineeringProposals}
                onUpdate={() => {
                  fetchRequest();
                  fetchEngineeringProposals();
                }}
              />
            )}

            {/* PC Versions - Only show if engineering approved */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Print Card Versions</CardTitle>
                  <CardDescription>
                    Review and approve PC versions
                  </CardDescription>
                </div>
                {isAdmin && (
                  <Dialog open={pcDialogOpen} onOpenChange={setPcDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Upload className="mr-2 h-4 w-4" />
                        Upload PC
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Upload New PC Version</DialogTitle>
                        <DialogDescription>
                          Upload a new Print Card version for customer review
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="border-2 border-dashed border-muted rounded-lg p-6">
                          <div className="flex flex-col items-center justify-center text-center">
                            <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                            <label htmlFor="pc-upload" className="cursor-pointer">
                              <Button variant="outline" size="sm" asChild>
                                <span>{pcFile ? pcFile.name : "Choose File"}</span>
                              </Button>
                              <input
                                id="pc-upload"
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg"
                                className="hidden"
                                onChange={(e) => setPcFile(e.target.files?.[0] || null)}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setPcDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={uploadPCVersion} disabled={!pcFile || uploading}>
                          {uploading ? "Uploading..." : "Upload"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent>
                {pcVersions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No PC versions yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pcVersions.map((version) => (
                      <div
                        key={version.id}
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-lg border",
                          version.status === 'pending' && "bg-accent/5"
                        )}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Version {version.version_number}</span>
                            <Badge variant="outline" className={pcStatusColors[version.status]}>
                              {version.status.charAt(0).toUpperCase() + version.status.slice(1)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(version.uploaded_at), 'MMM d, yyyy h:mm a')}
                          </p>
                          {version.customer_feedback && (
                            <p className="text-sm mt-2 flex items-start gap-1">
                              <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground" />
                              {version.customer_feedback}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => openStorageFile(version.file_url, 'product-request-files')}>
                              <ExternalLink className="h-4 w-4 mr-1" />
                              View
                          </Button>
                          {version.status === 'pending' && !isAdmin && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 border-green-600 hover:bg-green-50"
                                onClick={() => {
                                  setSelectedVersion(version);
                                  setFeedbackAction('approve');
                                  setFeedbackDialogOpen(true);
                                }}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-600 hover:bg-red-50"
                                onClick={() => {
                                  setSelectedVersion(version);
                                  setFeedbackAction('reject');
                                  setFeedbackDialogOpen(true);
                                }}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Request Changes
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { status: 'specs_submitted', label: 'Specifications' },
                    { status: 'artwork_uploaded', label: 'Artwork' },
                    { status: 'engineering_approved', label: 'Engineering Review', isEngineering: true },
                    { status: 'pc_in_review', label: 'PC Review' },
                    { status: 'pc_approved', label: 'PC Approved' },
                    ...(isAdmin ? [
                      { status: 'bionet_registered', label: 'Bionet' },
                      { status: 'sap_registered', label: 'SAP' },
                    ] : []),
                    { status: 'completed', label: 'Completed' },
                  ].map((step, index, arr) => {
                    const statusOrder: ProductRequestStatus[] = [
                      'draft', 'specs_submitted', 'artwork_uploaded', 'pc_in_review', 
                      'pc_approved', 'bionet_pending', 'bionet_registered', 
                      'sap_pending', 'sap_registered', 'completed'
                    ];
                    
                    // Handle engineering step separately
                    if ((step as { isEngineering?: boolean }).isEngineering) {
                      const engStatus = request.engineering_status;
                      const isComplete = engStatus === 'approved';
                      const isCurrent = engStatus === 'pending' || engStatus === 'changes_required' || engStatus === 'customer_review';
                      
                      return (
                        <div key={step.status} className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-sm",
                            isComplete ? "bg-primary text-primary-foreground" :
                            isCurrent ? "border-2 border-primary text-primary" :
                            "border-2 border-muted text-muted-foreground"
                          )}>
                            {isComplete ? <Check className="h-4 w-4" /> : index + 1}
                          </div>
                          <span className={cn(
                            "flex-1",
                            isComplete ? "font-medium" : isCurrent ? "font-medium text-primary" : "text-muted-foreground"
                          )}>
                            {step.label}
                            {isCurrent && engStatus === 'customer_review' && (
                              <Badge variant="outline" className="ml-2 text-xs bg-blue-500/10 text-blue-600">
                                Awaiting Response
                              </Badge>
                            )}
                          </span>
                          {index < arr.length - 1 && (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      );
                    }
                    
                    const currentIndex = statusOrder.indexOf(request.status);
                    const stepIndex = statusOrder.indexOf(step.status as ProductRequestStatus);
                    const isComplete = currentIndex >= stepIndex;
                    const isCurrent = currentIndex === stepIndex || 
                      (step.status === 'bionet_registered' && request.status === 'bionet_pending') ||
                      (step.status === 'sap_registered' && request.status === 'sap_pending');

                    return (
                      <div key={step.status} className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-sm",
                          isComplete ? "bg-primary text-primary-foreground" :
                          isCurrent ? "border-2 border-primary text-primary" :
                          "border-2 border-muted text-muted-foreground"
                        )}>
                          {isComplete ? <Check className="h-4 w-4" /> : index + 1}
                        </div>
                        <span className={cn(
                          "flex-1",
                          isComplete ? "font-medium" : "text-muted-foreground"
                        )}>
                          {step.label}
                        </span>
                        {index < arr.length - 1 && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Internal Registration - Admin Only */}
            {isAdmin && (request.status === 'pc_approved' || 
              request.status === 'bionet_pending' || 
              request.status === 'bionet_registered' || 
              request.status === 'sap_pending' || 
              request.status === 'sap_registered' ||
              request.status === 'completed') && (
              <Card className="border-accent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-accent">
                    <Clock className="h-5 w-5" />
                    Internal Registration
                  </CardTitle>
                  <CardDescription>
                    Not visible to customers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bionet">Bionet Code</Label>
                    <div className="flex gap-2">
                      <Input
                        id="bionet"
                        value={bionetCode}
                        onChange={(e) => setBionetCode(e.target.value)}
                        placeholder="Enter Bionet code"
                      />
                      <Button 
                        size="sm" 
                        onClick={() => saveInternalRegistration('bionet')}
                        disabled={!!request.bionet_code && bionetCode === request.bionet_code}
                      >
                        Save
                      </Button>
                    </div>
                    {request.bionet_registered_at && (
                      <p className="text-xs text-muted-foreground">
                        Registered {format(new Date(request.bionet_registered_at), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="sap">SAP Code</Label>
                    <div className="flex gap-2">
                      <Input
                        id="sap"
                        value={sapCode}
                        onChange={(e) => setSapCode(e.target.value)}
                        placeholder="Enter SAP code"
                        disabled={!request.bionet_code}
                      />
                      <Button 
                        size="sm" 
                        onClick={() => saveInternalRegistration('sap')}
                        disabled={!request.bionet_code || (!!request.sap_code && sapCode === request.sap_code)}
                      >
                        Save
                      </Button>
                    </div>
                    {request.sap_registered_at && (
                      <p className="text-xs text-muted-foreground">
                        Registered {format(new Date(request.sap_registered_at), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Feedback Dialog */}
        <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {feedbackAction === 'approve' ? 'Approve PC' : 'Request Changes'}
              </DialogTitle>
              <DialogDescription>
                {feedbackAction === 'approve' 
                  ? 'Confirm approval of this Print Card version'
                  : 'Provide feedback for the design team'}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="feedback">
                {feedbackAction === 'approve' ? 'Comments (optional)' : 'Required Changes'}
              </Label>
              <Textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={feedbackAction === 'approve' 
                  ? 'Any additional comments...'
                  : 'Describe the changes needed...'}
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFeedbackDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleFeedback}
                variant={feedbackAction === 'approve' ? 'default' : 'destructive'}
              >
                {feedbackAction === 'approve' ? 'Approve' : 'Submit Feedback'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
