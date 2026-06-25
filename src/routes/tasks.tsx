import { createFileRoute } from "@tanstack/react-router";
import Layout, { PlaceholderCard } from "@/components/Layout";

export const Route = createFileRoute("/tasks")({
  head: () => ({ meta: [{ title: "Tasks · Zamp Observatory" }] }),
  component: () => (
    <Layout>
      <PlaceholderCard title="Task Log" />
    </Layout>
  ),
});
