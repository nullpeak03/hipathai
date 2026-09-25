import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("./email", () => ({ sendEmail: vi.fn(async () => true) }))

import { sendEmail } from "./email"
import { sendAdminAlert, resetAlertThrottle } from "./alerts"

const mockedSend = sendEmail as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  resetAlertThrottle()
  mockedSend.mockClear()
  vi.stubEnv("ADMIN_ALERT_EMAIL", "admin@example.com")
})

describe("sendAdminAlert", () => {
  it("sends once per scope per hour (throttled)", async () => {
    await sendAdminAlert("scope-a", "Fail 1", "details")
    await sendAdminAlert("scope-a", "Fail 2", "details")
    expect(mockedSend).toHaveBeenCalledTimes(1)
    await sendAdminAlert("scope-b", "Fail 3", "details")
    expect(mockedSend).toHaveBeenCalledTimes(2)
  })
  it("skips silently without an admin email configured", async () => {
    vi.stubEnv("ADMIN_ALERT_EMAIL", "")
    await sendAdminAlert("scope-a", "Fail", "details")
    expect(mockedSend).not.toHaveBeenCalled()
  })
  it("never throws when sending fails", async () => {
    mockedSend.mockRejectedValueOnce(new Error("net down"))
    await expect(sendAdminAlert("scope-a", "Fail", "details")).resolves.toBeUndefined()
  })
})
