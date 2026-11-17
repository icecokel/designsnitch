import type { ButtonHTMLAttributes } from "react";

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className="h-10 rounded-md bg-primary-500 px-4" {...props} />;
}
