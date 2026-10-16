import { WorkspaceProvider } from "@/components/workspace-context";
import { WorkspaceShell } from "@/components/workspace-shell";

export default async function WorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <WorkspaceProvider id={id}>
      <WorkspaceShell>{children}</WorkspaceShell>
    </WorkspaceProvider>
  );
}
