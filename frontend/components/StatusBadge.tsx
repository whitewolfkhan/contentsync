export default function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    SCHEDULED: "bg-gray-100 text-gray-700",
    PUBLISHING: "bg-yellow-100 text-yellow-800",
    PUBLISHED: "bg-green-100 text-green-800",
    FAILED: "bg-red-100 text-red-800",
    PENDING: "bg-gray-100 text-gray-700",
  };
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded ${map[status] || "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}