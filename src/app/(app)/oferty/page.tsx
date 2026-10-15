import { Suspense } from "react";
import { JobsView } from "./jobs-view";

export const metadata = { title: "Oferty pracy" };

export default function JobsPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Oferty pracy</h1>
          <p>
            Oferty dopasowane do Ciebie: z kariery firm z Twojej bazy i z portali z ofertami. Aplikacja
            sprawdza je co kilka godzin.
          </p>
        </div>
        <div id="jobs-actions" />
      </header>
      <Suspense>
        <JobsView />
      </Suspense>
    </div>
  );
}
