# FlowPilot AI Project Analysis

## 1. Complete Folder Structure

### Repository Root
- backend/
- frontend/
- PROJECT_ANALYSIS.md

### backend/
- main.py
- run.py
- requirements.txt
- .env
- venv/
- __pycache__/
- app/

### backend/app/
- main.py
- core/
- routers/
- services/
- schemas/
- api/ (empty)
- db/ (empty)
- models/ (empty)
- agents/ (empty)
- __pycache__/

### backend/app/core/
- config.py
- database.py
- __pycache__/

### backend/app/routers/
- customers.py
- products.py
- suppliers.py
- execution_engine.py
- __pycache__/

### backend/app/services/
- customer_service.py
- product_service.py
- supplier_service.py
- execution_engine_service.py
- __pycache__/

### backend/app/schemas/
- customer.py
- product.py
- supplier.py
- execution_engine.py
- __pycache__/

### frontend/
- index.html
- package.json
- package-lock.json
- vite.config.ts
- tsconfig.json
- tsconfig.app.json
- tsconfig.node.json
- components.json
- .oxlintrc.json
- README.md
- public/
- src/
- node_modules/

### frontend/public/
- favicon.svg
- icons.svg

### frontend/src/
- App.tsx
- index.css
- main.tsx
- vite-env.d.ts
- assets/
- components/
- hooks/ (empty)
- lib/
- pages/
- services/
- styles/ (empty)
- types/ (empty)
- utils/ (empty)

### frontend/src/assets/
- hero.png
- react.svg
- vite.svg

### frontend/src/components/
- layout/
- ui/
- workflow/ (empty)

### frontend/src/components/layout/
- Navbar.tsx
- Sidebar.tsx

### frontend/src/components/ui/
- button.tsx

### frontend/src/pages/
- Analytics/ (empty)
- Approvals/ (empty)
- Customers/
- Dashboard/
- Login/
- Products/
- Quotations/ (empty)
- Settings/ (empty)
- Suppliers/
- Workflows/

### frontend/src/pages/Customers/
- Customers.tsx

### frontend/src/pages/Dashboard/
- Dashboard.tsx

### frontend/src/pages/Login/
- Login.tsx

### frontend/src/pages/Products/
- Products.tsx

### frontend/src/pages/Suppliers/
- Suppliers.tsx
- index.ts

### frontend/src/pages/Workflows/
- ExecutionEngine.tsx
- index.ts

### frontend/src/services/
- customers.ts
- products.ts
- suppliers.ts
- executionEngine.ts

## 2. Existing Frontend Pages

The frontend currently has these implemented pages:
- Login
- Dashboard
- Customers
- Products
- Suppliers
- AI Execution Engine

Empty page folders currently exist for:
- Analytics
- Approvals
- Quotations
- Settings

The menu also includes Inbox and AI Execution Engine navigation, but Inbox is not implemented as a page.

## 3. Existing React Components

### Shared Layout Components
- [Navbar]
- [Sidebar]

### UI Components
- [Button]
- [cn] utility in src/lib/utils.ts

### Page-Level Components
- Login page
- Dashboard page
- Customers page
- Products page
- Suppliers page
- AI Execution Engine page

### Shared Frontend Services
- customers.ts
- products.ts
- suppliers.ts
- executionEngine.ts

## 4. Existing Backend Architecture

