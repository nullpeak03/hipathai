import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Button } from "./button"
import { ConfirmDialog } from "./confirm-dialog"

describe("Button", () => {
  it("renders its label for the default button element", () => {
    const html = renderToStaticMarkup(React.createElement(Button, null, "Save changes"))
    expect(html).toContain("Save changes")
  })

  it("sets an explicit text color on outline and ghost buttons", () => {
    const outline = renderToStaticMarkup(
      React.createElement(Button, { variant: "outline" }, "Download my data")
    )
    const ghost = renderToStaticMarkup(React.createElement(Button, { variant: "ghost" }, "Dismiss"))
    expect(outline).toContain("text-foreground")
    expect(ghost).toContain("text-foreground")
  })

  it("lets a per-button color override the variant foreground", () => {
    const html = renderToStaticMarkup(
      React.createElement(Button, { variant: "outline", className: "text-danger-fg" }, "Delete account")
    )
    expect(html).toContain("text-danger-fg")
    expect(html).not.toContain("text-foreground")
  })

  it("renders labels inside confirmation dialogs", () => {
    const html = renderToStaticMarkup(
      React.createElement(ConfirmDialog, {
        open: true,
        title: "Delete your account?",
        description: "This cannot be undone.",
        confirmLabel: "Delete everything",
        onConfirm: () => {},
        onClose: () => {},
      })
    )
    expect(html).toContain("Delete everything")
    expect(html).toContain("Cancel")
  })
})
