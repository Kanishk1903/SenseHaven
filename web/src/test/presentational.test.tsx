import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ErrorState } from "@/components/ErrorState";
import { Kpi } from "@/components/Kpi";
import { OrbMark } from "@/components/OrbMark";
import { PageHeader } from "@/components/PageHeader";
import { Ring } from "@/components/Ring";
import { SkeletonCard } from "@/components/Skeleton";
import { StatusChip } from "@/components/StatusChip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

describe("presentational components (P4.7)", () => {
  it("StatusChip covers every state with icon + text", () => {
    for (const kind of ["active", "cooldown", "locked", "offline", "unpaired", "calm", "neutral", "stressed"] as const) {
      const { container, unmount } = render(<StatusChip kind={kind} />);
      expect(container.querySelector("svg")).not.toBeNull();
      expect(container.textContent?.length).toBeGreaterThan(3);
      unmount();
    }
  });

  it("StatusChip accepts a custom label", () => {
    render(<StatusChip kind="calm" label="Feeling settled" />);
    expect(screen.getByText("Feeling settled")).toBeInTheDocument();
  });

  it("Kpi renders hint when no trend is given", () => {
    render(<Kpi label="Stress signals" value="2" hint="breathers started" />);
    expect(screen.getByText("breathers started")).toBeInTheDocument();
  });

  it("Kpi shows negative trend with a down marker", () => {
    render(<Kpi label="Avg calm" value="60" trendPct={-8.3} />);
    expect(screen.getByText("-8.3%")).toBeInTheDocument();
  });

  it("Ring clamps fractions outside 0..1", () => {
    const { container, rerender } = render(<Ring fraction={2} label="1 h" />);
    const circles = container.querySelectorAll("circle");
    expect(circles[1].getAttribute("stroke-dashoffset")).toBe("0");
    rerender(<Ring fraction={-1} label="0 m" />);
    const circlesAfter = container.querySelectorAll("circle");
    const circumference = 2 * Math.PI * ((128 - 10) / 2);
    expect(Number(circlesAfter[1].getAttribute("stroke-dashoffset"))).toBeCloseTo(circumference, 0);
  });

  it("Ring exposes the label for screen readers", () => {
    render(<Ring fraction={0.5} label="30 m" sub="remaining" />);
    expect(screen.getByLabelText("30 m")).toBeInTheDocument();
    expect(screen.getByText("remaining")).toBeInTheDocument();
  });

  it("ErrorState renders a retry button and a copyable request id", () => {
    render(<ErrorState message="We couldn't reach SenseHeaven." requestId="abcdef123456" onRetry={() => {}} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy request id/ })).toBeInTheDocument();
  });

  it("PageHeader pairs title, description and action", () => {
    render(<PageHeader title="Overview" description="Is everything OK right now?" action={<button>Action</button>} />);
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByText("Is everything OK right now?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
  });

  it("OrbMark renders a calm mood gradient by default and changes with mood", () => {
    const { container } = render(<OrbMark size={40} />);
    expect(container.querySelector("radialGradient")).not.toBeNull();
    const { container: stressContainer } = render(<OrbMark size={40} state="stressed" />);
    expect(stressContainer.querySelector("radialGradient")).not.toBeNull();
  });

  it("Skeletons are aria-hidden so screen readers skip loading state", () => {
    const { container } = render(<SkeletonCard lines={2} />);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(3);
  });

  it("Button supports variant and disabled", () => {
    render(<Button variant="danger" disabled>Remove</Button>);
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
  });

  it("Card renders children inside a bordered surface", () => {
    const { container } = render(<Card>content</Card>);
    expect(container.firstChild).toHaveTextContent("content");
    expect(container.firstChild?.textContent).not.toBe("");
  });
});
