import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { z } from "zod";
import { useActions } from "ai/rsc";

const apiKeySchema = z.object({
  fireworks: z.string().min(1, "Fireworks API key is required"),
  openai: z.string().optional(),
});

type ApiKeys = {
  fireworks: string | null;
  openai?: string | null;
};

export function ApiKeyModal() {
  const { listModels } = useActions();

  const [open, setOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeys>({
    fireworks: null,
    openai: null,
  });
  const [errors, setErrors] = useState<{
    fireworks?: string;
    openai?: string;
  }>({});
  const [isFirstOpen, setIsFirstOpen] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  // Load API keys from localStorage on mount
  useEffect(() => {
    const savedKeys = localStorage.getItem("apiKeys");
    if (savedKeys) {
      const parsed = JSON.parse(savedKeys);
      if (!parsed.fireworks) {
        setOpen(true);
        setIsFirstOpen(true);
        return;
      }
      setApiKeys(parsed);
    } else {
      setOpen(true);
      setIsFirstOpen(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    (async () => {
      setIsValidating(true);
      let validated: ApiKeys;
      const savedKeys = localStorage.getItem("apiKeys");
      const parsedSavedKeys = savedKeys ? JSON.parse(savedKeys || "{}") : null;

      try {
        validated = apiKeySchema.parse({
          fireworks: e.currentTarget.fireworks.value,
          openai: e.currentTarget.openai.value,
        }) as ApiKeys;
      } catch (error) {
        if (error instanceof z.ZodError) {
          setErrors((prev) => ({
            ...prev,
            fireworks: `Invalid API key: ${error.message}`,
          }));
        }
        setIsValidating(false);
        return;
      }
      // Test Fireworks API key
      const result = await listModels({
        fireworksAPIKey: validated.fireworks,
        openaiAPIKey: validated.openai,
      });
      if (result.error) {
        if (
          validated.fireworks &&
          !parsedSavedKeys?.fireworks &&
          (!result.fireworks || !result.fireworks.length)
        ) {
          setErrors((prev) => ({
            ...prev,
            fireworks: `Invalid Fireworks API key: ${result.error}`,
          }));
        }
        if (validated.openai && (!result.openai || !result.openai.length)) {
          setErrors((prev) => ({
            ...prev,
            openai: `Invalid OpenAI API key: ${result.error}`,
          }));
        }
        setIsValidating(false);
        return;
      }

      localStorage.setItem("apiKeys", JSON.stringify(validated));

      setOpen(false);
    })();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!!open && !!isFirstOpen) {
          alert("Please enter your Fireworks API key to continue");
          return;
        }
        setOpen(open);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Configure API Keys</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>API Key Configuration</DialogTitle>
          <DialogDescription>
            Enter your API keys for the different providers. The Fireworks API
            key is required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fireworks">Fireworks API Key</Label>
            <Input
              id="fireworks"
              type="password"
              disabled={isValidating}
              value={apiKeys.fireworks ?? ""}
              onChange={(e) =>
                setApiKeys((prev) => ({ ...prev, fireworks: e.target.value }))
              }
              placeholder="Enter your Fireworks API key"
              required
              className={errors.fireworks ? "border-red-500" : ""}
            />
            {errors.fireworks && (
              <p className="text-sm text-red-500">{errors.fireworks}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="openai">OpenAI API Key (Optional)</Label>
            <Input
              id="openai"
              type="password"
              value={apiKeys.openai ?? ""}
              disabled={isValidating}
              onChange={(e) =>
                setApiKeys((prev) => ({ ...prev, openai: e.target.value }))
              }
              placeholder="Enter your OpenAI API key (optional)"
              className={errors.openai ? "border-red-500" : ""}
            />
            {errors.openai && (
              <p className="text-sm text-red-500">{errors.openai}</p>
            )}
          </div>
          <div className="flex justify-end space-x-2">
            {!isFirstOpen && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isValidating}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isValidating}>
              {isValidating ? "Validating..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
