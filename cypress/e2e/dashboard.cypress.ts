describe("HiPath AI Dashboard E2E Flow", () => {
  beforeEach(() => {
    cy.visit("/")
    // Wait for page to load and check if auth is required
    cy.contains("text", "Learn with a path that adapts to you").should("exist")
  })

  describe("Onboarding Flow", () => {
    it("should complete onboarding steps and generate roadmap", () => {
      cy.visit("/onboarding/step/1")

      // Step 1: Select role
      cy.contains("button", "Professional").click()
      cy.contains("button", "Next").click()

      // Step 2: Career goal
      cy.contains("input", "Build full-stack applications").type("{enter}")
      cy.contains("button", "Next").click()

      // Step 3: Skill level
      cy.contains("button", "Intermediate").click()
      cy.contains("button", "Next").click()

      // Step 4: Hours per week
      cy.contains("button", "10-20 hours").click()
      cy.contains("button", "Next").click()

      // Step 5: Content format
      cy.contains("button", "Interactive").click()
      cy.contains("button", "Next").click()

      // Step 6: Topics of interest
      cy.contains("input", "React").type("{enter}")
      cy.contains("button", "Generate Roadmap").click()

      // Should navigate to generating page
      cy.url().should("include", "/onboarding/generating")

      // Wait for roadmap generation
      cy.contains("text", "Your personalized roadmap").should("exist")
    })
  })

  describe("Dashboard Navigation", () => {
    beforeEach(() => {
      // Assume onboarding is complete and user is on dashboard
      cy.visit("/dashboard")
    })

    it("should display dashboard with stats cards", () => {
      cy.contains("h1", "Your learning command center")
      cy.contains("span", "Active Roadmaps")
      cy.contains("span", "Lessons Completed")
      cy.contains("span", "Study Streak")
      cy.contains("span", "Total Study Time")
    })

    it("should navigate to roadmaps page", () => {
      cy.visit("/dashboard/roadmaps")
      cy.contains("h1", "Roadmaps")
      cy.contains("text", "Create Roadmap")
    })

    it("should navigate to profile page", () => {
      cy.visit("/dashboard/profile")
      cy.contains("h1", "Profile")
      cy.contains("text", "Total Study Time")
      cy.contains("text", "Avg Quiz Score")
    })

    it("should navigate to analytics page", () => {
      cy.visit("/dashboard/analytics")
      cy.contains("h1", "Analytics Dashboard")
      cy.contains("text", "Total Study Time")
      cy.contains("text", "Average Quiz Score")
    })
  })

  describe("Roadmap Details", () => {
    beforeEach(() => {
      // Navigate to roadmaps and create one
      cy.visit("/dashboard/roadmaps/new")
      // This would require onboarding completion - skipping for now
      cy.visit("/dashboard/roadmaps")
    })

    it("should view roadmap details", () => {
      // If roadmaps exist, click first one
      cy.contains("card", /Roadmap/).first().click({ multiple: true })
      cy.url().should("include", "/dashboard/roadmaps/")
    })
  })

  describe("Quiz Flow", () => {
    beforeEach(() => {
      // Requires active roadmap with lessons
      cy.visit("/dashboard")
    })

    it("should navigate to quiz session", () => {
      // This requires a completed lesson with quiz
      // Skip if no roadmap data
      cy.contains("text", "Take Quiz").first().click({ multiple: true })
      cy.url().should("include", "/quiz")
    })

    it("should submit quiz answers", () => {
      // This requires quiz to be loaded
      cy.contains("button", "Submit Quiz").click({ multiple: true })
      cy.contains("text", "Quiz submitted").should("exist")
    })
  })

  describe("Review / Spaced Repetition", () => {
    beforeEach(() => {
      cy.visit("/dashboard")
    })

    it("should fetch due concepts for review", () => {
      cy.visit("/dashboard/reviews/due")
      cy.contains("text", "Concepts Due").should("exist")
    })

    it("should submit review answer", () => {
      cy.visit("/dashboard/reviews/due")
      cy.contains("button", "I Correctly Remembered").click({ multiple: true })
      cy.contains("text", "Review submitted").should("exist")
    })
  })

  describe("Analytics & Export", () => {
    beforeEach(() => {
      cy.visit("/dashboard/analytics")
    })

    it("should display weekly analytics", () => {
      cy.contains("text", "Weekly").click()
      cy.contains("h1", "Analytics Dashboard")
    })

    it("should export analytics report", () => {
      cy.contains("button", "Export Report").click({ multiple: true })
      // Should trigger download
      cy.contains("text", "hipath-analytics").should("exist")
    })
  })
})