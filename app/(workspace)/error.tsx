"use client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/display";
import { CircleAlert } from "lucide-react";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <EmptyState
      icon={<CircleAlert size={28} />}
      title="This workspace couldn’t load"
      description="Try loading the page again. No business action has been run."
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
