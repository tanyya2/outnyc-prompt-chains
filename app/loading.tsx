// Shown while a page checks who is visiting. Also the <Suspense> boundary
// that lets every page read the login cookie (needed with cacheComponents).
export default function Loading() {
  return <p className="mx-auto w-full max-w-screen-2xl px-6 py-6 text-sm text-muted">Loading…</p>;
}
