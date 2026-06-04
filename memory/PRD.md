# MapForge — Interactive Map Builder PRD

## Original Problem Statement
> сделай сайт на русском языке, где можно создать интерактивные карты для игр, проектов и историй. можно создать фантастические миры, ролевые кампании, где можно рисовать области и тд

## User Choices
- Auth: JWT (email + password)
- Map editor: polygons, markers, custom background image upload, layers
- AI: not needed
- Sharing: personal maps + public share-link
- Design: modern minimalist (delivered as dark high-contrast Swiss with amber accents)

## Architecture
- **Backend**: FastAPI, MongoDB (motor), bcrypt for passwords, PyJWT HS256 access tokens (httpOnly cookie + Bearer header fallback), CORS limited to FRONTEND_URL.
- **Frontend**: React 19 + react-router-dom, Tailwind + shadcn/ui, sonner toasts, SVG-based map canvas (pan, zoom, polygon and marker tools).
- **DB**: collections `users` (unique email index), `maps` (owner_id + share_token indexes). String uuid `id` fields, no `_id` leakage.

## User Personas
- Tabletop RPG game masters preparing campaign maps
- Writers and worldbuilders sketching fantasy continents
- Indie game devs prototyping level/region maps
- Hobbyists organising story locations into shareable visuals

## Core Requirements (static)
- Russian-language UI everywhere
- Auth: register, login, logout, /me
- Map CRUD (per-user ownership)
- Editor with polygons, markers (title+description popup), layers (visible/rename/delete), custom background, pan/zoom, undo via fresh selection, save (Ctrl+S)
- Public sharing via random share_token at `/m/:token` (read-only viewer)

## Implemented (2026-02)
- Backend endpoints: `/api/auth/{register,login,logout,me}`, `/api/maps` CRUD, `/api/maps/{id}/share`, `/api/public/maps/{share_token}`.
- AuthContext on frontend with axios `withCredentials` + localStorage Bearer fallback.
- Pages: Landing (hero+features+CTA), Login, Register, Dashboard (grid + create modal + delete), MapEditor (toolbar/canvas/layers/properties panel), PublicViewer.
- SVG MapCanvas: pan/zoom (wheel), polygon drawing with click-to-add-point, Enter/double-click to finish, Esc to cancel; marker placement with click; click on shapes selects them in edit mode or opens popup in read-only mode.
- Sonner toast notifications.
- Backend tests: 16/16 passing (auth, ownership, share toggle, public access, no _id leakage).
- Frontend E2E smoke: register → create map → draw polygon → place marker → save → share — all green.

## Backlog
**P0 (none — MVP complete)**

**P1**
- Drag existing polygons/markers to reposition
- Polygon point editing (drag vertices, insert/remove points)
- Background image positioning/scaling controls (currently fixed viewBox)
- Image storage via object storage (currently base64 in MongoDB; cap added to 4MB client-side, but should use S3-style storage)
- Brute force protection on login (5 attempts → 15 min lockout)
- Refresh token rotation (currently 7-day access token)

**P2**
- Multi-select + bulk edit
- Layer reorder via drag-and-drop
- Export map as PNG/SVG
- Gallery of public community maps
- Search/filter on Dashboard
- Collaborative editing (websockets)
