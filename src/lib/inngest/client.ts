import { Inngest } from "inngest"

export const inngest = new Inngest({
  id: "hipath-ai",
  name: "HiPath AI",
  signingKey: process.env.INNGEST_SIGNING_KEY,
  eventKey: process.env.INNGEST_EVENT_KEY
})