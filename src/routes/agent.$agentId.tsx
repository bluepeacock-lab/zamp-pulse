import { createFileRoute } from "@tanstack/react-router";
import Layout, { PlaceholderCard } from "@/components/Layout";

export const Route = createFileRoute("/agent/$agentId")({
  head: () => ({ meta: [{ title: "Agent · Zamp Observatory" }] }),
  component: AgentDetail,
});

function AgentDetail() {
  const { agentId } = Route.useParams();
  return (
    <Layout>
      <PlaceholderCard title={`Agent Detail — ${agentId}`} />
    </Layout>
  );
}
