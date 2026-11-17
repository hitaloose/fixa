import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { NoteTypeEditorScreen } from "../features/notetypes";

export const Route = createFileRoute("/note-types/$noteTypeId")({
  component: function NoteTypeRoute() {
    const { noteTypeId } = Route.useParams();
    const navigate = useNavigate();
    return (
      <NoteTypeEditorScreen
        noteTypeId={noteTypeId}
        onSaved={() => void navigate({ to: "/note-types" })}
      />
    );
  },
});
