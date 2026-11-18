---
name: frontend-ui-ux
description: Use when building or extending the frontend of the Ticketing System (React 18 + Vite, Tailwind v4, shadcn, react-bits cyan kit, Recharts, React Router v6, axios). Covers the design language, theming tokens, project structure, routing, component composition, and data flow. Front-load this skill for any UI work, pages, components, charts, routes, or theming changes in this repo.
---

# Frontend UI & UX — Structure & Conventions

For the full system (backend, database, infra, end-to-end flows), see [ARCHITECTURE.md](./ARCHITECTURE.md). This document focuses on the frontend: the design language, theming model, file/structure conventions, and how screens are composed.

This document describes the frontend of the Ticketing System: the design language,
the theming model, the file/structure conventions, and how screens are composed.
It is the source of truth for "how the UI is built and how to extend it." Where it
conflicts with older notes, this file wins (it reflects the current code).

Stack: React 18 + Vite 5, Tailwind CSS v4, shadcn primitives, the in-repo
`react-bits` cyan kit, Recharts (admin dashboard), React Router v6, axios.

---

## 1. Design language (the look)

The product uses a **dark, cyan-accented "Apple-inspired" aesthetic**:

- Background: near-black (`--rb-bg: #09090f`).
- Surfaces/cards: slightly lighter panel (`--rb-panel: #120f17`) with a faint
  cyan border (`--rb-panel-border`, accent @ 18% alpha).
- Accent: cyan-500 (`--rb-accent: #06b6d4`) for active states, links, highlights,
  focus rings. A lighter cyan (`--rb-accent-light: #67e8f9`) is used for hover text.
- Typography: system/SF Pro stack, with an Apple-style scale where larger sizes use
  tighter letter-spacing (see `.rb-display`, `.rb-title`, `.rb-headline`, `.rb-body`,
  `.rb-caption` helpers below).
- Motion: the kit ships animated components (`ElectricBorder` glow, `LetterGlitch`,
  `ParticleText`, `TrueFocus`), but day-to-day surfaces stay calm — motion is used
  for emphasis (hero, card borders), not everywhere.

### Type helpers (use these, don't hand-roll sizes)
Defined in `src/components/react-bits/theme.css`:

| Class        | Size  | Weight     | Tracking   | Use                        |
|--------------|-------|------------|------------|----------------------------|
| `.rb-display`| 34px  | bold       | tight      | big hero numbers           |
| `.rb-title`  | 28px  | semibold   | snug       | center donut total, headers|
| `.rb-headline`| 17px | semibold   | normal     | card titles, section heads |
| `.rb-body`   | 15px  | regular    | normal     | default body text          |
| `.rb-caption`| 12px  | medium     | wide, UPPER| labels, legend, eyebrows   |

### Status / priority color language
These are the canonical ticket colors (also reused by the donut palette):

- `OPEN` → cyan `#06b6d4`
- `IN_PROGRESS` → amber `#f59e0b`
- `RESOLVED` → green `#22c55e`
- `CLOSED` → slate `#64748b`
- Priorities: `LOW` / `MEDIUM` / `HIGH` / `URGENT` rendered via `PriorityBadge`.

---

## 2. Theming model (two token systems that must agree)

There are **two** CSS token systems. They are intentionally bridged so they never
fight.

### A. React-bits kit tokens — `src/components/react-bits/theme.css`
The single source of truth for the cyan theme. Imported once at the app root via
`src/index.css` (`@import './components/react-bits/theme.css'`). Every kit component
reads these `--rb-*` variables. **No kit component should hardcode a hex in JSX.**

Key tokens:
- `--rb-accent`, `--rb-accent-light`, `--rb-accent-soft` (40% alpha), `--rb-accent-deep`
- `--rb-bg`, `--rb-panel`, `--rb-panel-border`, `--rb-text`, `--rb-text-muted`
- Alpha pre-mixes: `--rb-accent-12`, `--rb-accent-24`, `--rb-accent-60`
- Font scale + tracking tokens, and the `.rb-*` type helpers + `.rb-surface`/`.rb-input`.

### B. shadcn / Tailwind v4 tokens — `src/index.css` (`@theme inline`)
shadcn primitives read `--color-background`, `--color-primary`, etc. These are wired
to **the same cyan** in `.dark` so the two systems agree:

