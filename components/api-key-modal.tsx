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
  together: z.string().optional(),
});

type ApiKeys = {
  fireworks: string | null;
  together?: string | null;
};

export function ApiKeyModal() {
  const { listModels } = useActions();

  const [open, setOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeys>({
    fireworks: null,
    together: null,
  });
  const [errors, setErrors] = useState<{
    fireworks?: string;
    together?: string;
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
      try {
        validated = apiKeySchema.parse({
          fireworks: e.currentTarget.fireworks.value,
          together: e.currentTarget.together.value,
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
        togetherAPIKey: validated.together,
      });
      if (result.error) {
        if (
          validated.fireworks &&
          (!result.fireworks || !result.fireworks.length)
        ) {
          setErrors((prev) => ({
            ...prev,
            fireworks: `Invalid Fireworks API key: ${result.error}`,
          }));
        }
        if (
          validated.together &&
          (!result.together || !result.together.length)
        ) {
          setErrors((prev) => ({
            ...prev,
            together: `Invalid Together AI API key: ${result.error}`,
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
            <Label htmlFor="together">Together AI API Key (Optional)</Label>
            <Input
              id="together"
              type="password"
              value={apiKeys.together ?? ""}
              disabled={isValidating}
              onChange={(e) =>
                setApiKeys((prev) => ({ ...prev, together: e.target.value }))
              }
              placeholder="Enter your Together AI API key (optional)"
              className={errors.together ? "border-red-500" : ""}
            />
            {errors.together && (
              <p className="text-sm text-red-500">{errors.together}</p>
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
