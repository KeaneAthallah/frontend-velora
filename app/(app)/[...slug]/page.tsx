import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";

export default function ModulePlaceholder({ params }: { params: { slug?: string[] } }) {
  const name = params.slug?.join(" / ") ?? "Module";
  return (
    <Card>
      <CardContent className="p-6">
        <EmptyState
          title={`${name} — coming soon`}
          description="This module is not yet implemented or its backend contract has not been verified. Navigation is preserved for future activation."
        />
      </CardContent>
    </Card>
  );
}
