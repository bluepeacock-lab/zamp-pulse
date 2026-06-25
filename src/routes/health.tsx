import { createFileRoute } from "@tanstack/react-router";
import Layout, { PlaceholderCard } from "@/components/Layout";

export const Route = createFileRoute("/health")({
  head: () => ({ meta: [{ title: "Health · Zamp Observatory" }] }),
  component: () => (
    <Layout>
      <PlaceholderCard title="Account Health" />
    </Layout>
  ),
});
