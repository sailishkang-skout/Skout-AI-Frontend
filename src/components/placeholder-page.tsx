import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PlaceholderPageProps {
  title: string;
  description: string;
  apiPath?: string;
}

export function PlaceholderPage({ title, description, apiPath }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
          <CardDescription>
            {apiPath
              ? `Wire to ${apiPath} when backend is running.`
              : "Implementation pending — route scaffold in place."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This route is scaffolded per the system components catalog.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
