export function renderErrorPage(): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Something went wrong</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#fafafa;color:#111}main{text-align:center;padding:2rem}</style>
</head><body><main><h1>Something went wrong</h1><p>Please refresh the page and try again.</p></main></body></html>`;
}
