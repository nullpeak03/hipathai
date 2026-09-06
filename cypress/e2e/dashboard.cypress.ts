describe("HiPath AI Dashboard Flow", () => {
  beforeEach(() => {
    // Visit the login page first
    cy.visit("/sign-in")
    // TODO: Add Clerk auth mock or test credentials
    cy.contains("button", "Sign In").click()
  })

  it("should navigate from onboarding to dashboard", () => {
    cy.visit("/onboarding")
    // Complete first step
    cy.contains("button", "Next").click()
    // Should proceed to next step
    cy.url().should("include", "/onboarding/step/2")
  })

  it("should display dashboard page", () => {
    cy.visit("/dashboard")
    cy.contains("h1", "Your learning command center")
  })

  it("should navigate to roadmaps page", () => {
    cy.visit("/dashboard/roadmaps")
    cy.contains("h1", "Roadmaps")
  })

  it("should navigate to profile page", () => {
    cy.visit("/dashboard/profile")
    cy.contains("h1", "Profile")
  })

  it("should navigate to analytics page", () => {
    cy.visit("/dashboard/analytics")
    cy.contains("h1", "Analytics Dashboard")
  })
})
