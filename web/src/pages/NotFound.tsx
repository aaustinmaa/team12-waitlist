import { Link } from "react-router";

export function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Page not found</h1>
      <Link to="/" className="mt-4 inline-block font-medium text-teal-700 underline">Back to demo home</Link>
    </div>
  );
}
