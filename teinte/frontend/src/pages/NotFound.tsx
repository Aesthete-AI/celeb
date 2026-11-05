import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="display mt-4 text-7xl">This shade doesn't exist.</h1>
      <p className="mt-4 text-mist-soft">The page you're looking for isn't here.</p>
      <Link to="/" className="btn-light mt-8">Back home</Link>
    </div>
  );
}
