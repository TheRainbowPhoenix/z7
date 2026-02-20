import { SVGProps } from 'react';

export function LadderFileIcon({ style, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '1em', height: '1em', fontSize: '1.5rem', ...style }}
      {...props}
    >
      <path
        d="M14.5 9.5H16V18.5H14.5V9.5ZM8 9.5H9.5V18.5H8V9.5ZM14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H14V8H18V20Z"
        fill="currentColor"
      />
      <path d="M14.5 11.5H9.5V13H14.5V11.5Z" fill="currentColor" />
      <path d="M14.5 15H9.5V16.5H14.5V15Z" fill="currentColor" />
    </svg>
  );
}
