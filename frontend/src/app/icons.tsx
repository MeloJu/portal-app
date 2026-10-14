import type { ReactNode } from "react";

type IconProps = {
  children: ReactNode;
  size?: number;
};

export function Icon({ children, size = 20 }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {children}
    </svg>
  );
}

export const icons = {
  portal: (
    <Icon size={24}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 4V1.8M20 12h2.2M12 20v2.2M4 12H1.8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </Icon>
  ),
  home: (
    <Icon>
      <path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2v-9Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    </Icon>
  ),
  link: (
    <Icon>
      <path d="m10 13.8 4-4m-7.7 7.9-1 .9a3.5 3.5 0 0 1-5-5l3.4-3.4a3.5 3.5 0 0 1 5 0m8.9-3.9 1-.9a3.5 3.5 0 1 1 5 5l-3.4 3.4a3.5 3.5 0 0 1-5 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" transform="translate(-1.5)" />
    </Icon>
  ),
  unlink: (
    <Icon>
      <path d="m9.5 14.5-1 1a3.5 3.5 0 0 1-5-5l2-2a3.5 3.5 0 0 1 5 0M14.5 9.5l1-1a3.5 3.5 0 0 1 5 5l-2 2a3.5 3.5 0 0 1-5 0M8 3v3M3 8h3M16 18v3M18 16h3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </Icon>
  ),
  chart: (
    <Icon>
      <path d="M4 20V10m6 10V4m6 16v-7m5 7H2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </Icon>
  ),
  shield: (
    <Icon>
      <path d="M12 22s8-3.7 8-10V5l-8-3-8 3v7c0 6.3 8 10 8 10Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="m8.8 12 2.1 2.1 4.5-4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </Icon>
  ),
  settings: (
    <Icon>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
    </Icon>
  ),
  trophy: (
    <Icon>
      <path d="M8 4h8v4a4 4 0 0 1-8 0V4ZM10 13v3m4-3v3M8 20h8m-7-4h6v4H9v-4Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M8 6H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    </Icon>
  ),
  plus: (
    <Icon size={18}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </Icon>
  ),
  spark: (
    <Icon size={18}>
      <path d="m12 2 1.2 5.8L19 9l-5.8 1.2L12 16l-1.2-5.8L5 9l5.8-1.2L12 2Z" fill="currentColor" />
      <path d="m19 15 .6 2.4L22 18l-2.4.6L19 21l-.6-2.4L16 18l2.4-.6L19 15Z" fill="currentColor" />
    </Icon>
  ),
  copy: (
    <Icon size={17}>
      <rect height="12" rx="2" stroke="currentColor" strokeWidth="1.8" width="12" x="8" y="8" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" strokeWidth="1.8" />
    </Icon>
  ),
  arrow: (
    <Icon size={17}>
      <path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </Icon>
  ),
};