```css
@theme inline {
  --color-rb-accent: var(--rb-accent);
  --color-rb-bg:     var(--rb-bg);
  --color-rb-panel:  var(--rb-panel);
}
```

So you can write either `bg-[color:var(--rb-panel)]` (kit style) or `bg-rb-panel`
(Tailwind utility) — they resolve identically.

### Rule of thumb
- Building a **kit surface/card** → use `--rb-panel` + `ElectricBorder` + `.rb-*` type.
- Building a **form/control** → use shadcn `ui/` primitives + `.rb-input` for the
  dark-input fix (white text + cyan caret).
- Never introduce a new accent color outside `theme.css`.

---

## 3. Project structure

```
src/
  components/
    ui/                 # shadcn primitives (button, card, input, label, select, textarea, badge, avatar)
    react-bits/         # the themed kit
      theme.css         #  <-- all --rb-* tokens + .rb-* helpers (SSOT)
      index.ts          # barrel: re-exports kit + RB_THEME constant
      ElectricBorder/   # glowing animated card border (wrap cards / CTAs)
      LineSidebar/      # nav/section lists
      TrueFocus/        # animated page-header focus
      ParticleText/     # hero headlines
      LetterGlitch/     # full-bleed background
      Dock/             # fixed bottom navigation (used in layout)
    StatusBadge.tsx     # ticket status pill (color-coded)
    PriorityBadge.tsx   # ticket priority pill
    DashboardCharts.tsx # Recharts wrappers (StatusDonut, BarBreakdown) — themed
    ProtectedRoute.tsx  # route guard (auth + optional role gate)
  layouts/
    AppLayout.tsx       # authenticated shell: header nav + <Outlet/> + Dock
  pages/
    OverviewPage.tsx    # public landing (hero, ParticleText/LetterGlitch)
    LoginPage.tsx       # auth entry
    DashboardPage.tsx   # role-discriminated dashboard (ADMIN/TECH/EMP views)
    TicketsPage.tsx     # ticket list (role-scoped) + filters
    NewTicketPage.tsx   # create ticket (employee)
    TicketDetailPage.tsx# single ticket + comment thread + status changes
  hooks/
    useAuth.tsx         # AuthContext: user, login, logout, token restore
  services/
    api.ts              # axios instance: auth header, 401 refresh, logout handling
    auth.ts             # /auth endpoints
    tickets.ts          # ticket list/get/create/update/assign
    dashboard.ts        # /dashboard (role-scoped payload)
    comments.ts         # comment list/create
  lib/
    utils.ts            # cn() class-merge helper
  types/
    index.ts            # shared TS types (Ticket, User, Role, DashboardResponse, ...)
  App.tsx               # router + AuthProvider
  main.tsx              # entry; mounts <App/>
  index.css             # tailwind + theme import + token bridge
```

---

## 4. Routing & role-gating

Defined in `src/App.tsx` (React Router v6):

```
/                     OverviewPage        (public landing)
/login                LoginPage          (public)
/kit                  -> redirect to /
/dashboard            DashboardPage     (protected, inside AppLayout)
/tickets              TicketsPage       (protected)
/tickets/new          NewTicketPage     (protected)
/tickets/:id          TicketDetailPage  (protected)
*                     -> redirect to /
```

### Auth + role flow
1. `AuthProvider` (`hooks/useAuth.tsx`) restores the session on load via `GET /auth/me`
   using the access token in `localStorage`. `loading` is true until resolved.
2. `ProtectedRoute` (`components/ProtectedRoute.tsx`):
   - while `loading` → shows "Loading…"
   - no user → redirect to `/login` (preserving `from`)
   - optional `allowedRoles` prop → 403-style redirect to `/dashboard` with
     `state={{ denied: true }}` (the dashboard shows a "no permission" banner).
3. `AppLayout` renders the header (active `NavLink`s, user name + role pill, logout)
   and the `Dock` bottom nav, with `<Outlet/>` for the page.

### Server-enforced, not just UI
Role scoping is **not** only a UI concern. The backend returns a different
`DashboardResponse` shape per role (`AdminDashboard` / `TechnicianDashboard` /
`EmployeeDashboard`), and ticket list/comment access is filtered server-side. The
frontend branches on the `role` discriminator and never receives another role's
analytics payload. See `types/index.ts` (`DashboardResponse` union) and
`DashboardPage.tsx` (per-role view components).

