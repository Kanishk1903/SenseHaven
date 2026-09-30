import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, describe, it, vi } from "vitest";

import { ConfirmDialog } from "./ConfirmDialog";
import { DataTable, type Column } from "./DataTable";
import { DurationPicker } from "./DurationPicker";
import { Kpi } from "./Kpi";
import { PinInput } from "./PinInput";
import { StatusChip } from "./StatusChip";

describe("component kit (P4.2)", () => {
  it("StatusChip shows icon + text, never colour alone", () => {
    const { container } = render(<StatusChip kind="active" />);
    expect(screen.getByText("Screen time active")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull(); // icon + text, never colour alone
  });

  it("Kpi renders tabular value and trend", () => {
    render(<Kpi label="Screen time" value="1 h 25 m" trendPct={12.5} />);
    expect(screen.getByText("1 h 25 m")).toBeInTheDocument();
    expect(screen.getByText("+12.5%")).toBeInTheDocument();
    expect(screen.getByText(/vs last period/)).toBeInTheDocument();
  });

  it("PinInput completes via keypad clicks", () => {
    const onComplete = vi.fn();
    render(<PinInput onComplete={onComplete} />);
    for (const digit of ["1", "2", "3", "4", "5", "6"]) {
      fireEvent.click(screen.getByRole("button", { name: digit }));
    }
    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  it("PinInput accepts keyboard input and reports progress", () => {
    const onComplete = vi.fn();
    render(<PinInput onComplete={onComplete} />);
    fireEvent.keyDown(window, { key: "9" });
    expect(screen.getByRole("status")).toHaveTextContent("1 of 6 digits entered");
    fireEvent.keyDown(window, { key: "Backspace" });
    expect(screen.getByRole("status")).toHaveTextContent("0 of 6 digits entered");
    for (const digit of "901234") fireEvent.keyDown(window, { key: digit });
    expect(onComplete).toHaveBeenCalledWith("901234");
  });

  it("DurationPicker toggles presets and takes custom minutes", async () => {
    const onChange = vi.fn();
    render(<DurationPicker valueMin={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "30 min" }));
    expect(onChange).toHaveBeenCalledWith(30);
    const custom = screen.getByLabelText(/Custom/);
    await userEvent.type(custom, "45"); // controlled input re-reads valueMin; digits arrive separately
    expect(onChange).toHaveBeenCalledWith(4);
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("DataTable renders rows, sorts on header clicks, degrades to cards", async () => {
    type Row = { name: string; seconds: number };
    const rows: Row[] = [
      { name: "YouTube", seconds: 500 },
      { name: "Chrome", seconds: 900 },
    ];
    const columns: Column<Row>[] = [
      { key: "name", header: "App", render: (row) => row.name, sortValue: (row) => row.name },
      { key: "seconds", header: "Time", render: (row) => `${row.seconds} s`, sortValue: (row) => row.seconds },
    ];
    const { container } = render(<DataTable columns={columns} rows={rows} getRowKey={(row) => row.name} />);
    // jsdom renders both the desktop table and the mobile card list
    expect(screen.getAllByText("YouTube").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Chrome").length).toBeGreaterThan(0);
    // sort by app: YouTube < Chrome? ascending puts Chrome first
    await userEvent.click(screen.getByRole("button", { name: "Sort by App" }));
    await waitFor(() => expect(container.querySelector("tbody tr td")?.textContent).toBe("Chrome"));
    await userEvent.click(screen.getByRole("button", { name: "Sort by App" }));
    await waitFor(() => expect(container.querySelector("tbody tr td")?.textContent).toBe("YouTube"));
  });

  it("ConfirmDialog enables the danger action only when the word is typed", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Delete child"
        description="This removes all data."
        confirmWord="Aarav"
        onConfirm={onConfirm}
      />,
    );
    const confirmButton = screen.getByRole("button", { name: "Confirm" });
    expect(confirmButton).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Type Aarav to confirm/), "Aarav");
    await userEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
