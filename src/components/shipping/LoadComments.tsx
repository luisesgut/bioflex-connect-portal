import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquare, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface LoadComment {
  id: string;
  load_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
}

interface LoadCommentsProps {
  loadId: string;
  userId: string | undefined;
  isAdmin: boolean;
}

export function LoadComments({ loadId, userId, isAdmin }: LoadCommentsProps) {
  const [comments, setComments] = useState<LoadComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("load_comments")
        .select("*")
        .eq("load_id", loadId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setLoading(false);
    }
  }, [loadId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async () => {
    if (!newComment.trim() || !userId) {
      toast.error("Please enter a comment");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("load_comments").insert({
        load_id: loadId,
        user_id: userId,
        comment: newComment.trim(),
      });

      if (error) throw error;

      toast.success("Comment added");
      setNewComment("");
      fetchComments();
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from("load_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;

      toast.success("Comment deleted");
      fetchComments();
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Comments</CardTitle>
        </div>
        <CardDescription>
          Leave notes or comments about this load
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Comments List */}
            {comments.length > 0 ? (
              <ScrollArea className="h-[200px] pr-4">
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="flex gap-3 p-3 rounded-lg bg-muted/50"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {isAdmin && comment.user_id === userId ? "AD" : "CU"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(comment.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                          {(comment.user_id === userId || isAdmin) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDelete(comment.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <p className="text-sm mt-1 whitespace-pre-wrap break-words">
                          {comment.comment}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No comments yet
              </div>
            )}

            {/* Add Comment Form */}
            <div className="flex gap-2">
              <Textarea
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[80px] resize-none"
              />
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!newComment.trim() || submitting}
              className="w-full"
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Add Comment
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
