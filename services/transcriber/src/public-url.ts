const LOCAL_PUBLIC_BASE_URL = "http://localhost:5173";

export function publicBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL?.trim() || LOCAL_PUBLIC_BASE_URL).replace(/\/+$/, "");
}

export function publicUrl(pathname: string): string {
  return new URL(pathname, `${publicBaseUrl()}/`).toString();
}
