import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import { MessageSquare, Send, Trash2, Loader2, Lock, AtSign } from "lucide-react";
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

interface Profile {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

interface MentionableUser {
  id: string;
  name: string;
}

interface POCommentsProps {
  purchaseOrderId: string;
  isInternal: boolean;
  title: string;
}

export function POComments({ purchaseOrderId, isInternal, title }: POCommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mentionableUsers, setMentionableUsers] = useState<MentionableUser[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchComments();
    fetchMentionableUsers();
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
      // Fetch profiles for comment authors
      const userIds = [...new Set((data || []).map((c) => c.user_id))];
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);
        if (profileData) {
          const map: Record<string, Profile> = {};
          profileData.forEach((p) => (map[p.user_id] = p));
          setProfiles(map);
        }
      }
    }
    setLoading(false);
  };

  const fetchMentionableUsers = async () => {
    const users: MentionableUser[] = [];
    const seenIds = new Set<string>();

    if (isInternal) {
      // Internal chat: only BFX (internal) users — all team members
      const { data: teamData } = await supabase
        .from("team_members")
        .select("user_id, full_name")
        .eq("is_active", true);

      if (teamData) {
        teamData.forEach((t) => {
          if (!seenIds.has(t.user_id)) {
            seenIds.add(t.user_id);
            users.push({ id: t.user_id, name: t.full_name });
          }
        });
      }
    } else {
      // External chat: Destiny (external) users + BFX sales & admin only

      // 1. Fetch all Destiny/external users
      const { data: externalProfiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("user_type", "external");

      if (externalProfiles) {
        externalProfiles.forEach((p) => {
          if (!seenIds.has(p.user_id)) {
            seenIds.add(p.user_id);
            users.push({ id: p.user_id, name: p.full_name || p.email || "User" });
          }
        });
      }

      // 2. Fetch BFX sales reps (team_members with sales_rep or customer_service role)
      const { data: salesTeam } = await supabase
        .from("team_members")
        .select("user_id, full_name")
        .eq("is_active", true)
        .in("team_role", ["sales_rep", "customer_service"]);

      if (salesTeam) {
        salesTeam.forEach((t) => {
          if (!seenIds.has(t.user_id)) {
            seenIds.add(t.user_id);
            users.push({ id: t.user_id, name: t.full_name });
          }
        });
      }

      // 3. Fetch BFX admin users
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (adminRoles) {
        for (const ar of adminRoles) {
          if (!seenIds.has(ar.user_id)) {
            const { data: adminProfile } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("user_id", ar.user_id)
              .maybeSingle();
            if (adminProfile) {
              seenIds.add(ar.user_id);
              users.push({
                id: ar.user_id,
                name: adminProfile.full_name || adminProfile.email || "Admin",
              });
            }
          }
        }
      }
    }

    setMentionableUsers(users);
  };

  const getAuthorName = (userId: string) => {
    const profile = profiles[userId];
    if (profile?.full_name) return profile.full_name;
    if (profile?.email) return profile.email.split("@")[0];
    return "Unknown";
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewComment(value);

    // Check for @ trigger
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);

    if (atMatch) {
      setMentionFilter(atMatch[1].toLowerCase());
      setShowMentions(true);
      setMentionIndex(0);
    } else {
      setShowMentions(false);
    }
  };

  const filteredMentions = mentionableUsers.filter((u) =>
    u.name.toLowerCase().includes(mentionFilter)
  );

  const insertMention = useCallback(
    (userName: string) => {
      if (!textareaRef.current) return;
      const textarea = textareaRef.current;
      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = newComment.substring(0, cursorPos);
      const textAfterCursor = newComment.substring(cursorPos);
      const atIndex = textBeforeCursor.lastIndexOf("@");

      const newText =
        textBeforeCursor.substring(0, atIndex) +
        `@${userName} ` +
        textAfterCursor;

      setNewComment(newText);
      setShowMentions(false);

      setTimeout(() => {
        const newPos = atIndex + userName.length + 2;
        textarea.focus();
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    },
    [newComment]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showMentions || filteredMentions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionIndex((i) => Math.min(i + 1, filteredMentions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(filteredMentions[mentionIndex].name);
    } else if (e.key === "Escape") {
      setShowMentions(false);
    }
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

  // Render comment text with highlighted @mentions
  const renderComment = (text: string) => {
    const parts = text.split(/(@\w[\w\s]*?)(?=\s@|\s[^@]|$)/g);
    return text.split(/(@[\w\s]+?)(?=\s@|$|\s[^@])/).map((part, i) => {
      if (part.startsWith("@")) {
        const mentionName = part.substring(1).trim();
        const isMention = mentionableUsers.some(
          (u) => u.name.toLowerCase() === mentionName.toLowerCase()
        );
        if (isMention) {
          return (
            <span
              key={i}
              className="bg-primary/10 text-primary font-medium rounded px-0.5"
            >
              {part.trim()}
            </span>
          );
        }
      }
      return <span key={i}>{part}</span>;
    });
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
                      <p className="text-xs font-semibold text-foreground mb-1">
                        {getAuthorName(comment.user_id)}
                      </p>
                      <p className="text-sm">{renderComment(comment.comment)}</p>
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

        <div className="space-y-2 relative">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              placeholder={
                isInternal
                  ? "Add internal note... (use @ to mention)"
                  : "Add a comment... (use @ to mention)"
              }
              value={newComment}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              rows={2}
              className={
                isInternal
                  ? "border-warning/30 focus-visible:ring-warning/30"
                  : ""
              }
            />
            {showMentions && filteredMentions.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-md shadow-md z-50 max-h-[150px] overflow-y-auto">
                {filteredMentions.map((u, i) => (
                  <button
                    key={u.id}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent ${
                      i === mentionIndex ? "bg-accent" : ""
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(u.name);
                    }}
                  >
                    <AtSign className="h-3 w-3 text-muted-foreground" />
                    {u.name}
                  </button>
                ))}
              </div>
            )}
          </div>
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
