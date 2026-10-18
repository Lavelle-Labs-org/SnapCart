# Order-by-SMS: Product Documentation Index

Welcome to the **Order-by-SMS** technical and product specification suite. The product documentation is organized into modular reference documents below:

---

## Product Documentation Directory

| Document | Primary Focus | Key Contents |
| --- | --- | --- |
| **[01. Product Overview & Scope](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/01-product-overview-and-scope.md)** | Problem, Solution, Scope | Vision, merchant personas, MVP deliverables, nice-to-have, out-of-scope boundaries |
| **[02. User Journeys & Lifecycle](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/02-user-journeys-and-lifecycle.md)** | Workflows & State Machine | Seller journey, buyer journey, pickup handover, 5-state lifecycle rules |
| **[03. Functional Requirements](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/03-functional-requirements.md)** | Formal Requirements | FR-1 to FR-30 covering auth, products, storefront, OTP, links, and logs |
| **[04. SMS Strategy & Templates](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/04-sms-strategy-and-templates.md)** | Messaging Rules & Copy | 7 SMS event triggers, English & Amharic copy, GSM-7/UCS-2 limits, credits, opt-outs |
| **[05. SMSHub Integration](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/05-smshub-integration.md)** | Gateway Integration | Bearer auth, `/api/sms`, `/api/test`, Verify API, HMAC webhooks, retry matrix |
| **[06. Security & Privacy](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/06-security-and-privacy.md)** | Hardening & Protection | Cryptographic tokens (`/a/{token}`), hashed pickup codes, consent audit, rate limits |
| **[07. System Architecture](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/07-system-architecture-and-tech-stack.md)** | Technical Topology | Component diagram, sequence flows, tech stack choices, deployment setup |
| **[08. Data Model & Database](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/08-data-model-and-database.md)** | Schema & Entities | 12 database tables, santim integer currency, relationships, constraints |
| **[09. Routes & API Specification](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/09-routes-and-api-spec.md)** | API Surface | Public storefront routes, authenticated dashboard endpoints, action links, webhooks |
| **[10. UI & UX Specifications](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/10-ui-ux-design-specs.md)** | Screen Specs | 14 mobile-first screens, 44px tap targets, high contrast, state buttons |
| **[11. Testing & QA Plan](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/11-testing-and-quality-assurance.md)** | Quality Assurance | Zero-cost test tiering, scenarios E1 to E11, simulated failure modes |
| **[12. Build Plan & Timeline](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/12-build-plan-and-timeline.md)** | 11-Day Schedule | Day-by-day roadmap (18–28 Oct), solo builder allocation, cut line, checkpoints |
| **[13. Submission & Judging](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/13-submission-and-judging.md)** | Competition Deliverables | 100-point rubric mapping, 3-minute video script, problem/solution narrative |
| **[14. Risks & Decisions](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/14-risks-and-decisions.md)** | Contingencies | KYC approvals, credit budgets, carrier caveats, settled architectural choices |

---

*Original monolithic source reference preserved in [Order-by-SMS End-to-End Product Document.md](file:///c:/Users/Student4/OneDrive/Documents/0%20-%20projects/order%20by%20sms/docs/Order-by-SMS%20End-to-End%20Product%20Document.md).*
