export default function EquipmentIcon({
  fridge = false,
}: {
  fridge?: boolean;
}) {
  return (
    <svg
      className="equipment-icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {fridge ? (
        <>
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <path d="M5 9h14M8 5v1M8 13v4" />
        </>
      ) : (
        <>
          <path d="M12 2v20M3.4 7l17.2 10M3.4 17l17.2-10M9 4l3 3 3-3M9 20l3-3 3 3M4 10l4-1-1-4M20 14l-4 1 1 4M4 14l4 1-1 4M20 10l-4-1 1-4" />
        </>
      )}
    </svg>
  );
}
