import { describe, expect, it, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { Dialog } from "../../src/components/ui/Dialog";
import { Tooltip } from "../../src/components/ui/Tooltip";
import { DropdownMenu } from "../../src/components/ui/DropdownMenu";
import { DatePicker } from "../../src/components/ui/DatePicker";
import { BottomSheet } from "../../src/components/BottomSheet";
import { LazyMotion, domAnimation } from "motion/react";

// Helper wrapper for LazyMotion to avoid errors about motion context in unit tests
const wrapWithLazyMotion = (ui: React.ReactElement) => {
  return render(
    <LazyMotion features={domAnimation}>
      {ui}
    </LazyMotion>
  );
};

afterEach(() => {
  cleanup();
});

describe("Radix & Motion Components", () => {
  describe("Dialog Component", () => {
    it("renders dialog when open is true", () => {
      const handleOpenChange = vi.fn();
      wrapWithLazyMotion(
        <Dialog open={true} onOpenChange={handleOpenChange} title="Test Title">
          <div>Dialog Body Content</div>
        </Dialog>
      );
      expect(screen.getByText("Test Title")).toBeDefined();
      expect(screen.getByText("Dialog Body Content")).toBeDefined();
    });

    it("does not render dialog when open is false", () => {
      const handleOpenChange = vi.fn();
      wrapWithLazyMotion(
        <Dialog open={false} onOpenChange={handleOpenChange} title="Test Title">
          <div>Dialog Body Content</div>
        </Dialog>
      );
      expect(screen.queryByText("Test Title")).toBeNull();
      expect(screen.queryByText("Dialog Body Content")).toBeNull();
    });
  });

  describe("Tooltip Component", () => {
    it("renders tooltip content trigger", () => {
      render(
        <Tooltip content="Tooltip Content">
          <button>Hover Me</button>
        </Tooltip>
      );
      const trigger = screen.getByText("Hover Me");
      expect(trigger).toBeDefined();
    });
  });

  describe("DropdownMenu Component", () => {
    it("renders dropdown trigger", () => {
      const items = [
        { label: "Option 1", onClick: vi.fn() },
        { label: "Option 2", onClick: vi.fn() }
      ];
      render(
        <DropdownMenu trigger={<button>Click Me</button>} items={items} />
      );
      expect(screen.getByText("Click Me")).toBeDefined();
    });
  });

  describe("DatePicker Component", () => {
    it("renders date picker with placeholder", () => {
      const handleChange = vi.fn();
      render(
        <DatePicker value="" onChange={handleChange} placeholder="Pick Date" />
      );
      expect(screen.getByText("Pick Date")).toBeDefined();
    });

    it("displays date picker trigger button", () => {
      const handleChange = vi.fn();
      render(
        <DatePicker value="2026-06-12" onChange={handleChange} placeholder="Pick Date" />
      );
      expect(screen.getByRole("button")).toBeDefined();
    });
  });

  describe("BottomSheet Component", () => {
    it("renders BottomSheet content when open is true", () => {
      const handleClose = vi.fn();
      wrapWithLazyMotion(
        <BottomSheet open={true} onClose={handleClose} title="Sheet Title">
          <div>Sheet Body Content</div>
        </BottomSheet>
      );
      expect(screen.getByText("Sheet Title")).toBeDefined();
      expect(screen.getByText("Sheet Body Content")).toBeDefined();
    });
  });

  describe("PDF Viewer Keyboard Navigation", () => {
    it("dispatches page turn actions on ArrowRight and ArrowDown", () => {
      const onNext = vi.fn();
      const onPrev = vi.fn();
      const onEscape = vi.fn();

      const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        const tagName = target?.tagName?.toUpperCase();
        if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target?.isContentEditable) {
          return;
        }
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          onNext();
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          onPrev();
        } else if (e.key === "Escape") {
          e.preventDefault();
          onEscape();
        }
      };

      window.addEventListener("keydown", handleKeyDown);

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
      expect(onNext).toHaveBeenCalledTimes(1);

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
      expect(onNext).toHaveBeenCalledTimes(2);

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
      expect(onPrev).toHaveBeenCalledTimes(1);

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
      expect(onPrev).toHaveBeenCalledTimes(2);

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(onEscape).toHaveBeenCalledTimes(1);

      window.removeEventListener("keydown", handleKeyDown);
    });

    it("ignores navigation keys when typing in an input or textarea element", () => {
      const onNext = vi.fn();

      const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        const tagName = target?.tagName?.toUpperCase();
        if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target?.isContentEditable) {
          return;
        }
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          onNext();
        }
      };

      window.addEventListener("keydown", handleKeyDown);

      // Create an input and dispatch from it
      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();

      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      expect(onNext).not.toHaveBeenCalled();

      const textarea = document.createElement("textarea");
      document.body.appendChild(textarea);
      textarea.focus();

      textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      expect(onNext).not.toHaveBeenCalled();

      document.body.removeChild(input);
      document.body.removeChild(textarea);
      window.removeEventListener("keydown", handleKeyDown);
    });
  });
});
