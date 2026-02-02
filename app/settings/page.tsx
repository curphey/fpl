"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        setHasApiKey(data.hasAnthropicApiKey);
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anthropicApiKey: apiKey }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error });
        return;
      }

      setHasApiKey(data.hasAnthropicApiKey);
      setApiKey("");
      setMessage({ type: "success", text: "API key saved successfully!" });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemove() {
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings", { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error });
        return;
      }

      setHasApiKey(false);
      setMessage({ type: "success", text: "API key removed" });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to remove API key" });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="animate-pulse">
          <div className="h-8 bg-white/10 rounded w-48 mb-8" />
          <div className="h-64 bg-white/10 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">AI Features</h2>
          <p className="text-sm text-white/60">
            Configure your Anthropic API key to enable AI-powered features like
            transfer suggestions, captain picks, and optimization.
          </p>
        </CardHeader>
        <CardContent>
          {hasApiKey ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <svg
                  className="w-5 h-5 text-green-500 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-green-500">API key configured</span>
              </div>

              <p className="text-sm text-white/60">
                Your API key is securely stored. AI features are enabled.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setHasApiKey(false)}
                  className="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  Update key
                </button>
                <button
                  onClick={handleRemove}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                >
                  Remove key
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label
                  htmlFor="apiKey"
                  className="block text-sm font-medium mb-2"
                >
                  Anthropic API Key
                </label>
                <input
                  type="password"
                  id="apiKey"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-fpl-purple focus:border-transparent"
                  required
                />
              </div>

              <div className="text-sm text-white/60 space-y-2">
                <p>To get an API key:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>
                    Go to{" "}
                    <a
                      href="https://console.anthropic.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-fpl-purple hover:underline"
                    >
                      console.anthropic.com
                    </a>
                  </li>
                  <li>Sign up or log in</li>
                  <li>Go to API Keys and create a new key</li>
                  <li>Copy the key (starts with sk-ant-)</li>
                </ol>
              </div>

              <button
                type="submit"
                disabled={isSaving || !apiKey}
                className="w-full px-4 py-3 bg-fpl-purple hover:bg-fpl-purple/80 disabled:bg-white/10 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                {isSaving ? "Validating..." : "Save API Key"}
              </button>
            </form>
          )}

          {message && (
            <div
              className={`mt-4 p-4 rounded-lg ${
                message.type === "success"
                  ? "bg-green-500/10 border border-green-500/30 text-green-500"
                  : "bg-red-500/10 border border-red-500/30 text-red-500"
              }`}
            >
              {message.text}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="text-lg font-semibold">About AI Features</h2>
        </CardHeader>
        <CardContent className="text-sm text-white/60 space-y-3">
          <p>
            With an API key configured, you can use AI-powered features
            including:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Transfer recommendations and optimization</li>
            <li>Captain pick analysis</li>
            <li>GW Decision Simulator</li>
            <li>Rival Gameplan Analyzer</li>
            <li>Injury Return Predictor</li>
            <li>FPL news search</li>
          </ul>
          <p>
            API usage is billed by Anthropic based on the number of tokens used.
            Most FPL queries cost less than $0.01.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
