## Container usage

Build the image:
```bash
docker build -t mcp-excaligen .
```

Run the MCP server over STDIO:
```bash
docker run -it --rm mcp-excaligen
```

Mount `out/` for exports:
```bash
docker run -it --rm -v "$(pwd)/out:/app/out" mcp-excaligen
```

Notes:
- The image installs Playwright Chromium during build and bakes the browser cache into `/app/ms-playwright`.
- STDIO transport is used; the container just runs `node dist/server.js`.
- Use `PLAYWRIGHT_BROWSERS_PATH=/app/ms-playwright` (already set) to ensure the baked browser is used.
