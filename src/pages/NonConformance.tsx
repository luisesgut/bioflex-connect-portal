import { useState, useRef, useEffect } from "react";
import { openStorageFile } from "@/hooks/useOpenStorageFile";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  Search, 
  AlertTriangle, 
  FileWarning,
  Calendar,
  Package,
  Clock,
  Upload,
  X,
  FileImage,
  FileText,
  Loader2,
  Trash2,
  Pencil
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface NCRSubmission {
  id: string;
  po_number: string;
  issue_type: string;
  priority: "low" | "medium" | "high" | "critical";
  description: string;
  status: "open" | "under_review" | "resolved" | "closed";
  attachments: string[];
  created_at: string;
  updated_at: string;
}

const issueTypes = [
  "Print Quality",
  "Seal Integrity",
  "Dimension",
  "Material Defect",
  "Contamination",
  "Labeling Error",
  "Wrong Product",
  "Quantity Shortage",
  "Other",
];

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "resolved":
    case "closed":
      return "bg-green-500/10 text-green-600 border-green-500/20";
    case "under_review":
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case "open":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "critical":
      return "bg-red-500/10 text-red-600 border-red-500/20";
    case "high":
      return "bg-orange-500/10 text-orange-600 border-orange-500/20";
    case "medium":
      return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
    case "low":
      return "bg-slate-500/10 text-slate-600 border-slate-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const formatStatus = (status: string) => {
  return status.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

const getFileIcon = (type: string) => {
  if (type.startsWith("image/")) return FileImage;
  return FileText;
};

interface UploadedFile {
  file: File;
  preview?: string;
}

