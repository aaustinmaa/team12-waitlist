import { Link } from "react-router";
import { Compass } from "lucide-react";
import { btn, Card, EmptyState } from "../components/ui";

export function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Card>
        <h1 className="sr-only">Page not found</h1>
        <EmptyState
          icon={Compass}
          title="Page not found"
          action={
            <Link to="/" className={btn("primary")}>
              Back to the start
            </Link>
          }
        >
          That address doesn't match a page in this portal.
        </EmptyState>
      </Card>
    </div>
  );
}
