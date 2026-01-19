import { useState, useEffect } from "react";
import { format } from "date-fns";
import { MessageSquare, Send, Trash2, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Comment {
  id: string;
  comment: string;
  user_id: string;
  created_at: string;
  is_internal: boolean;
}

interface POCommentsProps {
  purchaseOrderId: string;
  isInternal: boolean;
  title: string;
}

export function POComments({ purchaseOrderId, isInternal, title }: POCommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComments();
  }, [purchaseOrderId, isInternal]);

  const fetchComments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("po_comments")
      .select("*")
      .eq("purchase_order_id", purchaseOrderId)
      .eq("is_internal", isInternal)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching comments:", error);
    } else {
      setComments(data || []);
    }
    setLoading(false);
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user) return;

    setSubmittingComment(true);
    const { error } = await supabase.from("po_comments").insert({
      purchase_order_id: purchaseOrderId,
      user_id: user.id,
      comment: newComment.trim(),
      is_internal: isInternal,
    });

    if (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    } else {
      toast.success("Comment added");
      setNewComment("");
      fetchComments();
    }
    setSubmittingComment(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    const { error } = await supabase
      .from("po_comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
    } else {
      toast.success("Comment deleted");
      fetchComments();
    }
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), "MMM d, yyyy 'at' h:mm a");
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {isInternal ? (
            <Lock className="h-4 w-4 text-warning" />
          ) : (
            <MessageSquare className="h-4 w-4" />
          )}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col pt-0">
        <ScrollArea className="flex-1 max-h-[250px] pr-4 mb-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No comments yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`rounded-lg p-3 border ${
                    isInternal 
                      ? "bg-warning/5 border-warning/20" 
                      : "bg-muted/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm">{comment.comment}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDateTime(comment.created_at)}
                      </p>
                    </div>
                    {comment.user_id === user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteComment(comment.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="space-y-2">
          <Textarea
            placeholder={isInternal ? "Add internal note..." : "Add a comment..."}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={2}
            className={isInternal ? "border-warning/30 focus-visible:ring-warning/30" : ""}
          />
          <Button
            className="w-full"
            size="sm"
            variant={isInternal ? "outline" : "default"}
            onClick={handleSubmitComment}
            disabled={!newComment.trim() || submittingComment}
          >
            {submittingComment ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {isInternal ? "Add Internal Note" : "Add Comment"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
