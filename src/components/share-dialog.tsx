import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Trash2, UserPlus, RefreshCw, Users, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type ResourceType = "item" | "reminder";
type Role = "viewer" | "editor";

function genToken() {
  const arr = new Uint8Array(18);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 24);
}

export function ShareDialog({
  open,
  onOpenChange,
  resourceType,
  resourceId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  resourceType: ResourceType;
  resourceId: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [emailRole, setEmailRole] = useState<Role>("viewer");
  const [linkRole, setLinkRole] = useState<Role>("viewer");

  const { data: members = [] } = useQuery({
    queryKey: ["shares", resourceType, resourceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shares")
        .select("*")
        .eq("resource_type", resourceType)
        .eq("resource_id", resourceId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!user,
  });

  const { data: invites = [] } = useQuery({
    queryKey: ["share_invites", resourceType, resourceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("share_invites")
        .select("*")
        .eq("resource_type", resourceType)
        .eq("resource_id", resourceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!user,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["shares", resourceType, resourceId] });
    qc.invalidateQueries({ queryKey: ["share_invites", resourceType, resourceId] });
  };

  async function createInvite(role: Role, withEmail: string | null) {
    if (!user) return null;
    const token = genToken();
    const { data, error } = await supabase
      .from("share_invites")
      .insert({
        owner_id: user.id,
        resource_type: resourceType,
        resource_id: resourceId,
        role,
        email: withEmail,
        token,
      })
      .select("*")
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    invalidate();
    return data;
  }

  async function handleInviteEmail() {
    const e = email.trim().toLowerCase();
    if (!e || !e.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    const invite = await createInvite(emailRole, e);
    if (invite) {
      const url = inviteUrl(invite.token);
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success(`Invite link copied. Send it to ${e}.`);
      setEmail("");
    }
  }

  async function handleCreateLink() {
    const invite = await createInvite(linkRole, null);
    if (invite) {
      const url = inviteUrl(invite.token);
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Invite link generated and copied");
    }
  }

  async function revokeInvite(id: string) {
    const { error } = await supabase.from("share_invites").update({ revoked: true }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Invite revoked");
    invalidate();
  }

  async function removeMember(id: string) {
    if (!confirm("Remove this member?")) return;
    const { error } = await supabase.from("shares").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Member removed");
    invalidate();
  }

  async function updateRole(id: string, role: Role) {
    const { error } = await supabase.from("shares").update({ role }).eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  }

  async function disableSharing() {
    if (!confirm("Disable sharing? This removes all members and revokes invite links.")) return;
    const table = resourceType === "item" ? "items" : "reminders";
    await supabase.from("shares").delete().eq("resource_type", resourceType).eq("resource_id", resourceId);
    await supabase
      .from("share_invites")
      .update({ revoked: true })
      .eq("resource_type", resourceType)
      .eq("resource_id", resourceId);
    await supabase.from(table).update({ visibility: "personal" }).eq("id", resourceId);
    toast.success("Sharing disabled");
    qc.invalidateQueries();
    onOpenChange(false);
  }

  const activeInvites = useMemo(() => invites.filter((i) => !i.revoked), [invites]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Manage sharing
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="members">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="email">By email</TabsTrigger>
            <TabsTrigger value="link">By link</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="mt-4 space-y-3">
            {members.length === 0 ? (
              <p className="rounded-md border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                No members yet. Invite people from the other tabs.
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {m.member_user_id.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">Member · {m.member_user_id.slice(0, 8)}…</p>
                      <p className="text-xs text-muted-foreground">
                        Added {new Date(m.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Select value={m.role} onValueChange={(v) => updateRole(m.id, v as Role)}>
                      <SelectTrigger className="h-8 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" onClick={() => removeMember(m.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="email" className="mt-4 space-y-3">
            <Label className="text-xs">Invite by email</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
              <Select value={emailRole} onValueChange={(v) => setEmailRole(v as Role)}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleInviteEmail}>
                <Mail className="mr-1 h-3.5 w-3.5" /> Invite
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Generates a personal invite link copied to your clipboard. Send it to the recipient.
            </p>
          </TabsContent>

          <TabsContent value="link" className="mt-4 space-y-3">
            <Label className="text-xs">Invite link</Label>
            <div className="flex items-center gap-2">
              <Select value={linkRole} onValueChange={(v) => setLinkRole(v as Role)}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleCreateLink}>
                <Link2 className="mr-1 h-3.5 w-3.5" /> Generate link
              </Button>
            </div>

            {activeInvites.length > 0 && (
              <ul className="divide-y rounded-md border">
                {activeInvites.map((inv) => {
                  const url = inviteUrl(inv.token);
                  return (
                    <li key={inv.id} className="flex items-center gap-2 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-mono">{url}</p>
                        <p className="text-xs text-muted-foreground">
                          {inv.email ? `For ${inv.email} · ` : ""}{inv.role}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(url).catch(() => {});
                          toast.success("Copied");
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => revokeInvite(inv.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={disableSharing}>
            Disable sharing
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function inviteUrl(token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/invite/${token}`;
}
