import { createFileRoute, useRouter } from "@tanstack/react-router";
import { EditNoteScreen } from "../features/editor";

export const Route = createFileRoute("/notes/$noteId/edit")({
  component: function EditNoteRoute() {
    const { noteId } = Route.useParams();
    const router = useRouter();
    return <EditNoteScreen noteId={noteId} onSaved={() => router.history.back()} />;
  },
});
