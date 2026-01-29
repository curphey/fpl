"use client";

import { useState } from "react";
import {
  useNotificationPreferences,
  usePushNotificationStatus,
} from "@/lib/notifications/hooks";
import type { NotificationPreferencesUpdate } from "@/lib/notifications/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function Toggle({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? "bg-fpl-green" : "bg-fpl-border"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function SettingRow({
  label,
  description,
  enabled,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <div className="font-medium">{label}</div>
        {description && (
          <div className="text-sm text-fpl-muted">{description}</div>
        )}
      </div>
      <Toggle enabled={enabled} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function HourSelect({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-fpl-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-md border border-fpl-border bg-fpl-card px-2 py-1 text-sm"
      >
        {[1, 2, 3, 6, 12, 24, 48].map((h) => (
          <option key={h} value={h}>
            {h}h before
          </option>
        ))}
      </select>
    </div>
  );
}

export function NotificationPreferencesForm() {
  const { preferences, isLoading, error, updatePreferences } =
    useNotificationPreferences();
  const {
    isSupported: pushSupported,
    permission,
    requestPermission,
  } = usePushNotificationStatus();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleUpdate = async (updates: NotificationPreferencesUpdate) => {
    setSaving(true);
    setSaveError(null);
    try {
      await updatePreferences(updates);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleEnablePush = async () => {
    if (permission !== "granted") {
      const result = await requestPermission();
      if (result !== "granted") {
        setSaveError("Push notification permission denied");
        return;
      }
    }

    // In a real implementation, we would register a service worker and get the subscription
    // For now, just enable the preference
    await handleUpdate({ push_enabled: true });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent>
              <div className="h-32 animate-pulse rounded bg-fpl-border" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <p className="py-8 text-center text-sm text-fpl-danger">
            {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Default values for new users
  const prefs = preferences ?? {
    email_enabled: false,
    email_address: null,
    email_deadline_reminder: true,
    email_deadline_hours: 24,
    email_weekly_summary: true,
    email_transfer_recommendations: true,
    push_enabled: false,
    push_deadline_reminder: true,
    push_deadline_hours: 1,
    push_price_changes: true,
    push_injury_news: true,
    push_league_updates: true,
    quiet_hours_start: null,
    quiet_hours_end: null,
    timezone: "Europe/London",
  };

  return (
    <div className="space-y-6">
      {saveError && (
        <div className="rounded-lg border border-fpl-danger/30 bg-fpl-danger/10 p-3 text-sm text-fpl-danger">
          {saveError}
        </div>
      )}

      {saving && (
        <div className="rounded-lg border border-fpl-green/30 bg-fpl-green/10 p-3 text-sm text-fpl-green">
          Saving...
        </div>
      )}

      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Email Notifications</CardTitle>
              {prefs.email_enabled && <Badge variant="green">Enabled</Badge>}
            </div>
            <Toggle
              enabled={prefs.email_enabled}
              onChange={(v) => handleUpdate({ email_enabled: v })}
            />
          </div>
          <p className="text-xs text-fpl-muted">
            Receive FPL updates and recommendations via email
          </p>
        </CardHeader>
        {prefs.email_enabled && (
          <CardContent>
            <div className="space-y-1 divide-y divide-fpl-border">
              <div className="pb-3">
                <label className="text-sm text-fpl-muted">Email address</label>
                <input
                  type="email"
                  value={prefs.email_address ?? ""}
                  onChange={(e) =>
                    handleUpdate({ email_address: e.target.value || null })
                  }
                  placeholder="your@email.com"
                  className="mt-1 w-full rounded-md border border-fpl-border bg-fpl-card px-3 py-2 text-sm"
                />
              </div>

              <SettingRow
                label="Deadline reminders"
                description="Get notified before the GW deadline"
                enabled={prefs.email_deadline_reminder}
                onChange={(v) => handleUpdate({ email_deadline_reminder: v })}
              />
              {prefs.email_deadline_reminder && (
                <div className="py-2 pl-4">
                  <HourSelect
                    value={prefs.email_deadline_hours}
                    onChange={(v) => handleUpdate({ email_deadline_hours: v })}
                    label="Remind me"
                  />
                </div>
              )}

              <SettingRow
                label="Weekly summary"
                description="Receive a summary after each gameweek"
                enabled={prefs.email_weekly_summary}
                onChange={(v) => handleUpdate({ email_weekly_summary: v })}
              />

              <SettingRow
                label="Transfer recommendations"
                description="Weekly transfer suggestions based on your team"
                enabled={prefs.email_transfer_recommendations}
                onChange={(v) =>
                  handleUpdate({ email_transfer_recommendations: v })
                }
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Push Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Push Notifications</CardTitle>
              {prefs.push_enabled && <Badge variant="green">Enabled</Badge>}
              {!pushSupported && <Badge variant="default">Not supported</Badge>}
            </div>
            {pushSupported ? (
              prefs.push_enabled ? (
                <Toggle
                  enabled={prefs.push_enabled}
                  onChange={(v) => handleUpdate({ push_enabled: v })}
                />
              ) : (
                <button
                  onClick={handleEnablePush}
                  className="rounded-md bg-fpl-green px-3 py-1.5 text-sm font-medium text-white"
                >
                  Enable
                </button>
              )
            ) : null}
          </div>
          <p className="text-xs text-fpl-muted">
            Real-time alerts for price changes, injuries, and more
          </p>
        </CardHeader>
        {prefs.push_enabled && (
          <CardContent>
            <div className="space-y-1 divide-y divide-fpl-border">
              <SettingRow
                label="Deadline reminders"
                description="Alert before the GW deadline"
                enabled={prefs.push_deadline_reminder}
                onChange={(v) => handleUpdate({ push_deadline_reminder: v })}
              />
              {prefs.push_deadline_reminder && (
                <div className="py-2 pl-4">
                  <HourSelect
                    value={prefs.push_deadline_hours}
                    onChange={(v) => handleUpdate({ push_deadline_hours: v })}
                    label="Remind me"
                  />
                </div>
              )}

              <SettingRow
                label="Price changes"
                description="Alert when your players are about to change price"
                enabled={prefs.push_price_changes}
                onChange={(v) => handleUpdate({ push_price_changes: v })}
              />

              <SettingRow
                label="Injury news"
                description="Alert when players in your squad get injured"
                enabled={prefs.push_injury_news}
                onChange={(v) => handleUpdate({ push_injury_news: v })}
              />

              <SettingRow
                label="Mini-league updates"
                description="Alert after each gameweek with your league standings"
                enabled={prefs.push_league_updates}
                onChange={(v) => handleUpdate({ push_league_updates: v })}
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle>Quiet Hours</CardTitle>
          <p className="text-xs text-fpl-muted">
            Pause notifications during specific hours
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm">From</span>
              <select
                value={prefs.quiet_hours_start ?? ""}
                onChange={(e) =>
                  handleUpdate({
                    quiet_hours_start: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                className="rounded-md border border-fpl-border bg-fpl-card px-2 py-1 text-sm"
              >
                <option value="">Off</option>
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i.toString().padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">To</span>
              <select
                value={prefs.quiet_hours_end ?? ""}
                onChange={(e) =>
                  handleUpdate({
                    quiet_hours_end: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
                className="rounded-md border border-fpl-border bg-fpl-card px-2 py-1 text-sm"
                disabled={prefs.quiet_hours_start === null}
              >
                <option value="">Off</option>
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i.toString().padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
