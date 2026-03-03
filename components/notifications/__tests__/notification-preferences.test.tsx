import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { NotificationPreferencesForm } from "../notification-preferences";

const mockUpdatePreferences = vi.fn();

const basePrefs = {
  email_enabled: true,
  email_address: null as string | null,
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

vi.mock("@/lib/notifications/hooks", () => ({
  useNotificationPreferences: () => ({
    preferences: basePrefs,
    isLoading: false,
    error: null,
    updatePreferences: mockUpdatePreferences,
    refetch: vi.fn(),
  }),
  usePushNotificationStatus: () => ({
    isSupported: false,
    permission: "default",
    requestPermission: vi.fn(),
  }),
  subscribeToPushNotifications: vi.fn(),
  unsubscribeFromPushNotifications: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  basePrefs.email_address = null;
});

describe("NotificationPreferencesForm — email input", () => {
  it("does not call updatePreferences while typing a partial email", () => {
    render(<NotificationPreferencesForm />);

    const emailInput = screen.getByPlaceholderText("your@email.com");

    fireEvent.change(emailInput, { target: { value: "t" } });
    fireEvent.change(emailInput, { target: { value: "te" } });
    fireEvent.change(emailInput, { target: { value: "test" } });
    fireEvent.change(emailInput, { target: { value: "test@" } });

    expect(mockUpdatePreferences).not.toHaveBeenCalled();
  });

  it("calls updatePreferences with the email address on blur", async () => {
    mockUpdatePreferences.mockResolvedValue(undefined);
    render(<NotificationPreferencesForm />);

    const emailInput = screen.getByPlaceholderText("your@email.com");

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    await act(async () => {
      fireEvent.blur(emailInput);
    });

    expect(mockUpdatePreferences).toHaveBeenCalledOnce();
    expect(mockUpdatePreferences).toHaveBeenCalledWith({
      email_address: "test@example.com",
    });
  });

  it("calls updatePreferences with null when cleared on blur", async () => {
    mockUpdatePreferences.mockResolvedValue(undefined);
    render(<NotificationPreferencesForm />);

    const emailInput = screen.getByPlaceholderText("your@email.com");

    fireEvent.change(emailInput, { target: { value: "" } });
    await act(async () => {
      fireEvent.blur(emailInput);
    });

    expect(mockUpdatePreferences).toHaveBeenCalledOnce();
    expect(mockUpdatePreferences).toHaveBeenCalledWith({
      email_address: null,
    });
  });

  it("shows the saved email address from preferences", () => {
    basePrefs.email_address = "saved@example.com";

    render(<NotificationPreferencesForm />);

    const emailInput = screen.getByPlaceholderText(
      "your@email.com",
    ) as HTMLInputElement;

    expect(emailInput.value).toBe("saved@example.com");
  });
});
