import { Composer } from "./composer";

export const metadata = { title: "Wiadomość" };

export default async function MessagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="page">
      <Composer id={id} />
    </div>
  );
}
