import { createFileRoute } from "@tanstack/react-router";
import Layout, { PlaceholderCard } from "@/components/Layout";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · Zamp Observatory" }] }),
  component: () => (
    <Layout>
      <PlaceholderCard title="Observatory Dashboard" />
    </Layout>
  ),
});
