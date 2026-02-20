import { SVGProps } from 'react';

export function StFileIcon({ style, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '1em', height: '1em', fontSize: '1.5rem', ...style }}
      {...props}
    >
      <path
        d="M8 16.5H16V18H8V16.5ZM8 13H16V14.5H8V13ZM14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H14V8H18V20Z"
        fill="currentColor"
      />
      <path d="M16 9.5H8V11H16V9.5Z" fill="currentColor" />
    </svg>
  );
}