export default function NonConformance() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNCR, setEditingNCR] = useState<NCRSubmission | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ncrToDelete, setNcrToDelete] = useState<NCRSubmission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ncrs, setNcrs] = useState<NCRSubmission[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    poNumber: "",
    issueType: "",
    priority: "medium" as "low" | "medium" | "high" | "critical",
    description: "",
  });

  // Fetch NCRs on mount
  useEffect(() => {
    fetchNCRs();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("ncr-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ncr_submissions",
        },
        () => {
          fetchNCRs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNCRs = async () => {
    try {
      const { data, error } = await supabase
        .from("ncr_submissions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNcrs(data || []);
    } catch (error) {
      console.error("Error fetching NCRs:", error);
      toast.error("Failed to load NCRs");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredNCRs = ncrs.filter(
    (ncr) =>
      ncr.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ncr.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ncr.issue_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    open: ncrs.filter((n) => n.status === "open").length,
    underReview: ncrs.filter((n) => n.status === "under_review").length,
    resolved: ncrs.filter((n) => n.status === "resolved" || n.status === "closed").length,
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: UploadedFile[] = [];
    
    Array.from(files).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File ${file.name} is too large. Maximum size is 10MB.`);
        return;
      }

      const uploadedFile: UploadedFile = { file };
      
      if (file.type.startsWith("image/")) {
        uploadedFile.preview = URL.createObjectURL(file);
      }
      
      newFiles.push(uploadedFile);
    });

    setUploadedFiles((prev) => [...prev, ...newFiles]);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const uploadFiles = async (poNumber: string): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (const { file } of uploadedFiles) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${user?.id}/${poNumber}/${fileName}`;

      const { error } = await supabase.storage
        .from("ncr-attachments")
        .upload(filePath, file);

      if (error) {
        console.error("Upload error:", error);
        throw new Error(`Failed to upload ${file.name}`);
      }

      uploadedUrls.push(`ncr-attachments:${filePath}`);
    }

    return uploadedUrls;
  };

  const resetForm = () => {
    setFormData({
      poNumber: "",
      issueType: "",
      priority: "medium",
      description: "",
    });
    uploadedFiles.forEach((f) => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setUploadedFiles([]);
    setEditingNCR(null);
  };

  const handleOpenDialog = (ncr?: NCRSubmission) => {
    if (ncr) {
      setEditingNCR(ncr);
      setFormData({
        poNumber: ncr.po_number,
        issueType: ncr.issue_type,
        priority: ncr.priority,
        description: ncr.description,
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.poNumber || !formData.issueType || !formData.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!user) {
      toast.error("You must be logged in to submit an NCR");
      return;
    }

    setIsSubmitting(true);

    try {
      let attachmentUrls: string[] = editingNCR?.attachments || [];
      
      if (uploadedFiles.length > 0) {
        const newUrls = await uploadFiles(formData.poNumber);
        attachmentUrls = [...attachmentUrls, ...newUrls];
      }

      if (editingNCR) {
        // Update existing NCR
        const { error } = await supabase
          .from("ncr_submissions")
          .update({
            po_number: formData.poNumber,
            issue_type: formData.issueType,
            priority: formData.priority,
            description: formData.description,
            attachments: attachmentUrls,
          })
          .eq("id", editingNCR.id);

        if (error) throw error;

        toast.success("NCR updated successfully");
      } else {
        // Create new NCR
        const { error } = await supabase
          .from("ncr_submissions")
          .insert({
            user_id: user.id,
            po_number: formData.poNumber,
            issue_type: formData.issueType,
            priority: formData.priority,
            description: formData.description,
            attachments: attachmentUrls,
          });

        if (error) throw error;

        toast.success("NCR submitted successfully", {
          description: `NCR for ${formData.poNumber} has been submitted.`,
        });
      }

      handleCloseDialog();
    } catch (error) {
      console.error("Submit error:", error);
      toast.error(editingNCR ? "Failed to update NCR" : "Failed to submit NCR");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!ncrToDelete) return;

    try {
      const { error } = await supabase
        .from("ncr_submissions")
        .delete()
        .eq("id", ncrToDelete.id);

      if (error) throw error;

      toast.success("NCR deleted successfully");
      setDeleteDialogOpen(false);
      setNcrToDelete(null);
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete NCR");
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('page.nonConformance.title')}</h1>
            <p className="text-muted-foreground">
              {t('page.nonConformance.subtitle')}
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => open ? handleOpenDialog() : handleCloseDialog()}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Submit NCR
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileWarning className="h-5 w-5 text-amber-500" />
                  {editingNCR ? "Edit NCR" : "Submit Non-Conformance Report"}
                </DialogTitle>
                <DialogDescription>
                  {editingNCR 
                    ? "Update the details of this NCR." 
                    : "Report a quality issue with a previous purchase order. Our team will review and respond within 48 hours."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="poNumber">Purchase Order Number *</Label>
                  <Input
                    id="poNumber"
                    placeholder="e.g., PO-2024-1847"
                    value={formData.poNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, poNumber: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="issueType">Issue Type *</Label>
                    <Select
                      value={formData.issueType}
                      onValueChange={(value) =>
                        setFormData({ ...formData, issueType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {issueTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value: "low" | "medium" | "high" | "critical") =>
                        setFormData({ ...formData, priority: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        {priorityOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the issue in detail..."
                    className="min-h-[100px]"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>

                {/* File Upload Section */}
                <div className="space-y-2">
                  <Label>Attachments</Label>
                  <div
                    className="relative cursor-pointer rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 transition-colors hover:border-muted-foreground/50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <div className="flex flex-col items-center gap-2 text-center">
                      <Upload className="h-8 w-8 text-muted-foreground/50" />
                      <div>
                        <p className="text-sm font-medium">Click to upload files</p>
                        <p className="text-xs text-muted-foreground">
                          Images, PDF, or documents up to 10MB
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Existing Attachments */}
                  {editingNCR && editingNCR.attachments.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <p className="text-xs text-muted-foreground">Existing attachments:</p>
                      {editingNCR.attachments.map((url, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2"
                        >
                          <FileImage className="h-5 w-5 text-muted-foreground" />
                          <button 
                            onClick={() => openStorageFile(url, 'ncr-attachments')}
                            className="flex-1 truncate text-sm text-primary hover:underline text-left cursor-pointer bg-transparent border-none p-0"
                          >
                            Attachment {index + 1}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* New Uploaded Files Preview */}
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <p className="text-xs text-muted-foreground">New files to upload:</p>
                      {uploadedFiles.map((uploadedFile, index) => {
                        const FileIcon = getFileIcon(uploadedFile.file.type);
                        return (
                          <div
                            key={index}
                            className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2"
                          >
                            {uploadedFile.preview ? (
                              <img
                                src={uploadedFile.preview}
                                alt="Preview"
                                className="h-10 w-10 rounded object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                                <FileIcon className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 overflow-hidden">
                              <p className="truncate text-sm font-medium">
                                {uploadedFile.file.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {(uploadedFile.file.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFile(index);
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseDialog}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {editingNCR ? "Updating..." : "Submitting..."}
                      </>
                    ) : (
                      editingNCR ? "Update Report" : "Submit Report"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Open</p>
                  <p className="text-2xl font-bold">{stats.open}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Under Review</p>
                  <p className="text-2xl font-bold">{stats.underReview}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-amber-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Resolved</p>
                  <p className="text-2xl font-bold">{stats.resolved}</p>
                </div>
                <FileWarning className="h-8 w-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search NCRs by ID, PO, or issue type..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* NCR List */}
        <div className="space-y-4">
          {isLoading ? (
            <Card className="py-12">
              <CardContent className="flex flex-col items-center justify-center text-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">Loading NCRs...</p>
              </CardContent>
            </Card>
          ) : filteredNCRs.length > 0 ? (
            filteredNCRs.map((ncr) => (
              <Card key={ncr.id} className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-lg">{ncr.po_number}</CardTitle>
                        <Badge className={getStatusColor(ncr.status)} variant="outline">
                          {formatStatus(ncr.status)}
                        </Badge>
                        <Badge className={getPriorityColor(ncr.priority)} variant="outline">
                          {ncr.priority.charAt(0).toUpperCase() + ncr.priority.slice(1)}
                        </Badge>
                      </div>
                      <CardDescription className="flex items-center gap-2">
                        <Package className="h-3.5 w-3.5" />
                        {ncr.issue_type}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleOpenDialog(ncr)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          setNcrToDelete(ncr);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{ncr.description}</p>
                  <div className="mt-4 flex items-center gap-6 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Submitted: {new Date(ncr.created_at).toLocaleDateString()}
                    </span>
                    {ncr.attachments.length > 0 && (
                      <span className="flex items-center gap-1.5">
                        <FileImage className="h-3.5 w-3.5" />
                        {ncr.attachments.length} attachment(s)
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="py-12">
              <CardContent className="flex flex-col items-center justify-center text-center">
                <FileWarning className="h-12 w-12 text-muted-foreground/30" />
                <h3 className="mt-4 text-lg font-semibold">No NCRs Found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchTerm 
                    ? "No non-conformance reports match your search criteria."
                    : "Submit your first NCR to track quality issues."}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete NCR</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this NCR for {ncrToDelete?.po_number}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
