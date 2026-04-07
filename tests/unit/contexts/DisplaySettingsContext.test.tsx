import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeEach } from "vitest";
import {
  DisplaySettingsProvider,
  useDisplaySettings,
} from "@/contexts/DisplaySettingsContext";

function Harness() {
  const { settings, setSetting } = useDisplaySettings();
  return (
    <div>
      <div data-testid="online">{String(settings.showLordsDayOnlineColumn)}</div>
      <div data-testid="away">{String(settings.showLordsDayAwayColumn)}</div>
      <button
        type="button"
        data-testid="toggle-online"
        onClick={() =>
          setSetting("showLordsDayOnlineColumn", !settings.showLordsDayOnlineColumn)
        }
      >
        toggle online
      </button>
      <button
        type="button"
        data-testid="toggle-away"
        onClick={() =>
          setSetting("showLordsDayAwayColumn", !settings.showLordsDayAwayColumn)
        }
      >
        toggle away
      </button>
    </div>
  );
}

describe("DisplaySettingsContext", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("オンライン/他地方列の初期値が false", async () => {
    render(
      <DisplaySettingsProvider>
        <Harness />
      </DisplaySettingsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("online")).toHaveTextContent("false");
      expect(screen.getByTestId("away")).toHaveTextContent("false");
    });
  });

  it("setSetting で状態と localStorage を更新する", async () => {
    const user = userEvent.setup();

    render(
      <DisplaySettingsProvider>
        <Harness />
      </DisplaySettingsProvider>
    );

    await user.click(screen.getByTestId("toggle-online"));
    await user.click(screen.getByTestId("toggle-away"));

    await waitFor(() => {
      expect(screen.getByTestId("online")).toHaveTextContent("true");
      expect(screen.getByTestId("away")).toHaveTextContent("true");
    });

    expect(localStorage.getItem("churchstats-display-lords-day-online-column")).toBe(
      "1"
    );
    expect(localStorage.getItem("churchstats-display-lords-day-away-column")).toBe(
      "1"
    );
  });

  it("localStorage の保存値を復元する", async () => {
    localStorage.setItem("churchstats-display-lords-day-online-column", "1");
    localStorage.setItem("churchstats-display-lords-day-away-column", "1");

    render(
      <DisplaySettingsProvider>
        <Harness />
      </DisplaySettingsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("online")).toHaveTextContent("true");
      expect(screen.getByTestId("away")).toHaveTextContent("true");
    });
  });
});
