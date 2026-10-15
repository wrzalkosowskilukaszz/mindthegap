import { Suspense } from "react";
import { NewDraft } from "./new-draft";

export const metadata = { title: "Nowa wiadomość" };

export default function NewMessagePage() {
  return (
    <div className="page page-narrow">
      <Suspense>
        <NewDraft />
      </Suspense>
    </div>
  );
}
