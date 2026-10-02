import { Link } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <EmptyState
        title="We couldn't find that page"
        body="It may have been moved or removed. Head back to your dashboard."
        action={
          <Link to="/" className="rounded-control bg-primary px-4 py-2 font-medium text-on-primary hover:bg-primary-hover">
            Back to SenseHeaven
          </Link>
        }
      />
    </main>
  );
}
