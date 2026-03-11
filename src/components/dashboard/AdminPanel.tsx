import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Settings, Save, CheckCircle, AlertCircle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function AdminPanel() {
  const [apiKey, setApiKey] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("kite_config")
        .select("api_key, access_token")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setApiKey(data.api_key);
        setAccessToken(data.access_token);
        setConfigured(true);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim() || !accessToken.trim()) {
      toast({ title: "Error", description: "Both fields are required.", variant: "destructive" });
      return;
    }
    setSaving(true);

    // Delete existing and insert new
    await supabase.from("kite_config").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const { error } = await supabase.from("kite_config").insert({
      api_key: apiKey.trim(),
      access_token: accessToken.trim(),
    });

    setSaving(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setConfigured(true);
      toast({ title: "Saved", description: "API credentials updated successfully." });
    }
  };

  return (
    <Card className="border-border bg-card max-w-lg mx-auto">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Settings className="h-4 w-4" />
          Kite Connect API
          {configured ? (
            <CheckCircle className="h-3.5 w-3.5 text-success ml-auto" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-warning ml-auto" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">API Key</Label>
          <Input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Your Kite API key"
            className="text-xs bg-secondary border-border"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Access Token (changes daily)</Label>
          <Input
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Paste today's access token"
            className="text-xs bg-secondary border-border"
          />
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full text-xs"
          size="sm"
        >
          <Save className="h-3.5 w-3.5 mr-1" />
          {saving ? "Saving..." : "Save Credentials"}
        </Button>

        <Button
          variant="destructive"
          size="sm"
          className="w-full text-xs mt-2"
          onClick={async () => {
            const { error } = await supabase
              .from("volume_history")
              .delete()
              .neq("id", "00000000-0000-0000-0000-000000000000");
            if (error) {
              toast({ title: "Error", description: error.message, variant: "destructive" });
            } else {
              toast({ title: "Cleared", description: "All volume history data deleted." });
            }
          }}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Delete All Volume History
        </Button>
      </CardContent>
    </Card>
  );
}