The backend is a FastAPI application organized into a simple but clear layered structure:
- app/main.py is the active FastAPI application used by backend/run.py.
- app/core/config.py loads environment variables.
- app/core/database.py creates the Supabase client.
- app/schemas/*.py defines request/response payload shapes.
- app/services/*.py contains Supabase access and business logic.
- app/routers/*.py exposes APIRouter endpoints.

Important architecture note:
- backend/main.py is a second standalone FastAPI app with its own root route.
- backend/run.py uses app.main:app, so backend/main.py is effectively a duplicate entrypoint and not the runtime path.

The backend currently uses direct Supabase table operations instead of an ORM or repository abstraction.

## 5. Existing FastAPI Routes

### Active application routes from app/main.py
- GET /

### Customers
- GET /customers/
- POST /customers/
- PUT /customers/{customer_id}
- DELETE /customers/{customer_id}

### Products
- GET /products/
- POST /products/
- PUT /products/{product_id}
- DELETE /products/{product_id}
- GET /products/suppliers

### Suppliers
- GET /suppliers/
- POST /suppliers/
- PUT /suppliers/{supplier_id}
- DELETE /suppliers/{supplier_id}

### AI Execution Engine
- POST /execution-engine/plans
- GET /execution-engine/plans
- GET /execution-engine/plans/{plan_id}

## 6. Existing Supabase Integration

Supabase is integrated through backend/app/core/database.py, which creates a client from env-loaded credentials.

Integration pattern:
- backend/app/core/config.py reads SUPABASE_URL and SUPABASE_KEY from environment variables.
- backend/app/core/database.py creates the Supabase client with create_client().
- Services call supabase.table(...).select()/insert()/update()/delete()/upsert().

Current Supabase-backed tables used in code:
- customers
- products
- suppliers
- execution_plans

The project currently uses direct table access with no repository layer, no migration files, and no generated schema contract in the repo.

## 7. Existing Database Tables

These tables are inferred from the codebase, not defined by migrations in the repository:

### customers
Likely fields used by the app:
- id
- company_id
- name
- email
- phone
- address
- notes
- created_at / updated_at implied by typical Supabase metadata

### products
Likely fields used by the app:
- id
- supplier_id
- name
- sku
- category
- price
- inventory
- description
- created_at / updated_at implied

### suppliers
Likely fields used by the app:
- id
- name
- rating
- lead_time
- address
- products_supplied
- created_at / updated_at implied

### execution_plans
Likely fields used by the app:
- id
- enquiry
- status
- execution_plan as a JSON object
- created_at
- updated_at

Important note:
- There are no SQL migration files or table definitions in the repository, so these schemas are inferred from service and schema code only.

## 8. Existing Dependencies

### Frontend dependencies
Installed and referenced in package.json:
- react
- react-dom
- react-router-dom
- axios
- lucide-react
- framer-motion
- react-icons
- reactflow
- class-variance-authority
- clsx
- tailwind-merge
- tw-animate-css
- @base-ui/react
- @fontsource/inter
- @fontsource-variable/geist
- shadcn

Dev dependencies:
- vite
- @vitejs/plugin-react
- @tailwindcss/vite
- tailwindcss
- typescript
- oxlint
- @types/node
- @types/react
- @types/react-dom

### Backend dependencies
Installed and referenced in requirements.txt:
- fastapi
- uvicorn
- python-dotenv
- supabase
- google-generativeai
- sqlalchemy
- pydantic
- python-multipart

## 9. Missing Dependencies

### Package dependencies
No obvious package dependencies are missing from the manifests for the currently implemented feature set. The project builds successfully after the existing TypeScript config compatibility fix.

### Runtime dependencies that are required but environment-specific
These are required for the application to function in production:
- SUPABASE_URL
- SUPABASE_KEY
- GEMINI_API_KEY
- GEMINI_MODEL is optional but currently supported
- VITE_API_URL is optional for frontend API override

### Production infrastructure dependencies that are still missing
- A durable background job queue or worker for execution plan processing
- A database migration/DDL workflow for Supabase schema management
- Authentication/authorization infrastructure
- Observability stack: logging, metrics, tracing, error reporting

## 10. Missing Modules

### Backend modules still empty
- app/api/
- app/db/
- app/models/
- app/agents/

### Frontend feature modules still empty
- src/pages/Analytics/
- src/pages/Approvals/
- src/pages/Quotations/
- src/pages/Settings/
- src/pages/Inbox is not present as a page even though it exists in the sidebar menu
- src/components/workflow/ is empty
- src/hooks/ is empty
- src/styles/ is empty
- src/types/ is empty
- src/utils/ is empty

### Missing functional modules at the product level
- Authentication and session management
- Role-based access control
- Notification system
- Activity/audit log module
- Server-side pagination/search/filtering layer
- Background execution worker for Gemini-driven workflows
- Error monitoring / telemetry layer
- Supabase schema migration and seeding module

## 11. Dead Code

### Clearly dead or duplicate backend code
- backend/main.py is a duplicate FastAPI app entrypoint and is not used by backend/run.py.
- _update_record() in backend/app/services/execution_engine_service.py is currently unused.

### Clearly unused frontend assets
The following assets are present in src/assets but not referenced by the application code:
- hero.png
- react.svg
- vite.svg

### Placeholder or inert files
- frontend/src/pages/Suppliers/index.ts is only a re-export convenience file.
- Empty feature folders under frontend/src/pages and backend/app are scaffolding, not active code.

## 12. Duplicate Code

The codebase has several deliberate but still duplicated patterns:

### Backend duplication
- Each CRUD module repeats the same Supabase service pattern:
  - list
  - create
  - update
  - delete
- Each router is a thin wrapper over similarly structured service calls.
- Product service duplicates supplier lookup behavior that is also directly available from the supplier route.

### Frontend duplication
- Customers, Products, and Suppliers pages all implement the same UI pattern separately:
  - page header
  - search box
  - table
  - loading skeleton
  - empty state
  - edit dialog
  - delete dialog
  - pagination
- Each API service file creates its own axios instance.
- Button variants and card/table styling are repeated inline across pages instead of using shared feature primitives.

## 13. Architecture Issues

- Two backend entrypoints exist: backend/main.py and backend/app/main.py.
- The backend uses direct table access from services instead of a repository or data-access layer.
- There is no migration/seed system for Supabase schemas in the repository.
- The execution engine uses asyncio.create_task() inside a request handler, which is not durable across process restarts.
- Gemini plan generation is performed synchronously during request handling, which can block the request path.
- The execution engine state is persisted by rewriting the full record repeatedly; there is no event log or state machine abstraction.
- Frontend pages are feature-complete individually, but there is no shared table/dialog/form system to eliminate repeated patterns.
- Sidebar navigation includes some items that do not have corresponding pages yet.
- There is no 404 route or dedicated route guard structure.
- There is no auth boundary between routes and APIs.

## 14. Security Issues

- No authentication or authorization is enforced anywhere.
- No role-based permissions exist for customer, product, supplier, or execution engine operations.
- No row-level security policy enforcement is represented in the repository.
- Gemini receives raw user enquiry text directly, so prompt injection risk exists.
- No request throttling or rate limiting exists.
- No audit logging exists for destructive operations.
- If SUPABASE_KEY is a privileged key, its safe storage becomes critical; the repo does not show secret management hardening.
- CORS is configured only for localhost:5173, which is fine for dev but must be revisited for production deployment.
- Execution plans are written back to the database by background task without explicit retries, locking, or idempotency guarantees.

## 15. Performance Issues

- Frontend tables load full datasets client-side and paginate in memory only.
- Search is fully client-side, which will degrade with larger tables.
- CRUD flows refresh the full list after mutations instead of updating the local cache optimistically.
- The execution engine polls the backend every 2 seconds while a plan is running or pending.
- The execution engine writes multiple full-record updates to Supabase while advancing through each step.
- There is no caching layer or query library for frontend data fetching.
- There is no virtualization for large tables.
- Gemini execution is synchronous at request time, so long model latency impacts the API response path.

## 16. Code Quality Score

Score: 74 / 100

Why:
- Strong modular split between frontend and backend.
- Clear route/service/schema pattern on the backend.
- Good UI consistency across the implemented pages.
- However, there is repeated CRUD/UI boilerplate, no shared data layer, no tests, no migration system, and no auth architecture.

## 17. Production Readiness Score

Score: 58 / 100

Why:
- Core business flows exist and the frontend builds successfully.
- Supabase and Gemini integration are in place.
- But the app is still missing production fundamentals: auth, RLS, migrations, job orchestration, observability, durable execution, and route coverage.

## 18. TODOs Before Production

### Must-have
- Add authentication and session management.
- Add role-based authorization for all write and AI execution endpoints.
- Define and apply Supabase table migrations for customers, products, suppliers, and execution_plans.
- Add row-level security policies in Supabase.
- Replace asyncio.create_task with a durable worker or background job queue.
- Make Gemini execution idempotent and retry-safe.
- Add backend validation and error handling for malformed Gemini output beyond the current JSON parsing fallback.
- Add request rate limiting and abuse protection.
- Add audit logging for create, update, delete, and execution-plan generation events.
- Add observability: structured logs, metrics, and error tracking.
- Add production deployment configuration for the frontend and backend.

### Strongly recommended
- Remove backend/main.py or make it clearly point to the same app to eliminate entrypoint ambiguity.
- Remove the unused _update_record helper if it remains unnecessary.
- Remove unused starter assets: hero.png, react.svg, vite.svg.
- Consolidate repeated table/dialog/search/pagination UI into reusable shared components.
- Consolidate repeated axios client creation into one shared API client.
- Add server-side pagination and search endpoints.
- Add a 404 route and navigation fallback.
- Add loading, success, and error state consistency across all pages.
- Add tests for backend route/service logic.
- Add tests for the frontend data-fetching flows and dynamic execution engine UI.
- Add a real Inbox page or remove the sidebar entry.
- Add pages for Analytics, Approvals, Quotations, and Settings or remove those menu entries until implemented.
- Define a proper execution plan state machine if the workflow logic becomes more complex.
- Add input sanitization and content validation around Gemini outputs.
- Add environment validation at startup so missing variables fail fast with clear errors.

### Nice-to-have
- Introduce a shared design system component set for cards, dialogs, tables, and empty states.
- Add optimistic updates for CRUD screens.
- Add server-driven filters for status, date, and ownership.
- Add export/reporting features for customers, products, suppliers, and execution plans.
- Add accessibility review for dialogs, tables, and sidebar interactions.

## Summary

FlowPilot AI is a promising multi-module CRUD + AI orchestration app with a clean separation between frontend and backend services. The implemented modules are functional, the UI is coherent, and the frontend currently builds successfully. The main blockers to production are missing authentication, missing database migrations and RLS, lack of a durable execution worker, and the absence of operational hardening around security, observability, and testing.
