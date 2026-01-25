import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Mail, User, Users } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

export interface Contact {
  id: string;
  name: string;
  email: string;
  role_description?: string;
}

interface ContactsManagerProps {
  clientApprovers: Contact[];
  internalContacts: Contact[];
  onClientApproversChange: (contacts: Contact[]) => void;
  onInternalContactsChange: (contacts: Contact[]) => void;
}

export function ContactsManager({
  clientApprovers,
  internalContacts,
  onClientApproversChange,
  onInternalContactsChange,
}: ContactsManagerProps) {
  const { t } = useLanguage();
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientRole, setNewClientRole] = useState("");
  
  const [newInternalName, setNewInternalName] = useState("");
  const [newInternalEmail, setNewInternalEmail] = useState("");
  const [newInternalRole, setNewInternalRole] = useState("");

  const addClientApprover = () => {
    if (newClientName.trim() && newClientEmail.trim()) {
      const newContact: Contact = {
        id: crypto.randomUUID(),
        name: newClientName.trim(),
        email: newClientEmail.trim(),
        role_description: newClientRole.trim() || undefined,
      };
      onClientApproversChange([...clientApprovers, newContact]);
      setNewClientName("");
      setNewClientEmail("");
      setNewClientRole("");
    }
  };

  const removeClientApprover = (id: string) => {
    onClientApproversChange(clientApprovers.filter((c) => c.id !== id));
  };

  const addInternalContact = () => {
    if (newInternalName.trim() && newInternalEmail.trim()) {
      const newContact: Contact = {
        id: crypto.randomUUID(),
        name: newInternalName.trim(),
        email: newInternalEmail.trim(),
        role_description: newInternalRole.trim() || undefined,
      };
      onInternalContactsChange([...internalContacts, newContact]);
      setNewInternalName("");
      setNewInternalEmail("");
      setNewInternalRole("");
    }
  };

  const removeInternalContact = (id: string) => {
    onInternalContactsChange(internalContacts.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Client Approvers */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t('productRequests.clientApprovers')}
          </CardTitle>
          <CardDescription>
            {t('productRequests.clientApproversDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing client approvers */}
          {clientApprovers.length > 0 && (
            <div className="space-y-2">
              {clientApprovers.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-2 p-2 rounded-md border bg-muted/50"
                >
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{contact.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                  </div>
                  {contact.role_description && (
                    <Badge variant="secondary" className="flex-shrink-0">
                      {contact.role_description}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={() => removeClientApprover(contact.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add new client approver */}
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">{t('table.name')}</Label>
              <Input
                placeholder="John Doe"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('table.email')}</Label>
              <Input
                type="email"
                placeholder="john@client.com"
                value={newClientEmail}
                onChange={(e) => setNewClientEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('table.role')}</Label>
              <Input
                placeholder="Design Manager"
                value={newClientRole}
                onChange={(e) => setNewClientRole(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addClientApprover}
                disabled={!newClientName.trim() || !newClientEmail.trim()}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('action.add')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Internal Notification Contacts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {t('productRequests.internalContacts')}
          </CardTitle>
          <CardDescription>
            {t('productRequests.internalContactsDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing internal contacts */}
          {internalContacts.length > 0 && (
            <div className="space-y-2">
              {internalContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-2 p-2 rounded-md border bg-muted/50"
                >
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{contact.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                  </div>
                  {contact.role_description && (
                    <Badge variant="outline" className="flex-shrink-0">
                      {contact.role_description}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={() => removeInternalContact(contact.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add new internal contact */}
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">{t('table.name')}</Label>
              <Input
                placeholder="Sales Rep Name"
                value={newInternalName}
                onChange={(e) => setNewInternalName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('table.email')}</Label>
              <Input
                type="email"
                placeholder="rep@bioflex.com"
                value={newInternalEmail}
                onChange={(e) => setNewInternalEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('table.role')}</Label>
              <Input
                placeholder="Sales Rep"
                value={newInternalRole}
                onChange={(e) => setNewInternalRole(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addInternalContact}
                disabled={!newInternalName.trim() || !newInternalEmail.trim()}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('action.add')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
