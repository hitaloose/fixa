import { createFileRoute } from "@tanstack/react-router";
import { NoteTypesScreen } from "../features/notetypes";

export const Route = createFileRoute("/note-types/")({ component: NoteTypesScreen });
