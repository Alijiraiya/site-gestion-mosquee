# ZAKAT Technical Documentation

This documentation describes the active donation-management application for the next development team. It is based on the repository source, Prisma schema, migrations, route handlers, and current user interface. Historical `backup-*` directories are not treated as active behavior.

## Reading order

1. [Project Overview](00_Project_Overview.md) — purpose, users, technology, and system view.
2. [Architecture](01_Architecture.md) — App Router, API boundary, state, tenancy, and data flow.
3. [Project Structure](02_Project_Structure.md) — why the repository is organized as it is.
4. [Database](03_Database.md) — entities, relations, enums, indexes, migrations, and seeds.
5. [API Reference](04_API.md) — current HTTP contract.
6. [Authentication](05_Authentication.md) — session implementation, route protection, and gaps.
7. [Donation and Distribution Workflow](06_Donation_Workflow.md) — business lifecycle and financial mutations.
8. [Distribution Algorithm](07_Distribution_Algorithm.md) — SVF-weighted Water-Filling behavior and edge cases.
9. [Internationalization](08_Internationalization.md) — French/Arabic, RTL, locale cookies, and theme.
10. [Current Features](09_Current_Features.md) — implemented capabilities only.
11. [Missing Features](10_Missing_Features.md) — incomplete, planned, and disconnected functionality.
12. [Next Team Roadmap](11_Next_Team_Roadmap.md) — prioritized continuation plan.
13. [Deployment](12_Deployment.md) — build, migration, runtime, and operational guidance.
14. [Known Issues](13_Known_Issues.md) — concrete risks and technical debt.

The existing [Developer Guide](Developer_Guide.md) contains hands-on local setup and extension conventions. Start with the overview and architecture, then read the database/API/authentication documents before making a change. For any financial or security work, review the workflow, algorithm, known issues, and roadmap together.

## Documentation principles

- Source code and `prisma/schema.prisma` remain authoritative when documentation and implementation differ.
- Every tenant-sensitive change must preserve mosque-scoped query behavior.
- Every financial mutation should be transactional and reversible through an explicit business process.
- No feature should be called complete merely because its schema or UI placeholder exists.
