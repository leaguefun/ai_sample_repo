# Snip CLI

Zero-dependency Node.js CLI for the Snip URL shortener.

## Requirements

Node.js ≥ 18

## Install globally

```sh
npm install -g .
```

After that `snip` is available everywhere.  
Alternatively, run the wrappers directly from this directory:

| Platform         | Command          |
|------------------|------------------|
| Unix / macOS     | `./snip`         |
| Windows CMD      | `snip.cmd`       |
| Windows PowerShell | `.\snip.ps1`   |

## Usage

```
snip add <url>     Shorten a URL and print the short link
snip ls            List all short links in an aligned table
snip open <code>   Resolve a short code and open the URL in your browser
snip help          Show this help
```

## Configuration

| Variable   | Default                   | Description                         |
|------------|---------------------------|-------------------------------------|
| `SNIP_API` | `http://localhost:3000`   | Base URL of the Snip backend        |

```sh
SNIP_API=https://your-snip.example.com snip ls
```

## Examples

```sh
$ snip add https://example.com/very/long/url
http://localhost:3000/aB3xYz

$ snip ls
CODE    HITS  URL
------  ----  ---
aB3xYz  3     https://example.com/very/long/url

$ snip open aB3xYz
Opening https://example.com/very/long/url
```

## Error handling

All errors print to **stderr** and exit with code **1**:
- non-http(s) URL passed to `add`
- unknown code passed to `open`
- backend unreachable
