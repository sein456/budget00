interface ActionIconProps {
  readonly kind?: 'close' | 'delete'
}

export function ActionIcon({ kind = 'close' }: ActionIconProps) {
  return (
    <svg
      className="action-icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'close' ? (
        <path d="m7 7 10 10M17 7 7 17" />
      ) : (
        <>
          <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7" />
        </>
      )}
    </svg>
  )
}