---

## 5. Component composition patterns

### Cards / surfaces — wrap in `ElectricBorder`
The standard "panel" look is an `ElectricBorder` around a `var(--rb-panel)` inner
block:

```tsx
<ElectricBorder color={RB_THEME.accent} className="rounded-xl">
  <div className="bg-[color:var(--rb-panel)] rounded-xl p-5">
    <h3 className="rb-headline text-[color:var(--rb-text)]">Title</h3>
    {/* content */}
  </div>
</ElectricBorder>
```

`RB_THEME` (cyan accent + glitch colors) is exported from `@/components/react-bits`.

### Charts (admin dashboard) — `DashboardCharts.tsx`
- `StatusDonut` — donut of tickets by status; center shows the total at rest and
  swaps to a per-status panel (name + count, `--rb-panel` bg + `--rb-accent` border)
  on segment hover/focus. Includes a color-key legend with counts.
- `BarBreakdown` — horizontal bar for any `{name, count}[]` (category / priority /
  technician / department).

Both are wrapped in `ElectricBorder` and use `--rb-*` tokens so they match the kit.
The donut deliberately has **no floating tooltip** (it used to stack on the center
label) — hover swaps the center content instead.

### Badges
- `StatusBadge` / `PriorityBadge` — color-coded pills for `ticket.status` /
  `ticket.priority`, placed in lists and detail views.

### Forms & inputs
Use shadcn `ui/input`, `ui/textarea`, `ui/select`, `ui/label` and add the `.rb-input`
class (or rely on the global `.rb-input` rule) for correct dark-mode contrast: white
text, cyan caret, accent focus ring, and an autofill override.

---

## 6. Data flow (frontend → backend)

```
Page (e.g. DashboardPage)
  └─ services/dashboard.ts  getDashboard()
       └─ services/api.ts   axios instance (baseURL '/api')
            ├─ request interceptor: injects `Authorization: Bearer <accessToken>`
            └─ response interceptor: on 401 (non-auth call) → POST /auth/refresh
               → retry original with new token; on failure → clear + onLogout
  └─ types/index.ts  DashboardResponse (role union)
```

- All API calls go through the single `api` axios instance in `services/api.ts`.
- `tokenStore` manages `accessToken`/`refreshToken` in `localStorage`.
- `errorMessage(err)` extracts `err.response.data.error.message` for user-facing errors.
- Pages keep loading/error state and render empty/loading states (don't leave a blank
  page on fetch).

---

## 7. Conventions & rules (do / don't)

DO
- Reuse kit components (`ElectricBorder`, `Dock`, etc.) instead of re-implementing.
- Author new colors only in `theme.css`; reference them as `--rb-*` everywhere.
- Use `.rb-*` type helpers for consistent sizing/tracking.
- Gate sensitive screens with `ProtectedRoute` AND rely on server-side scoping.
- Keep pages thin: data via `services/*`, types from `types/index.ts`.

DON'T
- Hardcode hex values in component JSX (use the tokens).
- Introduce a second accent hue outside the kit palette.
- Mix light-mode shadcn colors into the dark kit without going through the `.dark`
  bridge.
- Use the old `assignedToMe` toggle pattern — technician scope is now server-enforced.
- Put a floating tooltip over the donut center (overlap bug, already fixed).

---

## 8. Where to add things

| You want to…                          | Put it in…                                          |
|---------------------------------------|-----------------------------------------------------|
| New themed card                       | wrap content in `ElectricBorder` + `--rb-panel`      |
| New color / token                     | `components/react-bits/theme.css`                   |
| New API call                          | `services/<resource>.ts` (use `api` instance)       |
| New shared type                       | `types/index.ts`                                    |
| New protected page                    | add route in `App.tsx` inside `AppLayout`, add page  |
| New nav item                          | `AppLayout.tsx` `dockItems` + `NavLink`s             |
| New chart                             | `DashboardCharts.tsx` (themed, `ElectricBorder`)     |
| New kit primitive                     | `components/react-bits/<Name>/` + export in `index.ts` |